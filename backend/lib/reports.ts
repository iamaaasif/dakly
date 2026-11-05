import "server-only";
import { tzOffset } from "./i18n";
import { db } from "./db";
import { loadCustomers, countBySegment } from "./segments";

const day = 86400000;
// Weeks start on Saturday in Bangladesh and much of the Gulf, Monday elsewhere (Sunday in the US/CA)
const WEEK_START: Record<string, number> = { BD: 6, AE: 6, SA: 6, QA: 6, US: 0, CA: 0 };
const weekStartFn = (tz: string, country: string) => (t: number) => {
  const off = tzOffset(tz, new Date(t));
  const ws = WEEK_START[country] ?? 1;
  const d = new Date(t + off); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - ws + 7) % 7));
  return d.getTime() - off;
};

export async function dashboardData(shop: { id: string; timezone: string; country: string }) {
  const shopId = shop.id;
  const weekStart = weekStartFn(shop.timezone, shop.country);
  const now = Date.now();
  const rows = await loadCustomers(shopId);
  const orders = await db.order.findMany({ where: { customer: { shopId } }, select: { customerId: true, amount: true, orderedAt: true }, orderBy: { orderedAt: "asc" } });
  const seen = new Set<string>();
  const tagged = orders.map((o) => { const repeat = seen.has(o.customerId); seen.add(o.customerId); return { ...o, repeat, t: o.orderedAt.getTime() }; });

  const first = weekStart(now) - 11 * 7 * day;
  const weeks = Array.from({ length: 12 }, (_, i) => ({ start: new Date(first + i * 7 * day), fresh: 0, repeat: 0 }));
  for (const o of tagged) {
    if (o.t < first) continue;
    const i = Math.min(11, Math.floor((o.t - first) / (7 * day)));
    if (o.repeat) weeks[i].repeat += o.amount; else weeks[i].fresh += o.amount;
  }

  const in30 = tagged.filter((o) => o.t > now - 30 * day);
  const prev30 = tagged.filter((o) => o.t <= now - 30 * day && o.t > now - 60 * day);
  const sum = (a: { amount: number }[]) => a.reduce((x, o) => x + o.amount, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonthRepeat = tagged.filter((o) => o.repeat && o.t >= monthStart.getTime());

  const campaigns = await db.campaign.findMany({
    where: { shopId, status: "sent" }, orderBy: { sentAt: "desc" }, take: 8,
    include: { messages: { select: { customerId: true, status: true } } },
  });
  const perf = campaigns.map((c) => {
    const ids = new Set(c.messages.map((m) => m.customerId));
    const from = c.sentAt!.getTime(), to = from + 7 * day;
    const won = tagged.filter((o) => ids.has(o.customerId) && o.t > from && o.t <= to);
    const reached = c.messages.filter((m) => ["sent", "delivered", "read", "interested"].includes(m.status)).length;
    return {
      id: c.id, name: c.name, segment: c.segment, sentAt: c.sentAt!, recipients: c.messages.length, reached,
      read: c.messages.filter((m) => ["read", "interested"].includes(m.status)).length,
      orders: won.length, buyers: new Set(won.map((o) => o.customerId)).size, revenue: sum(won),
    };
  });

  return {
    kpi: {
      sales30: sum(in30), salesPrev30: sum(prev30), orders30: in30.length,
      avgOrder: in30.length ? Math.round(sum(in30) / in30.length) : 0,
      repeatShare: in30.length ? Math.round((in30.filter((o) => o.repeat).length / in30.length) * 100) : 0,
      returnedThisMonth: new Set(thisMonthRepeat.map((o) => o.customerId)).size,
      repeatSalesThisMonth: sum(thisMonthRepeat),
      customers: rows.length,
      active: rows.filter((r) => r.stats.last && now - r.stats.last.getTime() <= 60 * day).length,
      campaignRevenue: perf.reduce((a, p) => a + p.revenue, 0),
    },
    weeks, segments: countBySegment(rows), campaigns: perf,
  };
}
