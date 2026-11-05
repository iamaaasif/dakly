import "server-only";
import type { Shop } from "@prisma/client";
import { db } from "./db";
import { aiEnabled, chat } from "./ai";
import { loadCustomers, countBySegment } from "./segments";
import { productStats, itemNames } from "./recommend";
import { bestTime } from "./timing";
import { withAi } from "./usage";
import { localDay, LANGS, isLang, COUNTRIES, type Loc } from "./i18n";
import { shopLoc } from "./i18n/server";
import { knowledgeContext, kbPrompt } from "./knowledge";

export type AiTip = { title: string; body: string; segment: string; offer: string; why: string };

/** The shop's local calendar day (YYYY-MM-DD). */
export const shopDay = (shop: Pick<Shop, "timezone">, d = new Date()) => localDay(shop.timezone, d);

/** A compact, numbers-only picture of the shop that the AI reasons over. */
export async function shopSummary(shop: Shop, loc: Loc) {
  const shopId = shop.id;
  const rows = await loadCustomers(shopId);
  const seg = countBySegment(rows.filter((r) => !r.optedOut));
  const { ranked } = await productStats(shopId);
  const day = 86400000, now = Date.now();
  const orders = await db.order.findMany({ where: { customer: { shopId }, orderedAt: { gte: new Date(now - 90 * day) } }, select: { amount: true, orderedAt: true, items: true, customerId: true } });
  const last30 = orders.filter((o) => o.orderedAt.getTime() > now - 30 * day);
  const prev30 = orders.filter((o) => o.orderedAt.getTime() <= now - 30 * day && o.orderedAt.getTime() > now - 60 * day);
  const inactiveIds = new Set(rows.filter((r) => r.segment === "inactive").map((r) => r.id));
  const lapsedItems = new Map<string, number>();
  const allOrders = await db.order.findMany({ where: { customerId: { in: [...inactiveIds] } }, select: { items: true } });
  for (const o of allOrders) for (const n of itemNames(o.items)) lapsedItems.set(n, (lapsedItems.get(n) ?? 0) + 1);
  const slipping = rows.filter((r) => r.segment !== "inactive" && r.stats.last && now - r.stats.last.getTime() > 40 * day).length;
  const t = await bestTime(shop, loc);
  return {
    customers: rows.length, segments: seg, slipping,
    sales30: last30.reduce((a, o) => a + o.amount, 0), salesPrev30: prev30.reduce((a, o) => a + o.amount, 0),
    orders30: last30.length,
    avgOrder: last30.length ? Math.round(last30.reduce((a, o) => a + o.amount, 0) / last30.length) : 0,
    topProducts: ranked.slice(0, 6).map((r) => ({ name: r.name, buyers: r.buyers, last30: r.recent })),
    inactiveUsedToBuy: [...lapsedItems.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, n]) => ({ name, orders: n })),
    bestTime: t.label,
    month: new Intl.DateTimeFormat("en", { month: "long", timeZone: shop.timezone }).format(new Date()),
    country: COUNTRIES[shop.country]?.name ?? shop.country, currency: shop.currency,
  };
}

function ruleTips(s: Awaited<ReturnType<typeof shopSummary>>, { t }: Loc): AiTip[] {
  const tips: AiTip[] = [];
  const lapsed = s.inactiveUsedToBuy[0]?.name;
  if (s.segments.inactive)
    tips.push({ title: t("{n} জন পুরোনো Customer-কে ফিরিয়ে আনুন", { n: s.segments.inactive }), body: lapsed ? t('এঁরা আগে সবচেয়ে বেশি কিনতেন "{p}"। নতুন {p}-এর খবর আর ছোট ছাড় দিয়ে Winback পাঠান।', { p: lapsed }) : t("ফিরে আসার জন্য ছোট একটা ছাড় দিন।"), segment: "inactive", offer: lapsed ? t("নতুন {p} এসেছে, ফিরে আসার জন্য ১০% ছাড়", { p: lapsed }) : t("ফিরে আসার জন্য ১০% ছাড়"), why: t("Inactive Customer-দের পুরোনো কেনাকাটা দেখে") });
  const top = s.topProducts[0]?.name;
  if (s.segments.vip && top)
    tips.push({ title: t("VIP-দের আগে নতুন পণ্য দেখান"), body: t('এই মাসে "{p}" সবচেয়ে বেশি চলছে। VIP-দের আগে জানালে তাড়াতাড়ি বিক্রি হয়।', { p: top }), segment: "vip", offer: t("{p} সবার আগে আপনার জন্য, VIP ছাড়সহ", { p: top }), why: t("গত ৩০ দিনের বিক্রি দেখে") });
  if (s.slipping >= 2)
    tips.push({ title: t("{n} জন হারিয়ে যাওয়ার আগেই মনে করান", { n: s.slipping }), body: t("৪০ দিনের বেশি কেনেননি, এখনো Inactive হননি। এখন একটা ছোট Offer সবচেয়ে কাজে দেয়।"), segment: "regular", offer: top ? t("{p}-এ এই সপ্তাহে বিশেষ দাম", { p: top }) : t("এই সপ্তাহে বিশেষ দাম"), why: t("শেষ কেনার তারিখ দেখে") });
  return tips.slice(0, 3);
}

/** Today's 3 suggestions for a shop: AI when available, otherwise rules over the same summary. Cached per day. */
export async function dailyTips(shop: Shop, opts: { refresh?: boolean } = {}): Promise<{ tips: AiTip[]; source: string }> {
  const day = shopDay(shop);
  const loc = shopLoc(shop);
  if (!opts.refresh) {
    const cached = await db.aiSuggestion.findUnique({ where: { shopId_day: { shopId: shop.id, day } } });
    if (cached) return { tips: cached.items as unknown as AiTip[], source: cached.source };
  }
  const s = await shopSummary(shop, loc);
  if (!s.customers) return { tips: [], source: "rules" };
  let tips = ruleTips(s, loc), source = "rules";
  const lang = isLang(shop.language) ? shop.language : "bn";
  if (aiEnabled()) {
    try {
      const kb = kbPrompt(await knowledgeContext(shop.id));
      const out = await withAi(shop, "insight", () => chat(
        (lang === "bn"
          ? "তুমি বাংলাদেশের ছোট অনলাইন দোকানের Growth পরামর্শদাতা। দেওয়া সংখ্যা দেখে আজ কী করা উচিত তার ৩টা নির্দিষ্ট, কাজে লাগানোর মতো পরামর্শ দাও। মৌসুম/মাস মাথায় রাখো (যেমন শীত, ঈদ, পূজা, বিয়ের মৌসুম)। বানানো সংখ্যা দেবে না। স্বাভাবিক বাংলায়, দরকারি ইংরেজি শব্দ রেখে লেখো। JSON: {\"tips\":[{\"title\":string(৬০ অক্ষরের মধ্যে),\"body\":string(১-২ বাক্য),\"segment\":\"vip|regular|new|inactive|all\",\"offer\":string(Campaign-এর জন্য ছোট Offer বর্ণনা),\"why\":string(কোন সংখ্যা দেখে)}]}"
          : `You are a growth adviser for a small online shop in ${s.country}. From the numbers, give 3 specific, actionable things to do today. Keep the season and local holidays and events of that country in mind. Never invent numbers. Write in ${LANGS[lang].ai}. JSON: {"tips":[{"title":string(max 60 chars),"body":string(1-2 sentences),"segment":"vip|regular|new|inactive|all","offer":string(short offer for a campaign),"why":string(which numbers)}]}`) +
          kb,
        `দোকান: ${shop.name}\nData: ${JSON.stringify(s)}`, true));
      const parsed = JSON.parse(out).tips as AiTip[];
      if (Array.isArray(parsed) && parsed.length) {
        tips = parsed.slice(0, 3).map((t) => ({ title: String(t.title), body: String(t.body), segment: ["vip", "regular", "new", "inactive", "all"].includes(t.segment) ? t.segment : "all", offer: String(t.offer ?? ""), why: String(t.why ?? "") }));
        source = "ai";
      }
    } catch { /* keep rule tips */ }
  }
  await db.aiSuggestion.upsert({ where: { shopId_day: { shopId: shop.id, day } }, update: { items: tips, source }, create: { shopId: shop.id, day, items: tips, source } });
  return { tips, source };
}


export async function cachedTips(shop: Pick<Shop, "id" | "timezone">) {
  const c = await db.aiSuggestion.findUnique({ where: { shopId_day: { shopId: shop.id, day: shopDay(shop) } } });
  return c ? { tips: c.items as unknown as AiTip[], source: c.source } : null;
}

export const tipHref = (t: AiTip) => `/campaigns/new?${new URLSearchParams({ segment: t.segment, offer: t.offer })}`;
