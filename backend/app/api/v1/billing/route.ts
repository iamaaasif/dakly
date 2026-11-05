import { db } from "@/lib/db";
import { apiAuth, ok } from "@/lib/api";
import { activePlan, PLANS, PLAN_KEYS, priceFor, planFeatures } from "@/lib/plans";
import { paymentsReady, providerFor, invoiceUrl } from "@/lib/billing";
import { getLoc } from "@/lib/i18n/server";

/** Plans priced for this shop (BDT in Bangladesh, USD elsewhere) and payment history. Pay with POST /billing/checkout. */
export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const loc = await getLoc();
  return ok({
    current: activePlan(a.shop), until: a.shop.planUntil,
    plans: PLAN_KEYS.map((k) => ({ key: k, name: PLANS[k].name, price: priceFor(k, a.shop.currency), messages: PLANS[k].messages, ai: PLANS[k].ai, features: planFeatures(k, loc) })),
    onlinePayments: paymentsReady(a.shop), provider: providerFor(a.shop),
    payments: (await db.payment.findMany({ where: { shopId: a.shop.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, plan: true, months: true, amount: true, currency: true, provider: true, status: true, tranId: true, createdAt: true, paidAt: true } })).map((p) => ({ ...p, invoiceUrl: invoiceUrl(p) })),
  });
}
