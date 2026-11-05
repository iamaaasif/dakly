import "server-only";
import type { Shop } from "@prisma/client";
import { db } from "./db";
import { localHour, tzOffset, type Loc } from "./i18n";

/**
 * Best time to reach this shop's customers: the 2-hour window (shop's time zone) when they
 * order and reply most. Uses order times plus WhatsApp read/interested updates.
 * Orders imported without a time of day (exactly midnight UTC) are ignored.
 */
export async function bestTime(shop: Pick<Shop, "id" | "timezone">, loc: Loc) {
  const { t, f } = loc;
  const since = new Date(Date.now() - 180 * 86400000);
  const [orders, reads] = await Promise.all([
    db.order.findMany({ where: { customer: { shopId: shop.id }, orderedAt: { gte: since } }, select: { orderedAt: true } }),
    db.campaignMessage.findMany({ where: { campaign: { shopId: shop.id }, status: { in: ["read", "interested"] }, updatedAt: { gte: since } }, select: { updatedAt: true } }),
  ]);
  const hist = new Array(24).fill(0);
  for (const o of orders) {
    const d = o.orderedAt;
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) continue;
    hist[localHour(shop.timezone, d)] += 1;
  }
  for (const r of reads) hist[localHour(shop.timezone, r.updatedAt)] += 2;
  const samples = hist.reduce((a, b) => a + b, 0);
  let best = 20, bestScore = -1;
  for (let h = 8; h <= 22; h++) {
    const s = hist[h] + hist[(h + 1) % 24];
    if (s > bestScore) { bestScore = s; best = h; }
  }
  const enough = samples >= 10;
  const h = enough ? best : 20;
  return {
    hour: h,
    label: t("{a} থেকে {b}", { a: f.hour(h), b: f.hour((h + 2) % 24) }),
    basedOn: enough ? t("{n}টি Order ও Reply-এর সময় দেখে", { n: samples }) : t("সাধারণভাবে সন্ধ্যার পর সাড়া বেশি (আপনার Data কম, তাই)"),
    hist,
  };
}

/** Next occurrence of `hour`:00 in time zone tz (at least 10 minutes from now), as an ISO string. */
export function nextAt(hour: number, tz: string) {
  const now = Date.now();
  for (let day = 0; day < 3; day++) {
    const base = new Date(now + day * 86400000);
    const off = tzOffset(tz, base);
    const local = new Date(base.getTime() + off);
    const atUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour, 0, 0) - off;
    if (atUtc > now + 10 * 60000) return new Date(atUtc).toISOString();
  }
  return new Date(now + 86400000).toISOString();
}
