import { db } from "@/lib/db";
import { apiAuth, ok, out } from "@/lib/api";
import { schedulePost } from "@/lib/services";

export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return ok({ items: await db.post.findMany({ where: { shopId: a.shop.id }, orderBy: { createdAt: "desc" }, take: 100 }) });
}

export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return out(await schedulePost(a.shop, await req.json().catch(() => ({}))), 201);
}
