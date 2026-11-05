import { db } from "@/lib/db";
import { speak } from "@/lib/ai";
import { personalize } from "@/lib/send";
import { shopLoc } from "@/lib/i18n/server";

// Twilio fetches this during a call. The id is an unguessable message id.
const cache = new Map<string, ArrayBuffer>();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const part = new URL(req.url).searchParams.get("part");
  const bye = part === "bye" || part === "thanks";
  const m = await db.campaignMessage.findUnique({ where: { id }, include: { customer: true, campaign: { include: { shop: true } } } });
  if (!m || m.channel !== "voice") return new Response("Not found", { status: 404 });
  const key = id + ":" + (part ?? "main");
  let audio = cache.get(key);
  if (!audio) {
    const shop = m.campaign.shop;
    const t = shopLoc(shop).t;
    const text = part === "thanks" ? t("ধন্যবাদ! {shop} থেকে শীঘ্রই আপনাকে বিস্তারিত জানানো হবে।", { shop: shop.name }) : bye ? t("ধন্যবাদ। ভালো থাকবেন।") : personalize(m.campaign.message, m.customer.name, null, t("আমাদের নতুন Collection"));
    audio = await speak(text, shop.language);
    await db.aiUsage.create({ data: { shopId: m.campaign.shopId, kind: "tts" } });
    cache.set(key, audio);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
  }
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=600" } });
}
