import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { env, fbAppReady } from "@/lib/config";
import { paymentsReady } from "@/lib/billing";
import { bn, dateTimeBn } from "@/lib/format";
import { runSchedulerNow, clearErrors, runSelfCheckNow, sendTestEmail } from "../actions";
import { lastSelfCheck } from "@/lib/selfcheck-store";
import { checkEnv } from "@/lib/envcheck";

export default async function System({ searchParams }: { searchParams: Promise<{ src?: string; mail?: string }> }) {
  const me = await requireAdmin();
  if (!me.perms.system) redirect("/admin");
  const { src = "", mail } = await searchParams;
  const check = await lastSelfCheck();
  const envNow = checkEnv();
  const day = new Date(Date.now() - 86400000);
  const [tick, queued, failed24, overduePosts, overdueCamps, errors, bySource] = await Promise.all([
    db.systemState.findUnique({ where: { key: "scheduler.lastTick" } }),
    db.campaignMessage.count({ where: { status: { in: ["queued", "sending"] } } }),
    db.campaignMessage.count({ where: { status: "failed", updatedAt: { gte: day } } }),
    db.post.count({ where: { status: "scheduled", scheduledAt: { lt: new Date(Date.now() - 5 * 60000) } } }),
    db.campaign.count({ where: { status: "scheduled", sendAt: { lt: new Date(Date.now() - 5 * 60000) } } }),
    db.errorLog.findMany({ where: src ? { source: src } : {}, orderBy: { createdAt: "desc" }, take: 100 }),
    db.errorLog.groupBy({ by: ["source"], where: { createdAt: { gte: day } }, _count: { _all: true } }),
  ]);
  let dbOk = true; try { await db.$queryRaw`SELECT 1`; } catch { dbOk = false; }
  const age = tick ? Math.round((Date.now() - new Date(tick.value).getTime()) / 1000) : null;
  const providers: [string, boolean][] = [
    ["OpenAI", !!env("OPENAI_API_KEY")], ["WhatsApp (Dakly)", !!(env("WA_PHONE_NUMBER_ID") && env("WA_ACCESS_TOKEN") && env("WA_TEMPLATE_NAME"))], ["WhatsApp webhook secret", !!env("WA_APP_SECRET")],
    ["SMS (Dakly)", !!(env("SMS_API_URL") && env("SMS_API_KEY"))], ["Twilio", !!(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN"))], ["Facebook Login", fbAppReady()],
    ["SSLCommerz (BD)", paymentsReady({ currency: "BDT" })], ["Stripe (international)", paymentsReady({ currency: "USD" }) && !!env("STRIPE_WEBHOOK_SECRET")], ["SMTP Email", !!env("SMTP_HOST")], ["APP_URL https", (process.env.APP_URL || "").startsWith("https://")],
  ];
  const Pill = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => <span className={`pill ${ok ? "ok" : "bad"}`}>{children}</span>;
  return (
    <>
      <div className="top-row"><h1>System</h1><form action={runSchedulerNow}><button className="btn ghost sm">Scheduler এখনই চালান</button></form></div>
      <div className="kpis">
        <div className="stat"><span>Database</span><b><Pill ok={dbOk}>{dbOk ? "ঠিক আছে" : "সমস্যা"}</Pill></b></div>
        <div className="stat"><span>Scheduler শেষ চলেছে</span><b><Pill ok={age !== null && age < 180}>{age === null ? "কখনো না" : `${bn(age)} সেকেন্ড আগে`}</Pill></b><span>প্রতি মিনিটে চলার কথা</span></div>
        <div className="stat"><span>পাঠানোর অপেক্ষায়</span><b className="num">{bn(queued)}</b><span>দেরি: {bn(overdueCamps)} Campaign, {bn(overduePosts)} Post</span></div>
        <div className="stat"><span>ব্যর্থ Message (২৪ ঘণ্টা)</span><b className="num">{bn(failed24)}</b></div>
      </div>
      {mail && <div className={mail === "ok" ? "okmsg" : "err"}>{mail === "ok" ? "Test Email পাঠানো হয়েছে। Inbox দেখুন।" : "Email যায়নি। নিচের Email লাইন আর Error log দেখুন।"}</div>}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="selfcheck">
        <div className="sec-h"><h3>Self-check (.env আর Provider Key)</h3>
          <div className="row-btns"><form action={runSelfCheckNow}><button className="btn ghost sm">এখনই যাচাই করুন</button></form><form action={sendTestEmail}><button className="btn ghost sm">Test Email পাঠান</button></form></div></div>
        <p className="muted">প্রতিবার App চালু হলে নিজে থেকে চলে। শেষ যাচাই: {check ? dateTimeBn(new Date(check.at)) : "এখনো হয়নি"}। Terminal থেকে: <code>docker compose exec app npm run doctor</code></p>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>অবস্থা</th><th>অংশ</th><th>Setting</th><th>কী দেখা গেল</th></tr></thead>
          <tbody>{[...envNow, ...(check?.live ?? [])].map((c, i) => <tr key={i}><td><Pill ok={c.level === "ok"}>{c.level === "ok" ? "ঠিক" : c.level === "off" ? "বন্ধ" : c.level === "warn" ? "সতর্কতা" : "সমস্যা"}</Pill></td><td>{c.group}</td><td><code>{c.key}</code></td><td style={{ whiteSpace: "normal", minWidth: 260 }}>{c.message}</td></tr>)}</tbody></table></div>
        <div className="row-btns">{providers.map(([n, ok]) => <Pill key={n} ok={ok}>{n}: {ok ? "আছে" : "নেই"}</Pill>)}</div>
        <p className="muted">"বন্ধ" মানে .env-এ মান নেই। সেই Channel Test mode-এ চলে, কিছু পাঠানো হয় না।</p>
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="sec-h"><h3>Error log</h3><form action={clearErrors}><button className="btn ghost sm">১ ঘণ্টার পুরোনো মুছুন</button></form></div>
        <div className="chips"><Link className={`chip ${!src ? "on" : ""}`} href="/admin/system">সব</Link>{bySource.map((b) => <Link key={b.source} className={`chip ${src === b.source ? "on" : ""}`} href={`/admin/system?src=${b.source}`}>{b.source} · {bn(b._count._all)}</Link>)}</div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>সময়</th><th>উৎস</th><th>দোকান</th><th>Error</th></tr></thead>
          <tbody>{errors.map((e) => <tr key={e.id}><td className="num">{dateTimeBn(e.createdAt)}</td><td>{e.source}</td><td>{e.shopId ? <Link href={`/admin/merchants/${e.shopId}`} style={{ color: "var(--accent)" }}>দেখুন</Link> : "—"}</td><td style={{ whiteSpace: "normal", minWidth: 260 }}>{e.message}</td></tr>)}</tbody></table></div>
        {!errors.length && <p className="muted">কোনো Error নেই।</p>}
      </div>
    </>
  );
}
