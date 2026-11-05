import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, PLAN_KEYS, activePlan, messageLimit, aiLimit } from "@/lib/plans";
import { usedThisMonth } from "@/lib/send";
import { aiUsedThisMonth } from "@/lib/usage";
import { paymentsReady } from "@/lib/billing";
import { getLoc } from "@/lib/i18n/server";
import { priceFor, planFeatures } from "@/lib/plans";
import { buyPlan } from "@/app/actions";

const STATUS: Record<string, [string, string]> = {
  paid: ["okmsg", "Payment সফল হয়েছে। নতুন Plan চালু হয়েছে।"],
  cancelled: ["err", "Payment বাতিল করা হয়েছে।"], failed: ["err", "Payment হয়নি। আবার চেষ্টা করুন।"], error: ["err", "Payment যাচাই করা যায়নি। টাকা কেটে থাকলে Support-এ জানান।"],
};
const PS: Record<string, string> = { paid: "সফল", pending: "অপেক্ষায়", failed: "ব্যর্থ", cancelled: "বাতিল", manual: "Admin দিয়েছেন" };

export default async function Billing({ searchParams }: { searchParams: Promise<{ status?: string; msg?: string }> }) {
  const sp = await searchParams;
  const { shop } = await requireShop();
  const loc = await getLoc();
  const { t, f } = loc;
  const bn = f.n;
  const plan = activePlan(shop);
  const pay = paymentsReady(shop);
  const price = (k: (typeof PLAN_KEYS)[number]) => priceFor(k, shop.currency);
  const money = (x: { amount: number; currency: string }) => (x.currency === shop.currency ? f.money(x.amount) : f.digits(new Intl.NumberFormat(loc.lang === "bn" ? "en-IN" : "en-US", { style: "currency", currency: x.currency, maximumFractionDigits: 0 }).format(x.amount)));
  const [msgs, ai, pays] = await Promise.all([usedThisMonth(shop.id), aiUsedThisMonth(shop.id), db.payment.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 10 })]);
  const ml = messageLimit(shop), al = aiLimit(shop);
  const bar = (u: number, l: number) => <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (u / Math.max(1, l)) * 100)}%`, background: u >= l ? "var(--bad)" : "var(--leaf)" }} /></div>;
  return (
    <>
      <div className="greet"><h2>{t("Plan ও Payment")}</h2><p>{t("এখন:")} <b>{PLANS[plan].name}</b>{plan !== "free" && shop.planUntil ? ` · ${t("{d} পর্যন্ত", { d: f.date(shop.planUntil) })}` : ""}</p></div>
      {sp.status && STATUS[sp.status] && <div className={STATUS[sp.status][0]}>{t(STATUS[sp.status][1])}{sp.msg ? ` ${sp.msg}` : ""}</div>}
      <div className="grid2">
        <div className="card"><div className="sec-h"><h3>{t("এই মাসের Message")}</h3><b className="num">{bn(msgs)} / {bn(ml)}</b></div>{bar(msgs, ml)}</div>
        <div className="card"><div className="sec-h"><h3>{t("এই মাসের AI ব্যবহার")}</h3><b className="num">{bn(ai)} / {bn(al)}</b></div>{bar(ai, al)}</div>
      </div>
      {!pay && <div className="err">{t("Online Payment এখনো চালু হয়নি। Plan নিতে Support-এ Ticket খুলুন।")}</div>}
      <div className="plans">
        {PLAN_KEYS.map((k) => (
          <div key={k} className={`card plan ${plan === k ? "on" : ""}`}>
            <div className="sec-h"><h3>{PLANS[k].name}</h3>{plan === k && <span className="badge b-sent">{t("চালু আছে")}</span>}</div>
            <div className="price num">{price(k).amount ? money(price(k)) : "Free"}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>{price(k).amount ? " / " + t("মাস") : ""}</span></div>
            <ul>{planFeatures(k, loc).map((x) => <li key={x}>{x}</li>)}</ul>
            {k !== "free" && pay && (
              <form action={buyPlan} className="row-btns" style={{ marginTop: "auto" }}>
                <input type="hidden" name="plan" value={k} />
                <select name="months" className="input" style={{ width: "auto" }} aria-label={t("মাস")} defaultValue="1">
                  {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{t("{n} মাস", { n: m })} · {money({ amount: price(k).amount * m, currency: price(k).currency })}</option>)}
                </select>
                <button className="btn primary">{plan === k ? t("মেয়াদ বাড়ান") : t("কিনুন")}</button>
              </form>
            )}
          </div>
        ))}
      </div>
      <p className="muted">{shop.currency === "BDT" ? t("bKash, Nagad, Rocket, Card বা Net Banking দিয়ে SSLCommerz-এর মাধ্যমে Payment।") : t("Card দিয়ে Stripe-এর মাধ্যমে Payment।")} {t("মেয়াদ শেষ হলে Free Plan-এ ফিরে যাবে, কোনো Data মুছবে না।")}</p>
      {pays.length > 0 && (
        <div className="tbl-wrap"><table className="tbl num"><thead><tr><th>{t("তারিখ")}</th><th>Plan</th><th>{t("টাকা")}</th><th>{t("অবস্থা")}</th><th>Transaction</th></tr></thead>
          <tbody>{pays.map((p) => <tr key={p.id}><td>{f.dt(p.createdAt)}</td><td>{PLANS[p.plan as "free"]?.name} × {bn(p.months)}</td><td>{money(p)}</td><td><span className={`badge b-${p.status === "paid" || p.status === "manual" ? "sent" : p.status === "pending" ? "queued" : "failed"}`}>{t(PS[p.status] ?? p.status)}</span></td><td>{p.status === "paid" || p.status === "manual" ? <a href={`/billing/invoice/${p.id}`} target="_blank" style={{ color: "var(--accent)" }}>{p.tranId}</a> : p.tranId}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
