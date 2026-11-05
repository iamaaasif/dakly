import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { confirmPayment } from "@/lib/billing";
import { logError } from "@/lib/audit";

/** SSLCommerz posts here: the browser for success/fail/cancel, the server for IPN. */
export async function POST(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  const f = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const tranId = f.tran_id || "";
  let status = "error";
  try {
    if ((kind === "success" || kind === "ipn") && f.val_id && ["VALID", "VALIDATED"].includes(f.status)) {
      status = (await confirmPayment(f.val_id, tranId)).ok ? "paid" : "error";
    } else if (kind === "cancel" || kind === "fail" || kind === "ipn") {
      await db.payment.updateMany({ where: { tranId, status: "pending" }, data: { status: kind === "cancel" ? "cancelled" : "failed" } });
      status = kind === "cancel" ? "cancelled" : "failed";
    }
  } catch (e) {
    await logError("payment", e);
  }
  if (kind === "ipn") return new Response("ok");
  return Response.redirect(`${appUrl()}/billing?status=${status}`, 303);
}
