import { notFound } from "next/navigation";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { segmentOf, SEGMENTS } from "@/lib/segments";
import { getLoc } from "@/lib/i18n/server";
import { OrderForm } from "@/components/CustomerForms";
import { deleteCustomer, setOptOut } from "@/app/actions";
import { recommendationFor } from "@/lib/recommend";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { ContactButtons } from "@/components/Chat";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { shop } = await requireShop();
  const c = await db.customer.findFirst({
    where: { id, shopId: shop.id },
    include: { orders: { orderBy: { orderedAt: "desc" } }, messages: { orderBy: { createdAt: "desc" }, take: 10, include: { campaign: { select: { name: true } } } } },
  });
  if (!c) notFound();
  const loc = await getLoc();
  const { t, f } = loc;
  const reco = await recommendationFor(shop.id, c.id, loc);
  const total = c.orders.reduce((a, o) => a + o.amount, 0);
  const dates = c.orders.map((o) => o.orderedAt.getTime());
  const seg = segmentOf({ total, count: c.orders.length, first: dates.length ? new Date(Math.min(...dates)) : null, last: dates.length ? new Date(Math.max(...dates)) : null });
  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div className="av" style={{ width: 52, height: 52, fontSize: 20 }}>{c.name.slice(0, 1)}</div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 22 }}>{c.name} <span className={`badge b-${seg}`}>{SEGMENTS[seg].label}</span></h2>
          <p className="muted num">{f.phone(c.phone)}{c.area ? ` · ${c.area}` : ""}</p>
        </div>
      </div>
      <div className="row-btns"><Link className="btn primary sm" href={`/inbox/${c.id}`}><Icon name="chat" size={16} /> {t("Message")}</Link><ContactButtons phone={c.phone} customerId={c.id} /></div>
      <div className="stats">
        <div className="stat"><b className="num">{f.money(total)}</b><span>{t("মোট কেনা")}</span></div>
        <div className="stat"><b className="num">{f.n(c.orders.length)}</b><span>Order</span></div>
        <div className="stat"><b>{f.ago(dates.length ? new Date(Math.max(...dates)) : null)}</b><span>{t("শেষ কেনা")}</span></div>
      </div>
      {reco && (
        <div className="note-ai"><Icon name="spark" size={16} /><div>{t("পরের Offer-এ দিন:")} <b>{reco.product}</b>. {reco.reason}.
          {" "}<Link href={`/campaigns/new?${new URLSearchParams({ segment: seg, offer: t("{p}-এ বিশেষ ছাড়", { p: reco.product }) })}`} style={{ color: "var(--dak)", fontWeight: 600 }}>{t("Campaign তৈরি করুন")} →</Link></div></div>
      )}
      <div className="grid2">
        <div className="card form"><h3 style={{ fontSize: 17 }}>{t("নতুন Order যোগ করুন")}</h3><OrderForm customerId={c.id} /></div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ fontSize: 17 }}>{t("Order-এর ইতিহাস")}</h3>
          {c.orders.length ? c.orders.map((o) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
              <span style={{ minWidth: 0 }}>{o.items || "Order"}<br /><span className="muted">{f.dt(o.orderedAt)}</span></span><b className="num">{f.money(o.amount)}</b>
            </div>
          )) : <p className="muted">{t("এখনো কোনো Order নেই।")}</p>}
          {c.messages.length > 0 && <><h3 style={{ fontSize: 17, marginTop: 8 }}>Campaign</h3>{c.messages.map((m) => <div key={m.id} className="muted">{m.campaign.name} · {m.channel.toUpperCase()} · <span className={`badge b-${m.status}`}>{m.status}</span></div>)}</>}
        </div>
      </div>
      {c.optedOut && <div className="err">{t("এই Customer Message বন্ধ করতে বলেছেন (STOP)। কোনো Campaign-এ যাবেন না।")}</div>}
      <div className="row-btns">
        <form action={setOptOut.bind(null, c.id, !c.optedOut)}><button className="btn ghost sm">{c.optedOut ? t("আবার Message পাঠানো চালু করুন") : t("Message পাঠানো বন্ধ করুন")}</button></form>
        <form action={deleteCustomer.bind(null, c.id)}><button className="btn ghost sm">{t("Customer মুছে ফেলুন")}</button></form>
      </div>
    </>
  );
}
