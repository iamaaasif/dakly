import { apiAuth, ok } from "@/lib/api";
import { dailyTips, tipHref } from "@/lib/ai-insights";
import { buildInsights } from "@/lib/insights";
import { loadCustomers } from "@/lib/segments";
import { getLoc } from "@/lib/i18n/server";

/** ?refresh=1 regenerates today's AI tips (counts toward the AI limit). action.href / campaignHref are web paths: /campaigns/new?segment=..&offer=.. */
export async function GET(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const [tips, notifications] = await Promise.all([dailyTips(a.shop, { refresh }), buildInsights(a.shop.id, await loadCustomers(a.shop.id), await getLoc())]);
  return ok({ aiTips: { ...tips, tips: tips.tips.map((t) => ({ ...t, campaignHref: tipHref(t) })) }, notifications });
}
