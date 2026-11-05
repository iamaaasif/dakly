import "server-only";
import type { Loc } from "./i18n";
import { db } from "./db";

/** Splits an order's items text ("শাল × 2, কুর্তি") into clean product names. */
export function itemNames(items: string | null): string[] {
  if (!items || /^Excel থেকে/.test(items)) return [];
  return items.split(/[,،;\n]+/).map((s) => s.replace(/[×x]\s*\d+\s*$/i, "").trim()).filter((s) => s.length > 1 && s.length < 60);
}

export async function productStats(shopId: string) {
  const orders = await db.order.findMany({ where: { customer: { shopId } }, select: { customerId: true, items: true, amount: true, orderedAt: true } });
  const pop = new Map<string, { buyers: Set<string>; revenue: number; recent: number }>();
  const bought = new Map<string, Set<string>>();
  const monthAgo = Date.now() - 30 * 86400000;
  for (const o of orders) {
    const names = itemNames(o.items);
    for (const n of names) {
      const key = n.toLowerCase();
      const p = pop.get(key) ?? { buyers: new Set<string>(), revenue: 0, recent: 0 };
      p.buyers.add(o.customerId); p.revenue += o.amount / names.length;
      if (o.orderedAt.getTime() > monthAgo) p.recent++;
      pop.set(key, p);
      const b = bought.get(o.customerId) ?? new Set<string>(); b.add(key); bought.set(o.customerId, b);
    }
  }
  const display = new Map<string, string>();
  for (const o of orders) for (const n of itemNames(o.items)) if (!display.has(n.toLowerCase())) display.set(n.toLowerCase(), n);
  const ranked = [...pop.entries()]
    .map(([k, v]) => ({ key: k, name: display.get(k)!, buyers: v.buyers.size, revenue: Math.round(v.revenue), recent: v.recent, score: v.buyers.size + v.recent * 2 }))
    .sort((a, b) => b.score - a.score);
  return { ranked, bought };
}

/**
 * Product pick per customer: the shop's best-selling product (weighted to the last 30 days)
 * that the customer has not bought yet; if they bought everything, their own favourite.
 */
export async function recommendationsFor(shopId: string): Promise<Map<string, string>> {
  const { ranked, bought } = await productStats(shopId);
  const out = new Map<string, string>();
  if (!ranked.length) return out;
  const customers = await db.customer.findMany({ where: { shopId }, select: { id: true } });
  for (const c of customers) {
    const mine = bought.get(c.id) ?? new Set();
    const pick = ranked.find((r) => !mine.has(r.key)) ?? ranked.find((r) => mine.has(r.key));
    if (pick) out.set(c.id, pick.name);
  }
  return out;
}

export async function recommendationFor(shopId: string, customerId: string, { t }: Loc) {
  const { ranked, bought } = await productStats(shopId);
  const mine = bought.get(customerId) ?? new Set();
  const fresh = ranked.find((r) => !mine.has(r.key));
  if (fresh) return { product: fresh.name, reason: t("আপনার দোকানের জনপ্রিয় পণ্য ({n} জন কিনেছেন), উনি এখনো নেননি", { n: fresh.buyers }) };
  const fav = ranked.find((r) => mine.has(r.key));
  return fav ? { product: fav.name, reason: t("উনি এটা আগে কিনেছেন, আবার নিতে পারেন") } : null;
}
