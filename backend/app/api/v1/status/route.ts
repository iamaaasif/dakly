import { apiAuth, ok } from "@/lib/api";

/** Works for pending and suspended shops too, so the app can show the right screen. */
export async function GET() {
  const a = await apiAuth({ allowInactive: true });
  if ("res" in a) return a.res;
  const s = a.shop;
  return ok({ status: s.suspended ? "suspended" : s.approved ? "active" : "pending", reason: s.suspended ? s.suspendedReason : null });
}
