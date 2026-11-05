import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { mrr, usageByShop } from "@/lib/admin";
import { monthStart } from "@/lib/usage";
import { bn, tk } from "@/lib/format";
import { StackedBars } from "@/components/Charts";
import { makeLoc } from "@/lib/i18n";
const LOC = makeLoc({ lang: "bn", currency: "BDT", tz: "Asia/Dhaka", country: "BD" });
import { activePlan } from "@/lib/plans";

export default async function Overview() {
  await requireAdmin();
  const since = monthStart();
  const [shops, pending, suspended, openTickets, payMonth, usage, lastTick, errors24, signups, pays] = await Promise.all([
    db.shop.findMany({ select: { plan: true, planUntil: true, createdAt: true } }),
    db.shop.count({ where: { approved: false } }),
    db.shop.count({ where: { suspended: true } }),
    db.ticket.count({ where: { status: "open" } }),
    db.payment.aggregate({ where: { status: { in: ["paid", "manual"] }, paidAt: { gte: since } }, _sum: { amount: true } }),
    usageByShop(),
    db.systemState.findUnique({ where: { key: "scheduler.lastTick" } }),
    db.errorLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    db.shop.findMany({ where: { createdAt: { gte: new Date(Date.now() - 84 * 86400000) } }, select: { createdAt: true } }),
    db.payment.findMany({ where: { status: { in: ["paid", "manual"] }, paidAt: { gte: new Date(Date.now() - 84 * 86400000) } }, select: { paidAt: true, amount: true } }),
  ]);
  const paid = shops.filter((s) => activePlan(s) !== "free").length;
  const msgs = usage.reduce((a, u) => a + u.wa + u.sms + u.voice, 0);
  const ai = usage.reduce((a, u) => a + u.ai, 0);
  const cost = usage.reduce((a, u) => a + u.cost, 0);
  const tickOk = lastTick && Date.now() - new Date(lastTick.value).getTime() < 3 * 60000;
  const start = Date.now() - 84 * 86400000;
  const weeks = Array.from({ length: 12 }, (_, i) => ({ label: bn(i + 1), values: [0, 0] }));
  for (const s of signups) weeks[Math.min(11, Math.floor((s.createdAt.getTime() - start) / (7 * 86400000)))].values[0]++;
  const rev = Array.from({ length: 12 }, (_, i) => ({ label: bn(i + 1), values: [0] }));
  for (const p of pays) rev[Math.min(11, Math.floor((p.paidAt!.getTime() - start) / (7 * 86400000)))].values[0] += p.amount;
  return (
    <>
      <h1>Overview</h1>
      <div className="row-btns">
        {pending > 0 && <Link className="pill warn" href="/admin/merchants?f=pending">{bn(pending)} জন Merchant অনুমোদনের অপেক্ষায়</Link>}
        {openTickets > 0 && <Link className="pill warn" href="/admin/tickets">{bn(openTickets)}টি Ticket খোলা</Link>}
        <Link className={`pill ${tickOk ? "ok" : "bad"}`} href="/admin/system">Scheduler {tickOk ? "চলছে" : "বন্ধ!"}</Link>
        {errors24 > 0 && <Link className="pill bad" href="/admin/system">২৪ ঘণ্টায় {bn(errors24)}টি Error</Link>}
      </div>
      <div className="kpis">
        <div className="stat"><span>মোট Merchant</span><b className="num">{bn(shops.length)}</b><span>{bn(paid)} জন Paid · {bn(suspended)} স্থগিত</span></div>
        <div className="stat"><span>MRR</span><b className="num">{tk(mrr(shops))}</b><span>চালু Paid Plan-এর মাসিক মূল্য</span></div>
        <div className="stat"><span>এই মাসের আয়</span><b className="num">{tk(payMonth._sum.amount ?? 0)}</b><span>Online + Manual Payment</span></div>
        <div className="stat"><span>এই মাসের খরচ (আনুমানিক)</span><b className="num">{tk(cost)}</b><span>{bn(msgs)} Message · {bn(ai)} AI</span></div>
      </div>
      <div className="grid2">
        <div className="card"><h3 style={{ fontSize: 17, marginBottom: 8 }}>নতুন Merchant (১২ সপ্তাহ)</h3><StackedBars loc={LOC} data={weeks.map((w) => ({ ...w, values: [w.values[0]] }))} series={[{ name: "Sign-up", color: "var(--sky)" }]} /></div>
        <div className="card"><h3 style={{ fontSize: 17, marginBottom: 8 }}>আয় (১২ সপ্তাহ)</h3><StackedBars loc={LOC} data={rev} series={[{ name: "Payment", color: "var(--leaf)" }]} /></div>
      </div>
    </>
  );
}
