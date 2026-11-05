import { db } from "./db";

export type Segment = "vip" | "regular" | "new" | "inactive";
export const SEGMENTS: Record<Segment, { label: string; desc: string }> = {
  vip: { label: "VIP", desc: "৳১৫,০০০+ কিনেছেন বা ৮+ Order" },
  regular: { label: "Regular", desc: "নিয়মিত কেনেন" },
  new: { label: "New", desc: "গত ৩০ দিনে প্রথম কেনাকাটা" },
  inactive: { label: "Inactive", desc: "৬০ দিনের বেশি কিছু কেনেননি" },
};
export const SEGMENT_KEYS = Object.keys(SEGMENTS) as Segment[];

export const RULES = { vipSpend: 15000, vipOrders: 8, newDays: 30, inactiveDays: 60 };

export type Stats = { total: number; count: number; first: Date | null; last: Date | null };

export function segmentOf(s: Stats, now = Date.now()): Segment {
  if (!s.count || !s.last) return "new";
  const day = 86400000;
  if (now - s.last.getTime() > RULES.inactiveDays * day) return "inactive";
  if (s.total >= RULES.vipSpend || s.count >= RULES.vipOrders) return "vip";
  if (s.first && now - s.first.getTime() <= RULES.newDays * day) return "new";
  return "regular";
}

export type CustomerRow = {
  id: string; name: string; phone: string; email: string | null; area: string | null;
  createdAt: Date; optedOut: boolean; stats: Stats; segment: Segment;
};

/** Loads every customer of a shop with order stats and segment. */
export async function loadCustomers(shopId: string): Promise<CustomerRow[]> {
  const [customers, agg] = await Promise.all([
    db.customer.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } }),
    db.order.groupBy({
      by: ["customerId"],
      where: { customer: { shopId } },
      _sum: { amount: true }, _count: { _all: true }, _min: { orderedAt: true }, _max: { orderedAt: true },
    }),
  ]);
  const byId = new Map(agg.map((a) => [a.customerId, a]));
  return customers.map((c) => {
    const a = byId.get(c.id);
    const stats: Stats = {
      total: a?._sum.amount ?? 0, count: a?._count._all ?? 0,
      first: a?._min.orderedAt ?? null, last: a?._max.orderedAt ?? null,
    };
    return { id: c.id, name: c.name, phone: c.phone, email: c.email, area: c.area, createdAt: c.createdAt, optedOut: c.optedOut, stats, segment: segmentOf(stats) };
  });
}

export function countBySegment(rows: CustomerRow[]) {
  const out: Record<Segment, number> = { vip: 0, regular: 0, new: 0, inactive: 0 };
  for (const r of rows) out[r.segment]++;
  return out;
}
