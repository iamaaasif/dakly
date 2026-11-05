import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { usageByShop } from "@/lib/admin";
import { PLANS, activePlan, messageLimit } from "@/lib/plans";
import { channelConfig } from "@/lib/config";
import { bn, tk, dateTimeBn } from "@/lib/format";
import { approveShop, suspendShop, unsuspendShop, toggleUserLogin, sendResetLink, deleteShop } from "../../actions";
import { PlanForm, LimitForm } from "../../forms";

export default async function MerchantPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  if (!me.perms.merchants) redirect("/admin");
  const { id } = await params;
  const s = await db.shop.findUnique({
    where: { id },
    include: {
      owner: true, _count: { select: { customers: true, campaigns: true, posts: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 10 }, ticketList: { orderBy: { updatedAt: "desc" }, take: 5 },
      campaigns: { orderBy: { createdAt: "desc" }, take: 5, include: { _count: { select: { messages: true } } } },
    },
  });
  if (!s) notFound();
  const u = (await usageByShop()).find((r) => r.shop.id === id)!;
  const errors = await db.errorLog.findMany({ where: { shopId: id }, orderBy: { createdAt: "desc" }, take: 8 });
  const cfg = channelConfig(s);
  const plan = activePlan(s);
  return (
    <>
      <div className="top-row">
        <div><h1>{s.name}</h1><p className="muted">{s.owner.name} · {s.owner.email} · যোগ দিয়েছেন {dateTimeBn(s.createdAt)}</p></div>
        <div>{s.suspended ? <span className="pill bad">স্থগিত</span> : !s.approved ? <span className="pill warn">অনুমোদনের অপেক্ষায়</span> : <span className="pill ok">চালু</span>}</div>
      </div>
      <div className="kpis">
        <div className="stat"><span>Plan</span><b>{PLANS[plan].name}</b><span>{plan !== "free" && s.planUntil ? `${dateTimeBn(s.planUntil)} পর্যন্ত` : "—"}</span></div>
        <div className="stat"><span>Message এই মাসে</span><b className="num">{bn(u.wa + u.sms + u.voice)} / {bn(messageLimit(s))}</b><span>WA {bn(u.wa)} · SMS {bn(u.sms)} · Call {bn(u.voice)}</span></div>
        <div className="stat"><span>AI এই মাসে</span><b className="num">{bn(u.ai)}</b><span>সীমা {bn(PLANS[plan].ai)}</span></div>
        <div className="stat"><span>খরচ / আয় (মাস)</span><b className="num">{tk(u.cost)} / {tk(u.paid)}</b><span>{bn(s._count.customers)} Customer · {bn(s._count.campaigns)} Campaign</span></div>
      </div>
      {me.perms.manageMerchants && (
        <div className="card form">
          <h3 style={{ fontSize: 17 }}>Account</h3>
          <div className="row-btns">
            {!s.approved && <form action={approveShop.bind(null, s.id)}><button className="btn primary">অনুমোদন দিন</button></form>}
            {s.suspended ? <form action={unsuspendShop.bind(null, s.id)}><button className="btn primary">আবার চালু করুন</button></form> : null}
            <form action={toggleUserLogin.bind(null, s.ownerId)}><button className="btn ghost">{s.owner.disabled ? "Login চালু করুন" : "Login বন্ধ করুন"}</button></form>
            <form action={sendResetLink.bind(null, s.ownerId)}><button className="btn ghost">Password Reset Link পাঠান</button></form>
          </div>
          {!s.suspended && (
            <form action={suspendShop.bind(null, s.id)} className="row-btns">
              <input className="input" name="reason" placeholder="স্থগিত করার কারণ (Merchant দেখবেন)" style={{ flex: 1, minWidth: 200 }} aria-label="কারণ" />
              <button className="btn ghost" style={{ color: "var(--dak)" }}>স্থগিত করুন</button>
            </form>
          )}
          {s.suspendedReason && <p className="muted">কারণ: {s.suspendedReason}</p>}
          <details>
            <summary className="muted" style={{ cursor: "pointer" }}>দোকান চিরতরে মুছুন</summary>
            <form action={deleteShop.bind(null, s.id)} className="row-btns" style={{ marginTop: 8 }}>
              <input className="input" name="confirm" placeholder={`নিশ্চিত করতে লিখুন: ${s.name}`} style={{ flex: 1, minWidth: 200 }} aria-label="দোকানের নাম" />
              <button className="btn ghost" style={{ color: "var(--dak)" }}>সব Data মুছে ফেলুন</button>
            </form>
          </details>
        </div>
      )}
      <div className="actions-grid">
        {me.perms.billing && <div className="card form"><h3 style={{ fontSize: 17 }}>Plan বদলান / মেয়াদ বাড়ান</h3><PlanForm shopId={s.id} /></div>}
        {me.perms.billing && <div className="card form"><h3 style={{ fontSize: 17 }}>Message সীমা</h3><LimitForm shopId={s.id} value={s.limitOverride} />
          <h3 style={{ fontSize: 17, marginTop: 8 }}>Channel</h3>
          <p className="muted">WhatsApp: {cfg.wa ? (cfg.wa.own ? "নিজের" : "Dakly") : "নেই"} · SMS: {cfg.sms ? (cfg.sms.own ? "নিজের" : "Dakly") : "নেই"} · Call: {cfg.voice ? "আছে" : "নেই"} · Facebook: {cfg.fb ? cfg.fb.name : "নেই"} · Store: {s.storeType ?? "নেই"}{s.storeError ? ` (সমস্যা: ${s.storeError})` : ""}</p>
        </div>}
      </div>
      <div className="actions-grid">
        <div className="card"><h3 style={{ fontSize: 17, marginBottom: 6 }}>Payment</h3>
          {s.payments.length ? s.payments.map((p) => <div key={p.id} className="muted num">{dateTimeBn(p.createdAt)} · {p.plan} × {bn(p.months)} · {p.currency === "BDT" ? tk(p.amount) : `${p.amount} ${p.currency}`} · {p.provider} · {p.status} · {p.tranId}{p.note ? ` · ${p.note}` : ""}</div>) : <p className="muted">নেই</p>}</div>
        <div className="card"><h3 style={{ fontSize: 17, marginBottom: 6 }}>সাম্প্রতিক Campaign</h3>
          {s.campaigns.length ? s.campaigns.map((c) => <div key={c.id} className="muted">{dateTimeBn(c.createdAt)} · {c.name} · {bn(c._count.messages)} জন · {c.status}</div>) : <p className="muted">নেই</p>}</div>
        <div className="card"><h3 style={{ fontSize: 17, marginBottom: 6 }}>Support Ticket</h3>
          {s.ticketList.length ? s.ticketList.map((t) => <div key={t.id}><Link href={`/admin/tickets/${t.id}`} style={{ color: "var(--dak)" }}>{t.subject}</Link> <span className="muted">· {t.status}</span></div>) : <p className="muted">নেই</p>}</div>
        <div className="card"><h3 style={{ fontSize: 17, marginBottom: 6 }}>সাম্প্রতিক Error</h3>
          {errors.length ? errors.map((e) => <div key={e.id} className="muted">{dateTimeBn(e.createdAt)} · {e.source}: {e.message.slice(0, 120)}</div>) : <p className="muted">নেই</p>}</div>
      </div>
    </>
  );
}
