import { apiAuth, ok, out, fail } from "@/lib/api";
import { saveKnowledge, deleteKnowledge } from "@/lib/services";
import { db } from "@/lib/db";

type P = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: P) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const k = await db.knowledgeItem.findFirst({ where: { id: (await params).id, shopId: a.shop.id } });
  return k ? ok(k) : fail("পাওয়া যায়নি", 404);
}
/** Full or partial update: { type?, title?, body?, price?, active? } */
export async function PATCH(req: Request, { params }: P) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { id } = await params;
  const cur = await db.knowledgeItem.findFirst({ where: { id, shopId: a.shop.id } });
  if (!cur) return fail("পাওয়া যায়নি", 404);
  const b = await req.json().catch(() => ({}));
  return out(await saveKnowledge(a.shop, { type: cur.type, title: cur.title, body: cur.body, price: cur.price, active: cur.active, ...b }, id));
}
export async function DELETE(_: Request, { params }: P) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return (await deleteKnowledge(a.shop, (await params).id)) ? ok({ ok: true }) : fail("পাওয়া যায়নি", 404);
}
