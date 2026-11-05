import type { Shop } from "@prisma/client";
import type { Loc } from "./i18n";

export type PlanKey = "free" | "starter" | "growth";
/** price = BDT (Bangladesh, SSLCommerz). usd = every other country (Stripe). Override with PRICE_<PLAN>_BDT / PRICE_<PLAN>_USD. */
export const PLANS: Record<PlanKey, { name: string; price: number; usd: number; messages: number; ai: number }> = {
  free: { name: "Free", price: 0, usd: 0, messages: 200, ai: 50 },
  starter: { name: "Starter", price: 990, usd: 12, messages: 2000, ai: 500 },
  growth: { name: "Growth", price: 2490, usd: 29, messages: 10000, ai: 3000 },
};
const envNum = (k: string) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? Math.round(v) : null; };
/** What a plan costs a shop per month, in the currency we charge it in. */
export function priceFor(plan: PlanKey, shopCurrency: string): { amount: number; currency: string } {
  if (plan === "free") return { amount: 0, currency: shopCurrency };
  const up = plan.toUpperCase();
  if (shopCurrency === "BDT") return { amount: envNum(`PRICE_${up}_BDT`) ?? PLANS[plan].price, currency: "BDT" };
  return { amount: envNum(`PRICE_${up}_USD`) ?? PLANS[plan].usd, currency: "USD" };
}
export function planFeatures(plan: PlanKey, { t }: Loc): string[] {
  const p = PLANS[plan];
  const base = [t("মাসে {n} Message", { n: p.messages }), t("মাসে {n} বার AI লেখা", { n: p.ai })];
  if (plan === "free") return [t("{n} পর্যন্ত Customer", { n: FREE_CUSTOMER_CAP }), ...base, t("AI Knowledge Base"), t("WhatsApp Inbox")];
  if (plan === "starter") return [t("সীমাহীন Customer"), ...base, "Facebook Post Schedule", "Store Sync"];
  return [t("সব Starter সুবিধা"), ...base, t("AI Voice Call ও WhatsApp Call"), t("নিজের WhatsApp নম্বর")];
}
export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];
export const FREE_CUSTOMER_CAP = 500;

/** The plan in force today. A paid plan falls back to Free after it expires. */
export function activePlan(shop: Pick<Shop, "plan" | "planUntil">): PlanKey {
  const p = (PLAN_KEYS.includes(shop.plan as PlanKey) ? shop.plan : "free") as PlanKey;
  if (p !== "free" && (!shop.planUntil || shop.planUntil.getTime() < Date.now())) return "free";
  return p;
}

export function messageLimit(shop: Pick<Shop, "plan" | "planUntil" | "limitOverride">) {
  return shop.limitOverride ?? PLANS[activePlan(shop)].messages;
}
export const aiLimit = (shop: Pick<Shop, "plan" | "planUntil">) => PLANS[activePlan(shop)].ai;
export const voiceAllowed = (shop: Pick<Shop, "plan" | "planUntil">) => activePlan(shop) === "growth";
