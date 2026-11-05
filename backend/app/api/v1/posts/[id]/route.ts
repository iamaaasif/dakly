import { apiAuth, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

/** Cancels a scheduled post. */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { id } = await params;
  const r = await db.post.updateMany({ where: { id, shopId: a.shop.id, status: "scheduled" }, data: { status: "draft" } });
  return r.count ? ok({ ok: true }) : fail("পাওয়া যায়নি", 404);
}
