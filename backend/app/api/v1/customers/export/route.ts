import { apiAuth } from "@/lib/api";
import { loadCustomers } from "@/lib/segments";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** All customers as CSV (opens in Excel): name, phone, email, area, segment, orders, total, last order, opted out. */
export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const rows = await loadCustomers(a.shop.id);
  const head = ["name", "phone", "email", "area", "segment", "orders", `total_${a.shop.currency}`, "last_order", "opted_out", "added"];
  const lines = rows.map((r) => [r.name, "+" + r.phone, r.email, r.area, r.segment, r.stats.count, r.stats.total, r.stats.last?.toISOString().slice(0, 10), r.optedOut ? "yes" : "no", r.createdAt.toISOString().slice(0, 10)].map(cell).join(","));
  return new Response("﻿" + [head.join(","), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="dakly-customers-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
