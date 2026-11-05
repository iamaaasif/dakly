import { apiAuth, ok, fail } from "@/lib/api";
import { choosePage } from "@/app/actions";
import { db } from "@/lib/db";

/** { pageId } picks which connected Page posts go to. */
export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const pageId = String((await req.json().catch(() => ({}))).pageId ?? "");
  const fd = new FormData(); fd.set("page", pageId);
  await choosePage(fd);
  const s = await db.shop.findUnique({ where: { id: a.shop.id } });
  return s?.fbPageId === pageId ? ok({ ok: true }) : fail("Page পাওয়া যায়নি", 404);
}
