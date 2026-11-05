import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLoc } from "@/lib/i18n/server";
import { Icon } from "@/components/Icon";

const ST: Record<string, string> = { queuing: "তৈরি হচ্ছে", draft: "Draft", scheduled: "Scheduled", sending: "পাঠানো হচ্ছে", sent: "পাঠানো হয়েছে" };
const CH: Record<string, string> = { wa: "WhatsApp", sms: "SMS", voice: "AI Call" };

export default async function Campaigns() {
  const { shop } = await requireShop();
  const { t, f } = await getLoc();
  const list = await db.campaign.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { messages: true } } } });
  return (
    <>
      <div className="top-row"><div className="greet"><h2>Campaign</h2><p>{t("সঠিক Customer-কে সঠিক Offer।")}</p></div><Link className="btn primary" href="/campaigns/new"><Icon name="plus" size={18} /> {t("নতুন Campaign")}</Link></div>
      {list.length ? (
        <div className="list">
          {list.map((c) => (
            <Link key={c.id} className="row" href={`/campaigns/${c.id}`}>
              <div className="av"><Icon name="mega" size={18} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{c.name}<span className={`badge b-${c.segment}`}>{c.segment === "all" ? t("সবাই") : c.segment}</span></div>
                <div className="meta">{c.channels.map((x) => CH[x]).join(", ")} · {c.status === "scheduled" && c.sendAt ? f.dt(c.sendAt) : f.ago(c.createdAt)}</div>
              </div>
              <div className="amt num">{t("{n} জন", { n: c._count.messages })}<span><span className={`badge b-${c.status}`}>{t(ST[c.status] ?? c.status)}</span></span></div>
            </Link>
          ))}
        </div>
      ) : <div className="card empty">{t("এখনো কোনো Campaign নেই।")}<Link className="btn primary" href="/campaigns/new?segment=inactive">{t("প্রথম Winback Campaign তৈরি করুন")}</Link></div>}
    </>
  );
}
