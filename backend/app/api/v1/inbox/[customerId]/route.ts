import { apiAuth, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { thread, sendChat, windowOpen, WINDOW_MS } from "@/lib/inbox";

type P = { params: Promise<{ customerId: string }> };
/** Messages oldest-first. ?before=<nextCursor>&limit=50 pages back in time. */
export async function GET(req: Request, { params }: P) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { customerId } = await params;
  const c = await db.customer.findFirst({ where: { id: customerId, shopId: a.shop.id } });
  if (!c) return fail("Customer পাওয়া যায়নি", 404);
  const p = new URL(req.url).searchParams;
  const t = await thread(a.shop.id, c.id, { before: p.get("before") ?? undefined, limit: Number(p.get("limit") || 50) });
  return ok({
    customer: { id: c.id, name: c.name, phone: c.phone, optedOut: c.optedOut },
    windowOpen: windowOpen(c), windowEndsAt: c.lastInboundAt ? new Date(c.lastInboundAt.getTime() + WINDOW_MS) : null,
    ...t,
  });
}
/**
 * { text, channel?: "wa" | "sms" }. WhatsApp inside the 24h window sends free text; outside it sends
 * the approved template (kind "template", counts toward the monthly limit).
 */
export async function POST(req: Request, { params }: P) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { customerId } = await params;
  const b = await req.json().catch(() => ({}));
  const r = await sendChat(a.shop, customerId, String(b.text ?? ""), { channel: b.channel === "sms" ? "sms" : "wa", authorId: a.user.id });
  if ("error" in r) return fail(r.error, r.code === "not_found" ? 404 : r.code === "limit_reached" ? 429 : r.code === "provider_error" ? 502 : 400, r.code);
  return ok(r, 201);
}
