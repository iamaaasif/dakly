import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { paymentsReady } from "@/lib/billing";
import { bn, tk, dateTimeBn } from "@/lib/format";

export default async function Payments({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const me = await requireAdmin();
  if (!me.perms.billing) redirect("/admin");
  const { s = "all" } = await searchParams;
  const list = await db.payment.findMany({ where: s === "all" ? {} : { status: s }, orderBy: { createdAt: "desc" }, take: 200, include: { shop: { select: { name: true } } } });
  const total = list.filter((p) => ["paid", "manual"].includes(p.status) && p.currency === "BDT").reduce((a, p) => a + p.amount, 0);
  return (
    <>
      <h1>Payments</h1>
      {!paymentsReady() && <div className="err">SSLCommerz-এর Key দেওয়া নেই, তাই Merchant-রা Online Payment করতে পারবেন না। Manual Payment Merchant-এর পাতা থেকে যোগ করুন।</div>}
      <div className="chips">{[["all", "সব"], ["paid", "সফল"], ["manual", "Manual"], ["pending", "অপেক্ষায়"], ["failed", "ব্যর্থ"], ["cancelled", "বাতিল"]].map(([k, l]) => <Link key={k} className={`chip ${s === k ? "on" : ""}`} href={`/admin/payments?s=${k}`}>{l}</Link>)}</div>
      <p className="muted">দেখানো Payment-এ মোট আদায়: <b>{tk(total)}</b></p>
      <div className="tbl-wrap"><table className="tbl num">
        <thead><tr><th>তারিখ</th><th>দোকান</th><th>Plan</th><th>টাকা</th><th>অবস্থা</th><th>Method</th><th>Transaction</th><th>নোট</th></tr></thead>
        <tbody>{list.map((p) => (
          <tr key={p.id}><td>{dateTimeBn(p.createdAt)}</td><td><Link href={`/admin/merchants/${p.shopId}`} style={{ color: "var(--dak)" }}>{p.shop.name}</Link></td><td>{p.plan} × {bn(p.months)}</td><td>{p.currency === "BDT" ? tk(p.amount) : `${p.amount} ${p.currency}`}</td>
            <td><span className={`pill ${p.status === "paid" || p.status === "manual" ? "ok" : p.status === "pending" ? "warn" : "bad"}`}>{p.status}</span></td><td>{p.method ?? "—"}</td><td>{p.tranId}</td><td>{p.note ?? ""}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
