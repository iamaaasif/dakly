import { apiAuth, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

/** { key } hides a notification for 3 days. */
export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const key = String((await req.json().catch(() => ({}))).key ?? "");
  if (!key) return fail("key লাগবে");
  const until = new Date(Date.now() + 3 * 86400000);
  await db.dismissedInsight.upsert({ where: { shopId_key: { shopId: a.shop.id, key } }, update: { until }, create: { shopId: a.shop.id, key, until } });
  return ok({ ok: true, until });
}
