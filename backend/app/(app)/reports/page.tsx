import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { dashboardData } from "@/lib/reports";
import { productStats } from "@/lib/recommend";
import { bestTime } from "@/lib/timing";
import { getLoc } from "@/lib/i18n/server";
import { SEGMENTS, SEGMENT_KEYS } from "@/lib/segments";
import { StackedBars, HourStrip, Delta } from "@/components/Charts";

export default async function Reports() {
  const { shop } = await requireShop();
  const loc = await getLoc();
  const { t, f } = loc;
  const bn = f.n, tk = f.money;
  const [d, ps, bt] = await Promise.all([dashboardData(shop), productStats(shop.id), bestTime(shop, loc)]);
  const k = d.kpi;
  const weeks = d.weeks.map((w) => ({ label: f.dayMonth(w.start), values: [w.repeat, w.fresh] }));
  return (
    <>
      <div className="greet"><h2>{t("রিপোর্ট")}</h2><p>{t("আপনার ব্যবসা কেমন চলছে, আর Dakly কতটা কাজে লাগছে।")}</p></div>
      <div className="kpis">
        <div className="stat"><span>{t("বিক্রি (৩০ দিন)")}</span><b className="num">{tk(k.sales30)}</b><Delta loc={loc} now={k.sales30} prev={k.salesPrev30} /></div>
        <div className="stat"><span>{t("গড় Order")}</span><b className="num">{tk(k.avgOrder)}</b><span>{t("{n}টি Order", { n: k.orders30 })}</span></div>
        <div className="stat"><span>{t("সক্রিয় Customer")}</span><b className="num">{bn(k.active)}</b><span>{t("মোট {n} জনের মধ্যে", { n: k.customers })}</span></div>
        <div className="stat"><span>Repeat Order</span><b className="num">{bn(k.repeatShare)}%</b><span>{t("গত ৩০ দিনের Order")}</span></div>
      </div>
      <div className="card">
        <div className="sec-h"><h3>{t("১২ সপ্তাহের বিক্রি")}</h3><span className="muted">{t("নতুন বনাম পুরোনো Customer")}</span></div>
        <StackedBars loc={loc} data={weeks} series={[{ name: t("পুরোনো Customer (Repeat)"), color: "var(--leaf)" }, { name: t("নতুন Customer"), color: "var(--sky)" }]} height={220} labelEvery={2} />
      </div>
      <div className="grid2">
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ fontSize: 17 }}>{t("Campaign-এর ফল")}</h3>
          <p className="muted">{t("যাঁরা Message পেয়েছেন, তাঁরা ৭ দিনের মধ্যে যা কিনেছেন।")}</p>
          {d.campaigns.length ? (
            <div className="tbl-wrap"><table className="tbl num">
              <thead><tr><th>Campaign</th><th>{t("জন")}</th><th>{t("পড়েছেন")}</th><th>{t("কিনেছেন")}</th><th>{t("বিক্রি")}</th></tr></thead>
              <tbody>{d.campaigns.map((c) => (
                <tr key={c.id}><td><Link href={`/campaigns/${c.id}`} style={{ fontWeight: 600 }}>{c.name.slice(0, 32)}</Link><br /><span className="muted">{f.dt(c.sentAt)}</span></td>
                  <td>{bn(c.recipients)}</td><td>{bn(c.read)}</td><td>{bn(c.buyers)}</td><td style={{ color: "var(--leaf)", fontWeight: 700 }}>{tk(c.revenue)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="muted">{t("Campaign পাঠালে এখানে ফল দেখাবে।")}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="sec-h"><h3>{t("Message পাঠানোর সেরা সময়")}</h3></div>
            <p style={{ margin: "4px 0 10px" }}><b style={{ color: "var(--dak)" }}>{bt.label}</b> <span className="muted">· {bt.basedOn}</span></p>
            <HourStrip loc={loc} hist={bt.hist} best={bt.hour} />
          </div>
          <div className="card">
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>{t("জনপ্রিয় পণ্য")}</h3>
            {ps.ranked.length ? ps.ranked.slice(0, 6).map((p) => (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span>{p.name}</span><span className="muted num">{t("{a} জন · ৩০ দিনে {b}", { a: p.buyers, b: p.recent })}</span>
              </div>
            )) : <p className="muted">{t("Order-এ পণ্যের নাম দিলে এখানে দেখাবে।")}</p>}
          </div>
          <div className="card">
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>Segment</h3>
            {SEGMENT_KEYS.map((s) => <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span className={`badge b-${s}`}>{SEGMENTS[s].label}</span><b className="num">{bn(d.segments[s])}</b></div>)}
          </div>
        </div>
      </div>
    </>
  );
}
