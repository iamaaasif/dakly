import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { loadCustomers } from "@/lib/segments";
import { buildInsights } from "@/lib/insights";
import { cachedTips, tipHref } from "@/lib/ai-insights";
import { InsightCard } from "@/components/InsightCard";
import { Icon } from "@/components/Icon";
import { refreshTips } from "@/app/actions";
import { getLoc } from "@/lib/i18n/server";

export default async function Alerts() {
  const { shop } = await requireShop();
  const loc = await getLoc();
  const { t } = loc;
  const [insights, tips] = await Promise.all([buildInsights(shop.id, await loadCustomers(shop.id), loc), cachedTips(shop)]);
  return (
    <>
      <div className="greet"><h2>Smart Notification</h2><p>{t("Dakly প্রতিদিন সকালে আপনার Customer-দের কেনাকাটা দেখে জানায় কাকে কখন কী Offer দেবেন।")}</p></div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="sec-h"><h3><Icon name="spark" size={16} /> {tips?.source === "ai" ? t("আজকের AI পরামর্শ") : t("আজকের পরামর্শ")}</h3>
          <form action={refreshTips}><button className="btn ghost sm">{tips ? t("আবার তৈরি করুন") : t("তৈরি করুন")}</button></form></div>
        {tips?.tips.length ? tips.tips.map((tip, i) => (
          <div key={i} style={{ borderTop: i ? "1px solid var(--line)" : 0, paddingTop: i ? 10 : 0 }}>
            <b>{tip.title}</b><p style={{ color: "var(--ink-2)", fontSize: 14 }}>{tip.body}</p>
            {tip.why && <p className="muted">{t("কারণ:")} {tip.why}</p>}
            <Link className="btn primary sm" style={{ marginTop: 6 }} href={tipHref(tip)}>{t("Campaign তৈরি করুন")}</Link>
          </div>
        )) : <p className="muted">{t("আজকের পরামর্শ এখনো তৈরি হয়নি।")}</p>}
      </div>
      {insights.length ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{insights.map((i) => <InsightCard key={i.key} i={i} t={t} />)}</div>
        : <div className="card empty">{t("এখন কোনো নতুন Notification নেই।")}</div>}
    </>
  );
}
