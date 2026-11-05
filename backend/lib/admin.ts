import "server-only";
import { priceFor } from "./plans";
import { db } from "./db";
import { PLANS, activePlan, type PlanKey } from "./plans";
import { monthStart } from "./usage";

/** Estimated provider costs in BDT, set in .env so finance can tune them. */
export const COSTS = {
  wa: Number(process.env.COST_WA_BDT ?? 1.2),
  sms: Number(process.env.COST_SMS_BDT ?? 0.35),
  voice: Number(process.env.COST_VOICE_BDT ?? 12),
  ai: Number(process.env.COST_AI_BDT ?? 0.4),
};
const REAL = ["sent", "delivered", "read", "interested"];

/** Messages (by channel), AI calls, estimated cost and payments per shop for this month. */
export async function usageByShop() {
  const since = monthStart();
  const [msgs, ai, pays, shops] = await Promise.all([
    db.campaignMessage.groupBy({ by: ["campaignId", "channel"], where: { createdAt: { gte: since }, status: { in: REAL } }, _count: { _all: true } }),
    db.aiUsage.groupBy({ by: ["shopId"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.payment.groupBy({ by: ["shopId"], where: { paidAt: { gte: since }, status: "paid" }, _sum: { amount: true } }),
    db.shop.findMany({ include: { owner: { select: { email: true, name: true } }, _count: { select: { customers: true } } } }),
  ]);
  const camp = await db.campaign.findMany({ where: { id: { in: [...new Set(msgs.map((m) => m.campaignId))] } }, select: { id: true, shopId: true } });
  const shopOf = new Map(camp.map((c) => [c.id, c.shopId]));
  const rows = new Map(shops.map((s) => [s.id, { shop: s, plan: activePlan(s) as PlanKey, wa: 0, sms: 0, voice: 0, ai: 0, paid: 0, cost: 0 }]));
  for (const m of msgs) { const r = rows.get(shopOf.get(m.campaignId)!); if (r) r[m.channel as "wa" | "sms" | "voice"] += m._count._all; }
  for (const a of ai) { const r = rows.get(a.shopId); if (r) r.ai = a._count._all; }
  for (const p of pays) { const r = rows.get(p.shopId); if (r) r.paid = p._sum.amount ?? 0; }
  for (const r of rows.values()) r.cost = Math.round(r.wa * COSTS.wa + r.sms * COSTS.sms + r.voice * COSTS.voice + r.ai * COSTS.ai);
  return [...rows.values()];
}

/** Monthly recurring revenue in BDT. USD plans are converted at USD_TO_BDT (default 120). */
export const mrr = (shops: { plan: string; planUntil: Date | null; currency?: string }[]) => shops.reduce((a, s) => {
  const p = priceFor(activePlan(s), s.currency ?? "BDT");
  return a + (p.currency === "BDT" ? p.amount : p.amount * (Number(process.env.USD_TO_BDT) || 120));
}, 0);
