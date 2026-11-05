import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { loadCustomers, countBySegment, SEGMENTS, SEGMENT_KEYS, type Segment } from "@/lib/segments";
import { normalizePhone, toAsciiDigits } from "@/lib/i18n";
import { getLoc } from "@/lib/i18n/server";
import { Icon } from "@/components/Icon";

export default async function Customers({ searchParams }: { searchParams: Promise<{ segment?: string; q?: string }> }) {
  const sp = await searchParams;
  const { shop } = await requireShop();
  const all = await loadCustomers(shop.id);
  const { t, f } = await getLoc();
  const bn = f.n;
  const seg = countBySegment(all);
  const filter = SEGMENT_KEYS.includes(sp.segment as Segment) ? (sp.segment as Segment) : null;
  const q = (sp.q ?? "").trim();
  const qPhone = toAsciiDigits(q).replace(/\D/g, "");
  const list = all
    .filter((c) => !filter || c.segment === filter)
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || (qPhone.length >= 3 && (c.phone.includes(qPhone) || c.phone.includes(normalizePhone(qPhone, shop.country) ?? "x"))))
    .sort((a, b) => b.stats.total - a.stats.total);
  const href = (s: string | null) => `/customers?${new URLSearchParams({ ...(s ? { segment: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <div className="top-row">
        <form className="search" style={{ flex: 1, minWidth: 220 }} action="/customers">
          <Icon name="search" size={18} />
          {filter && <input type="hidden" name="segment" value={filter} />}
          <input id="q" name="q" placeholder={t("নাম বা ফোন নম্বর দিয়ে খুঁজুন")} defaultValue={q} aria-label={t("খুঁজুন")} />
        </form>
        <a className="btn ghost sm" href="/api/v1/customers/export" download>{t("Excel-এ নামান (CSV)")}</a>
        <Link className="btn primary fab" href="/customers/new"><Icon name="plus" size={18} stroke={2.4} /> {t("Customer যোগ করুন")}</Link>
      </div>
      <div className="chips">
        <Link className={`chip ${!filter ? "on" : ""}`} href={href(null)}>{t("সব")} · {bn(all.length)}</Link>
        {SEGMENT_KEYS.map((k) => <Link key={k} className={`chip ${filter === k ? "on" : ""}`} href={href(k)}>{SEGMENTS[k].label} · {bn(seg[k])}</Link>)}
      </div>
      {filter === "inactive" && seg.inactive > 0 && (
        <div className="note-ai"><Icon name="spark" size={16} /><div>{t("এই {n} জন ৬০ দিনের বেশি কেনেননি। একটা Winback Offer পাঠালে অনেকে ফিরতে পারেন।", { n: seg.inactive })} <Link href="/campaigns/new?segment=inactive" style={{ color: "var(--dak)", fontWeight: 600 }}>{t("Winback পাঠান")} →</Link></div></div>
      )}
      {list.length ? (
        <div className="list">
          {list.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="row">
              <div className="av">{c.name.slice(0, 1)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{c.name}<span className={`badge b-${c.segment}`}>{SEGMENTS[c.segment].label}</span></div>
                <div className="meta num">{f.phone(c.phone)} · {t("শেষ কেনা")} {f.ago(c.stats.last)}</div>
              </div>
              <div className="amt num">{f.money(c.stats.total)}<span>{t("{n}টি Order", { n: c.stats.count })}</span></div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card empty">
          {all.length ? <>{t("কাউকে পাওয়া যায়নি।")}</> : <>{t("এখনো কোনো Customer নেই।")}<Link className="btn primary" href="/customers/new?mode=excel">{t("Excel থেকে Upload করুন")}</Link></>}
        </div>
      )}
    </>
  );
}
