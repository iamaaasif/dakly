import { after } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, ok, out } from "@/lib/api";
import { createCampaign } from "@/lib/services";

export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const list = await db.campaign.findMany({ where: { shopId: a.shop.id }, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { messages: true } } } });
  return ok({ items: list.map(({ _count, ...c }) => ({ ...c, recipients: _count.messages })) });
}

export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return out(await createCampaign(a.shop, await req.json().catch(() => ({})), after), 201);
}
