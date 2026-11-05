import { db } from "@/lib/db";
import { apiAuth, fail, ok } from "@/lib/api";
import { segmentOf } from "@/lib/segments";
import { recommendationFor } from "@/lib/recommend";
import { getLoc } from "@/lib/i18n/server";
import { windowOpen } from "@/lib/inbox";
import { locale } from "@/lib/api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, shopId: a.shop.id }, include: { orders: { orderBy: { orderedAt: "desc" } } } });
  if (!c) return fail("Not found", 404);
  const total = c.orders.reduce((x, o) => x + o.amount, 0);
  const t = c.orders.map((o) => o.orderedAt.getTime());
  const segment = segmentOf({ total, count: c.orders.length, first: t.length ? new Date(Math.min(...t)) : null, last: t.length ? new Date(Math.max(...t)) : null });
  return ok({ ...c, ...locale(a.shop), segment, total, chatWindowOpen: windowOpen(c), recommendation: await recommendationFor(a.shop.id, c.id, await getLoc()) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: { name?: string; area?: string | null; optedOut?: boolean; email?: string | null; note?: string | null } = {};
  if (typeof b.email === "string") data.email = b.email.trim() || null;
  if (typeof b.note === "string") data.note = b.note.trim().slice(0, 2000) || null;
  if (typeof b.name === "string" && b.name.trim().length >= 2) data.name = b.name.trim();
  if (typeof b.area === "string") data.area = b.area.trim() || null;
  if (typeof b.optedOut === "boolean") data.optedOut = b.optedOut;
  const r = await db.customer.updateMany({ where: { id, shopId: a.shop.id }, data });
  return r.count ? ok({ ok: true }) : fail("Not found", 404);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { id } = await params;
  const r = await db.customer.deleteMany({ where: { id, shopId: a.shop.id } });
  return r.count ? ok({ ok: true }) : fail("Not found", 404);
}
