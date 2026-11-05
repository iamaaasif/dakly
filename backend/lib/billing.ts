import "server-only";
import crypto from "node:crypto";
import type { Payment, Shop, User } from "@prisma/client";
import { db } from "./db";
import { appUrl, env } from "./config";
import { PLANS, priceFor, type PlanKey } from "./plans";
import { audit, logError } from "./audit";
import { tr } from "./i18n/server";
import { COUNTRIES } from "./i18n";
import { receiptEmail } from "./emails";

export const invoiceUrl = (p: Pick<Payment, "id" | "status">) => (p.status === "paid" || p.status === "manual" ? `/billing/invoice/${p.id}` : null);

/**
 * Payments. Bangladesh (BDT shops) pays through SSLCommerz: bKash, Nagad, Rocket, cards, net banking.
 * Every other country pays by card through Stripe Checkout, in USD (see priceFor in plans.ts).
 */
export const providerFor = (shop: Pick<Shop, "currency">) => (shop.currency === "BDT" ? "sslcommerz" : "stripe");
const sslReady = () => !!(env("SSLCZ_STORE_ID") && env("SSLCZ_STORE_PASSWORD"));
const stripeReady = () => !!env("STRIPE_SECRET_KEY");
export const paymentsReady = (shop?: Pick<Shop, "currency">) => (!shop ? sslReady() || stripeReady() : providerFor(shop) === "sslcommerz" ? sslReady() : stripeReady());

const sslBase = () => (process.env.SSLCZ_SANDBOX === "false" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com");

export async function startPayment(shop: Shop, user: User, plan: PlanKey, months: number): Promise<{ url?: string; error?: string }> {
  if (!paymentsReady(shop)) return { error: await tr("Online Payment এখনো চালু হয়নি। Support-এ যোগাযোগ করুন।") };
  const price = priceFor(plan, shop.currency);
  const amount = price.amount * months;
  const provider = providerFor(shop);
  const tranId = "DK" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase();
  await db.payment.create({ data: { shopId: shop.id, plan, months, amount, currency: price.currency, provider, tranId } });
  try {
    if (provider === "stripe") return { url: await stripeCheckout(shop, user, plan, months, amount, price.currency, tranId) };
    const cb = (k: string) => `${appUrl()}/api/billing/sslcommerz?kind=${k}`;
    const form = new URLSearchParams({
      store_id: env("SSLCZ_STORE_ID")!, store_passwd: env("SSLCZ_STORE_PASSWORD")!,
      total_amount: String(amount), currency: "BDT", tran_id: tranId,
      success_url: cb("success"), fail_url: cb("fail"), cancel_url: cb("cancel"), ipn_url: cb("ipn"),
      cus_name: user.name, cus_email: user.email, cus_add1: "Bangladesh", cus_city: "Dhaka", cus_country: "Bangladesh", cus_phone: "01700000000",
      shipping_method: "NO", product_name: `Dakly ${PLANS[plan].name} (${months} month)`, product_category: "Software", product_profile: "non-physical-goods",
      value_a: shop.id,
    });
    const res = await fetch(`${sslBase()}/gwprocess/v4/api.php`, { method: "POST", body: form });
    const data = await res.json();
    if (data.status !== "SUCCESS" || !data.GatewayPageURL) throw new Error(data.failedreason || "SSLCommerz session failed");
    return { url: data.GatewayPageURL };
  } catch (e) {
    await logError("payment", e, shop.id);
    await db.payment.update({ where: { tranId }, data: { status: "failed", note: String((e as Error).message).slice(0, 200) } });
    return { error: await tr("Payment শুরু করা যায়নি। একটু পরে আবার চেষ্টা করুন।") };
  }
}

/* ---------- Stripe (international) ---------- */
async function stripe(path: string, form?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: form ? "POST" : "GET",
    headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${j?.error?.message ?? "error"}`);
  return j;
}

async function stripeCheckout(shop: Shop, user: User, plan: PlanKey, months: number, amount: number, currency: string, tranId: string) {
  const back = `${appUrl()}/api/billing/stripe`;
  const f = new URLSearchParams({
    mode: "payment", customer_email: user.email, client_reference_id: tranId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(amount * 100),
    "line_items[0][price_data][product_data][name]": `Dakly ${PLANS[plan].name} × ${months}`,
    "metadata[tranId]": tranId, "metadata[shopId]": shop.id,
    success_url: `${back}?kind=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${back}?kind=cancel&tran=${tranId}`,
  });
  if (COUNTRIES[shop.country]) f.set("billing_address_collection", "auto");
  const s = await stripe("checkout/sessions", f);
  await db.payment.update({ where: { tranId }, data: { valId: s.id } });
  return s.url as string;
}

/** Confirms a Stripe Checkout session by asking Stripe directly (the redirect and webhook are only hints). */
export async function confirmStripe(sessionId: string) {
  const s = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  const tranId = s.metadata?.tranId || s.client_reference_id;
  const p = tranId ? await db.payment.findUnique({ where: { tranId } }) : null;
  if (!p) return { ok: false, reason: "unknown transaction" };
  const good = s.payment_status === "paid" && Number(s.amount_total) >= p.amount * 100 && String(s.currency).toUpperCase() === p.currency;
  if (!good) return { ok: false, reason: `stripe status ${s.payment_status}` };
  await markPaid(p, sessionId, "card");
  return { ok: true, payment: p };
}

/** Verifies a Stripe webhook signature (Stripe-Signature: t=..., v1=...). */
export function stripeSignatureOk(payload: string, header: string | null) {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return false;
  const want = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  return want.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(parts.v1));
}

/* ---------- shared ---------- */
/** Extends (or starts) a shop's plan by N months. Used by payments and by admins. */
export async function extendPlan(shopId: string, plan: PlanKey, months: number) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const from = shop.plan === plan && shop.planUntil && shop.planUntil > new Date() ? shop.planUntil : new Date();
  const until = new Date(from); until.setMonth(until.getMonth() + months);
  await db.shop.update({ where: { id: shopId }, data: { plan, planUntil: until } });
  return until;
}

/** Marks a payment paid exactly once and extends the plan. */
async function markPaid(p: Payment, valId: string, method: string | null) {
  const claimed = await db.payment.updateMany({ where: { id: p.id, status: { not: "paid" } }, data: { status: "paid", valId, method, paidAt: new Date() } });
  if (claimed.count) {
    const until = await extendPlan(p.shopId, p.plan as PlanKey, p.months);
    await audit(null, "payment.paid", p.shopId, `${p.provider} ${p.plan} × ${p.months} = ${p.amount} ${p.currency}, until ${until.toISOString().slice(0, 10)}`);
    const shop = await db.shop.findUnique({ where: { id: p.shopId }, include: { owner: true } });
    if (shop) void receiptEmail({ ...shop.owner, shop }, p, until);
  }
}

/** Confirms a payment with SSLCommerz's validation API. Idempotent: a paid payment is never applied twice. */
export async function confirmPayment(valId: string, tranId: string) {
  const p = await db.payment.findUnique({ where: { tranId } });
  if (!p) return { ok: false, reason: "unknown transaction" };
  if (p.status === "paid") return { ok: true, payment: p };
  const q = new URLSearchParams({ val_id: valId, store_id: env("SSLCZ_STORE_ID") || "", store_passwd: env("SSLCZ_STORE_PASSWORD") || "", format: "json" });
  const res = await fetch(`${sslBase()}/validator/api/validationserverAPI.php?${q}`);
  const v = await res.json().catch(() => ({}));
  const good = ["VALID", "VALIDATED"].includes(v.status) && v.tran_id === tranId && Math.round(Number(v.amount)) >= p.amount && v.currency_type === "BDT";
  if (!good) {
    await db.payment.update({ where: { id: p.id }, data: { status: "failed", valId, note: `validation: ${v.status ?? res.status}` } });
    return { ok: false, reason: "validation failed" };
  }
  await markPaid(p, valId, v.card_type ?? null);
  return { ok: true, payment: p };
}
