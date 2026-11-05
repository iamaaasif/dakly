import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { conversations } from "@/lib/inbox";
import { getLoc } from "@/lib/i18n/server";
import { channelConfig } from "@/lib/config";
import { Icon } from "@/components/Icon";

export default async function Inbox({ searchParams }: { searchParams: Promise<{ q?: string; unread?: string; before?: string }> }) {
  const sp = await searchParams;
  const { shop } = await requireShop();
  const { t, f } = await getLoc();
  const { conversations: list, nextCursor } = await conversations(shop.id, { q: sp.q, unread: sp.unread === "1", before: sp.before });
  const wa = channelConfig(shop).wa;
  return (
    <>
      <div className="greet"><h2>Inbox</h2><p>{t("Customer-দের WhatsApp Message এখানে আসে। AI উত্তর লিখে দেয়, আপনি দেখে পাঠান।")}</p></div>
      {!wa && <div className="err">{t("WhatsApp এখনো Connect করা নেই, তাই Message আসবে না আর পাঠানো Test mode-এ থাকবে।")} <Link href="/settings" style={{ fontWeight: 600 }}>{t("Settings-এ Connect করুন")} →</Link></div>}
      <div className="top-row">
        <form className="search" style={{ flex: 1, minWidth: 220 }} action="/inbox">
          <Icon name="search" size={18} />
          <input id="q" name="q" placeholder={t("নাম বা ফোন নম্বর দিয়ে খুঁজুন")} defaultValue={sp.q ?? ""} aria-label={t("খুঁজুন")} />
        </form>
        <div className="chips">
          <Link className={`chip ${sp.unread !== "1" ? "on" : ""}`} href="/inbox">{t("সব")}</Link>
          <Link className={`chip ${sp.unread === "1" ? "on" : ""}`} href="/inbox?unread=1">{t("না পড়া")}</Link>
        </div>
      </div>
      {list.length ? (
        <div className="list">
          {list.map((c) => (
            <Link key={c.customer.id} href={`/inbox/${c.customer.id}`} className="row">
              <div className="av">{c.customer.name.slice(0, 1)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{c.customer.name}{c.windowOpen && <span className="badge b-sent">{t("চ্যাট খোলা")}</span>}</div>
                <div className="meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: c.unread ? 700 : 400 }}>
                  {c.last.direction === "out" ? t("আপনি: ") : ""}{c.last.body.split("\n")[0].slice(0, 90)}
                </div>
              </div>
              <div className="amt num" style={{ fontSize: 12 }}>{f.ago(c.last.at)}{c.unread > 0 && <span><span className="badge b-inactive">{f.n(c.unread)}</span></span>}</div>
            </Link>
          ))}
        </div>
      ) : <div className="card empty">{t("এখনো কোনো Message নেই। Campaign পাঠালে বা Customer WhatsApp করলে এখানে দেখাবে।")}</div>}
      {nextCursor && <Link className="btn ghost" href={`/inbox?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.unread ? { unread: sp.unread } : {}), before: nextCursor })}`}>{t("আরও দেখুন")}</Link>}
    </>
  );
}
