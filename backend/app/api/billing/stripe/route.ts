import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { confirmStripe, stripeSignatureOk } from "@/lib/billing";
import { logError } from "@/lib/audit";

/** Browser return from Stripe Checkout. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind");
  let status = "error";
  try {
    if (kind === "success" && u.searchParams.get("session_id")) status = (await confirmStripe(u.searchParams.get("session_id")!)).ok ? "paid" : "error";
    else if (kind === "cancel") {
      await db.payment.updateMany({ where: { tranId: u.searchParams.get("tran") ?? "", status: "pending" }, data: { status: "cancelled" } });
      status = "cancelled";
    }
  } catch (e) { await logError("payment", e); }
  return Response.redirect(`${appUrl()}/billing?status=${status}`, 303);
}

/** Stripe webhook (checkout.session.completed). Set STRIPE_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!stripeSignatureOk(raw, req.headers.get("stripe-signature"))) return new Response("bad signature", { status: 400 });
  try {
    const ev = JSON.parse(raw);
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") await confirmStripe(ev.data.object.id);
  } catch (e) { await logError("payment", e); return new Response("error", { status: 500 }); }
  return new Response("ok");
}
