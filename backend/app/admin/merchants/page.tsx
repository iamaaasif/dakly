import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { usageByShop } from "@/lib/admin";
import { PLANS } from "@/lib/plans";
import { bn, tk, dateTimeBn } from "@/lib/format";

export default async function Merchants({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const me = await requireAdmin();
  if (!me.perms.merchants) redirect("/admin");
  const { q = "", f = "all" } = await searchParams;
  const rows = (await usageByShop())
    .filter((r) => f === "all" || (f === "pending" && !r.shop.approved) || (f === "suspended" && r.shop.suspended) || (f === "paid" && r.plan !== "free") || (f === "free" && r.plan === "free"))
    .filter((r) => !q || `${r.shop.name} ${r.shop.owner.email} ${r.shop.owner.name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.shop.createdAt.getTime() - a.shop.createdAt.getTime());
  const F = [["all", "সব"], ["pending", "অপেক্ষায়"], ["paid", "Paid"], ["free", "Free"], ["suspended", "স্থগিত"]];
  return (
    <>
      <h1>Merchants</h1>
      <form className="filters" action="/admin/merchants">
        <input className="input" name="q" defaultValue={q} placeholder="দোকান, নাম বা Email" aria-label="খুঁজুন" />
        <input type="hidden" name="f" value={f} />
        <button className="btn ghost sm">খুঁজুন</button>
      </form>
      <div className="chips">{F.map(([k, l]) => <Link key={k} className={`chip ${f === k ? "on" : ""}`} href={`/admin/merchants?${new URLSearchParams({ f: k, q })}`}>{l}</Link>)}</div>
      <div className="tbl-wrap"><table className="tbl num">
        <thead><tr><th>দোকান</th><th>Owner</th><th>Plan</th><th>Customer</th><th>Message (মাস)</th><th>AI</th><th>খরচ</th><th>যোগ দিয়েছে</th><th>অবস্থা</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.shop.id}>
            <td><Link href={`/admin/merchants/${r.shop.id}`} style={{ fontWeight: 600, color: "var(--accent)" }}>{r.shop.name}</Link></td>
            <td>{r.shop.owner.name}<br /><span className="muted">{r.shop.owner.email}</span></td>
            <td>{PLANS[r.plan].name}{r.shop.planUntil && r.plan !== "free" ? <><br /><span className="muted">{dateTimeBn(r.shop.planUntil)}</span></> : null}</td>
            <td>{bn(r.shop._count.customers)}</td><td>{bn(r.wa + r.sms + r.voice)}</td><td>{bn(r.ai)}</td><td>{tk(r.cost)}</td>
            <td>{dateTimeBn(r.shop.createdAt)}</td>
            <td>{r.shop.suspended ? <span className="pill bad">স্থগিত</span> : !r.shop.approved ? <span className="pill warn">অপেক্ষায়</span> : <span className="pill ok">চালু</span>}</td>
          </tr>
        ))}</tbody>
      </table></div>
      {!rows.length && <p className="muted">কিছু পাওয়া যায়নি।</p>}
    </>
  );
}
