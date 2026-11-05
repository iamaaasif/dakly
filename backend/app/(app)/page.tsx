import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadCustomers, SEGMENTS, SEGMENT_KEYS } from "@/lib/segments";
import { buildInsights } from "@/lib/insights";
import { cachedTips, tipHref } from "@/lib/ai-insights";
import { dashboardData } from "@/lib/reports";
import { getLoc } from "@/lib/i18n/server";
import { localHour } from "@/lib/i18n";
import { unreadCount } from "@/lib/inbox";
import { Icon } from "@/components/Icon";
import { StackedBars, Delta } from "@/components/Charts";
import { Announcements } from "@/components/Announcements";
import { refreshTips } from "@/app/actions";
import { aiEnabled } from "@/lib/ai";
import { Onboarding } from "@/components/Onboarding";

const COL = { vip: "var(--haldi)", regular: "var(--sky)", new: "var(--leaf)", inactive: "var(--bad)" };

export default async function Home() {
  const { user, shop } = await requireShop();
  const rows = await loadCustomers(shop.id);
  const loc = await getLoc();
  const { t, f } = loc;
  const bn = f.n, tk = f.money;
  const hour = localHour(shop.timezone);
  const greet = t(hour < 12 ? "শুভ সকাল" : hour < 17 ? "শুভ দুপুর" : "শুভ সন্ধ্যা");
  const name = user.name.split(" ")[0];

  if (!rows.length)
    return (
      <>
        <Announcements shop={shop} />
        <div className="greet"><h2>{greet}, {name}</h2><p>{t("প্রথমে আপনার Customer-দের Dakly-তে আনুন।")}</p></div>
        <Onboarding shop={shop} />
        <div className="hero">
          <span className="tag"><Icon name="spark" size={14} /> {t("শুরু করুন")}</span>
          <h3>{t("পুরোনো Customer List Upload করুন")}</h3>
          <p>{t("Excel থেকে একবারে, Online Store Connect করে, অথবা মুখে বলে বা নিজে লিখে। Dakly তারপর VIP, Regular, New আর Inactive আলাদা করে দেবে, আর প্রতিদিন বলবে কাকে কী Offer দেবেন।")}</p>
          <div className="actions"><Link className="btn primary" href="/customers/new?mode=excel"><Icon name="up" size={18} /> {t("Excel Upload করুন")}</Link><Link className="btn later" href="/settings#store">{t("Store Connect করুন")}</Link><Link className="btn later" href="/knowledge">{t("AI-কে দোকানের তথ্য শেখান")}</Link></div>
        </div>
      </>
    );

  const [d, tipsC, rules, posts, unread, kbCount] = await Promise.all([
    dashboardData(shop), cachedTips(shop), buildInsights(shop.id, rows, loc),
    db.post.findMany({ where: { shopId: shop.id, status: "scheduled" }, orderBy: { scheduledAt: "asc" }, take: 3 }),
    unreadCount(shop.id), db.knowledgeItem.count({ where: { shopId: shop.id, active: true } }),
  ]);
  const tips = tipsC?.tips ?? [];
  const k = d.kpi;
  const weeks = d.weeks.map((w) => ({ label: f.dayNum(w.start), values: [w.repeat, w.fresh] }));

  return (
    <>
      <Announcements shop={shop} />
      <div className="greet"><h2>{greet}, {name}</h2><p>{t("গত ৩০ দিনে {m} বিক্রি, {n}টি Order", { m: tk(k.sales30), n: k.orders30 })}</p></div>
      <Onboarding shop={shop} />
      {unread > 0 && <Link href="/inbox" className="note-ai"><Icon name="chat" size={16} /><span>{t("{n}টি নতুন WhatsApp Message উত্তরের অপেক্ষায়", { n: unread })} →</span></Link>}
      {kbCount === 0 && <Link href="/knowledge" className="note-ai"><Icon name="book" size={16} /><span>{t("AI-কে আপনার পণ্য, দাম আর নিয়ম শেখান, তাহলে Message আর উত্তর আরও ঠিক হবে")} →</span></Link>}

      <div className="hero">
        <span className="tag"><Icon name="spark" size={14} /> {tipsC?.source === "ai" ? t("DAKLY AI-এর আজকের পরামর্শ") : t("আজকের পরামর্শ")}</span>
        {tips.length ? (
          <div style={{ display: "grid", gap: 14 }} className="tips">
            {tips.map((tip, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: i ? "1px solid rgba(255,255,255,.12)" : 0, paddingTop: i ? 12 : 0 }}>
                <h3 style={{ fontSize: i ? 17 : 21 }}>{tip.title}</h3>
                <p>{tip.body}</p>
                {tip.why && <p style={{ fontSize: 12.5, opacity: 0.8 }}>{t("কারণ:")} {tip.why}</p>}
                <div className="actions"><Link className="btn primary" href={tipHref(tip)}><Icon name="mega" size={18} /> {t("Campaign তৈরি করুন")}</Link></div>
              </div>
            ))}
          </div>
        ) : rules[0] ? (
          <>
            <h3>{rules[0].title}</h3><p>{rules[0].body}</p>
            <div className="actions"><Link className="btn primary" href={rules[0].action.href}><Icon name="mega" size={18} /> {rules[0].action.label}</Link></div>
          </>
        ) : <h3>{t("আজকের জন্য নতুন কোনো পরামর্শ নেই")}</h3>}
        {!tips.length && <form action={refreshTips}><button className="btn later">{aiEnabled() ? t("AI দিয়ে আজকের পরামর্শ তৈরি করুন") : t("আজকের পরামর্শ তৈরি করুন")}</button></form>}
      </div>

      <div className="kpis">
        <div className="stat"><span>{t("বিক্রি (৩০ দিন)")}</span><b className="num">{tk(k.sales30)}</b><Delta loc={loc} now={k.sales30} prev={k.salesPrev30} /></div>
        <div className="stat"><span>Repeat Order</span><b className="num">{bn(k.repeatShare)}%</b><span>{t("পুরোনো Customer থেকে")}</span></div>
        <div className="stat"><span>{t("ফিরে এসেছেন")}</span><b className="num">{t("{n} জন", { n: k.returnedThisMonth })}</b><span>{t("এই মাসে")} · {tk(k.repeatSalesThisMonth)}</span></div>
        <div className="stat"><span>{t("Campaign থেকে বিক্রি")}</span><b className="num">{tk(k.campaignRevenue)}</b><span>{t("পাঠানোর ৭ দিনের মধ্যে")}</span></div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="sec-h"><h3>{t("সাপ্তাহিক বিক্রি")}</h3><Link href="/reports">{t("সব রিপোর্ট")}</Link></div>
          <StackedBars loc={loc} data={weeks} series={[{ name: t("পুরোনো Customer (Repeat)"), color: "var(--leaf)" }, { name: t("নতুন Customer"), color: "var(--sky)" }]} labelEvery={2} />
        </div>
        <div className="card">
          <div className="sec-h"><h3>Customer Segment</h3><Link href="/customers">{t("সব দেখুন")}</Link></div>
          <div className="segs" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            {SEGMENT_KEYS.map((s) => (
              <Link key={s} href={`/customers?segment=${s}`} className="segt">
                <span className={`badge b-${s}`}>{SEGMENTS[s].label}</span>
                <span className="n num">{bn(d.segments[s])}</span>
                <span className="bar"><i style={{ width: `${Math.round((d.segments[s] / rows.length) * 100)}%`, background: COL[s] }} /></span>
              </Link>
            ))}
          </div>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="sec-h"><h3>{t("সাম্প্রতিক Campaign")}</h3><Link href="/campaigns">{t("সব")}</Link></div>
          {d.campaigns.length ? d.campaigns.slice(0, 3).map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ minWidth: 0 }}><b style={{ display: "block", lineHeight: 1.3 }}>{c.name}</b><span className="muted">{t("{a} জন · {b} জন কিনেছেন", { a: c.recipients, b: c.buyers })}</span></span>
              <b className="num" style={{ color: "var(--leaf)" }}>{tk(c.revenue)}</b>
            </Link>
          )) : <p className="muted">{t("এখনো কোনো Campaign পাঠানো হয়নি।")}</p>}
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="sec-h"><h3>{t("Schedule করা Facebook Post")}</h3><Link href="/posts">{t("নতুন লিখুন")}</Link></div>
          {posts.length ? posts.map((p) => (
            <div key={p.id}><b style={{ display: "block", lineHeight: 1.35 }}>{p.text.split("\n")[0].slice(0, 70)}</b><span className="muted">{t("{d}-এ Publish হবে", { d: p.scheduledAt ? f.dt(p.scheduledAt) : "" })}</span></div>
          )) : <p className="muted">{t("কোনো Post Schedule করা নেই।")}</p>}
        </div>
      </div>
      {rules.length > 0 && <Link href="/alerts" className="btn ghost">{t("আরও {n}টি Smart Notification দেখুন", { n: rules.length })}</Link>}
    </>
  );
}
