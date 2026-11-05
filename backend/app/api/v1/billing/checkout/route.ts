import { z } from "zod";
import { apiAuth, ok, fail, body } from "@/lib/api";
import { startPayment } from "@/lib/billing";

/**
 * { plan: "starter" | "growth", months: 1 | 3 | 6 | 12 } -> { url }. Open url in a browser / Custom Tab.
 * The payment is confirmed on the server; when the user comes back, reload GET /billing.
 */
export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const b = await body(req, z.object({ plan: z.enum(["starter", "growth"]), months: z.number().int().min(1).max(12).default(1) }));
  if ("res" in b) return b.res;
  const r = await startPayment(a.shop, a.user, b.data.plan, b.data.months);
  return r.url ? ok({ url: r.url }) : fail(r.error ?? "Payment শুরু করা যায়নি। একটু পরে আবার চেষ্টা করুন।", 503, "payments_unavailable");
}
