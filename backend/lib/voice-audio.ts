import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db } from "./db";
import { speak } from "./ai";
import { shopLoc } from "./i18n/server";

export type CallPart = "main" | "bye" | "thanks";
export type CallAudioFormat = "mp3" | "sln24";

const DIR = path.join(os.tmpdir(), "dakly-call-audio");
const safe = (id: string) => /^[a-z0-9]{8,40}$/i.test(id);

/**
 * The speech for one part of an AI call: the campaign message, "bye" when no key was pressed,
 * or "thanks" after 1. Made once with OpenAI and kept on disk for an hour, so a provider
 * fetching it twice (or Dakly preparing it before dialling) costs one TTS request.
 * mp3 is for Twilio; sln24 (raw 24 kHz 16-bit) is for Asterisk. Returns null for an unknown id.
 */
export async function prepareCallAudio(id: string, part: CallPart, format: CallAudioFormat): Promise<Buffer | null> {
  if (!safe(id)) return null;
  const file = path.join(DIR, `${id}-${part}.${format}`);
  const st = await fs.stat(file).catch(() => null);
  if (st && Date.now() - st.mtimeMs < 3600_000) return fs.readFile(file);

  const m = await db.campaignMessage.findUnique({ where: { id }, include: { customer: true, campaign: { include: { shop: true } } } });
  if (!m || m.channel !== "voice") return null;
  const shop = m.campaign.shop;
  const t = shopLoc(shop).t;
  const { personalize } = await import("./send");
  const text = part === "thanks" ? t("ধন্যবাদ! {shop} থেকে শীঘ্রই আপনাকে বিস্তারিত জানানো হবে।", { shop: shop.name })
    : part === "bye" ? t("ধন্যবাদ। ভালো থাকবেন।")
    : personalize(m.campaign.message, m.customer.name, null, t("আমাদের নতুন Collection"));
  const audio = Buffer.from(await speak(text, shop.language, format === "sln24" ? "pcm" : "mp3"));
  await db.aiUsage.create({ data: { shopId: m.campaign.shopId, kind: "tts" } });
  await fs.mkdir(DIR, { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  await fs.writeFile(tmp, audio);
  await fs.rename(tmp, file);
  void cleanOld();
  return audio;
}

let lastClean = 0;
async function cleanOld() {
  if (Date.now() - lastClean < 600_000) return;
  lastClean = Date.now();
  for (const f of await fs.readdir(DIR).catch(() => [] as string[])) {
    const p = path.join(DIR, f);
    const st = await fs.stat(p).catch(() => null);
    if (st && Date.now() - st.mtimeMs > 3600_000) await fs.rm(p, { force: true });
  }
}
