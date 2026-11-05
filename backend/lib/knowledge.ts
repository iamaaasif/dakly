import "server-only";
import { z } from "zod";
import { db } from "./db";

export const KB_TYPES = ["product", "policy", "faq", "voice", "note"] as const;
export type KbType = (typeof KB_TYPES)[number];

export const kbSchema = z.object({
  type: z.enum(KB_TYPES).default("note"),
  title: z.string().trim().min(2, "শিরোনাম লিখুন").max(200),
  body: z.string().trim().max(4000).default(""),
  price: z.union([z.number(), z.string(), z.null()]).optional().transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(String(v).replace(/[^\d.]/g, "")));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }),
  active: z.boolean().default(true),
});

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

/**
 * The shop's knowledge as compact text for an AI prompt. Brand voice always comes first,
 * then items that share words with `query`, then the newest. Capped at `max` characters.
 */
export async function knowledgeContext(shopId: string, query = "", max = 3500) {
  const [shop, items] = await Promise.all([
    db.shop.findUnique({ where: { id: shopId }, select: { brandVoice: true, currency: true, name: true } }),
    db.knowledgeItem.findMany({ where: { shopId, active: true }, orderBy: { updatedAt: "desc" }, take: 300 }),
  ]);
  if (!shop || (!items.length && !shop.brandVoice)) return "";
  const q = new Set(words(query));
  const score = (i: (typeof items)[number]) => (i.type === "voice" ? 1000 : 0) + words(i.title + " " + i.body).filter((w) => q.has(w)).length * 10 + (i.type === "product" ? 1 : 0);
  const ranked = [...items].sort((a, b) => score(b) - score(a));
  const lines: string[] = [];
  if (shop.brandVoice) lines.push(`[brand voice] ${shop.brandVoice}`);
  for (const i of ranked) {
    const price = i.price != null ? ` (${i.price} ${shop.currency})` : "";
    lines.push(`[${i.type}] ${i.title}${price}${i.body ? ": " + i.body.replace(/\s+/g, " ") : ""}`);
  }
  let out = "";
  for (const l of lines) { if (out.length + l.length > max) break; out += l + "\n"; }
  return out.trim();
}

/** Appended to every AI system prompt. Tells the model to rely on these facts and not to invent others. */
export const kbPrompt = (kb: string) =>
  kb ? `\n\nShop knowledge from the owner (use it; it is the truth about products, prices and policies; never invent prices, stock or policies that are not here; follow the brand voice):\n${kb}` : "";
