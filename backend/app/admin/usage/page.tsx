import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { usageByShop, COSTS } from "@/lib/admin";
import { PLANS } from "@/lib/plans";
import { bn, tk } from "@/lib/format";

export default async function Usage() {
  const me = await requireAdmin();
  if (!me.perms.billing) redirect("/admin");
  const rows = (await usageByShop()).sort((a, b) => b.cost - a.cost);
  const sum = (k: "wa" | "sms" | "voice" | "ai" | "cost" | "paid") => rows.reduce((a, r) => a + r[k], 0);
  const plan = rows.reduce((a, r) => a + PLANS[r.plan].price, 0);
  return (
    <>
      <h1>Usage ও খরচ (এই মাস)</h1>
      <p className="muted">খরচ আনুমানিক: WhatsApp ৳{COSTS.wa}, SMS ৳{COSTS.sms}, Voice Call ৳{COSTS.voice}, AI ৳{COSTS.ai} প্রতি একক। .env-এ COST_*_BDT বদলে ঠিক করুন।</p>
      <div className="kpis">
        <div className="stat"><span>WhatsApp</span><b className="num">{bn(sum("wa"))}</b><span>{tk(sum("wa") * COSTS.wa)}</span></div>
        <div className="stat"><span>SMS</span><b className="num">{bn(sum("sms"))}</b><span>{tk(sum("sms") * COSTS.sms)}</span></div>
        <div className="stat"><span>Voice Call</span><b className="num">{bn(sum("voice"))}</b><span>{tk(sum("voice") * COSTS.voice)}</span></div>
        <div className="stat"><span>AI</span><b className="num">{bn(sum("ai"))}</b><span>{tk(sum("ai") * COSTS.ai)}</span></div>
      </div>
      <div className="card"><b>মোট খরচ {tk(sum("cost"))}</b> · এই মাসে আদায় {tk(sum("paid"))} · Plan মূল্য (MRR) {tk(plan)} · মার্জিন {tk(plan - sum("cost"))}</div>
      <div className="tbl-wrap"><table className="tbl num">
        <thead><tr><th>দোকান</th><th>Plan</th><th>WA</th><th>SMS</th><th>Call</th><th>AI</th><th>খরচ</th><th>Plan মূল্য</th><th>লাভ/ক্ষতি</th></tr></thead>
        <tbody>{rows.filter((r) => r.cost || r.paid).map((r) => {
          const margin = PLANS[r.plan].price - r.cost;
          return <tr key={r.shop.id}><td><Link href={`/admin/merchants/${r.shop.id}`} style={{ color: "var(--accent)" }}>{r.shop.name}</Link></td><td>{PLANS[r.plan].name}</td><td>{bn(r.wa)}</td><td>{bn(r.sms)}</td><td>{bn(r.voice)}</td><td>{bn(r.ai)}</td><td>{tk(r.cost)}</td><td>{tk(PLANS[r.plan].price)}</td><td style={{ color: margin >= 0 ? "var(--leaf)" : "var(--bad)", fontWeight: 700 }}>{tk(margin)}</td></tr>;
        })}</tbody>
      </table></div>
    </>
  );
}
