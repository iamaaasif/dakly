import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Icon } from "@/components/Icon";
import { loadCustomers } from "@/lib/segments";
import { buildInsights } from "@/lib/insights";
import { getLoc } from "@/lib/i18n/server";
import { unreadCount } from "@/lib/inbox";
import { LangSwitch } from "@/components/LangSwitch";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { shop } = await requireShop();
  const rows = await loadCustomers(shop.id);
  const loc = await getLoc();
  const { t, f } = loc;
  const [alerts, unread] = [(await buildInsights(shop.id, rows, loc)).length, await unreadCount(shop.id)];
  return (
    <div className="shell">
      <header className="appbar">
        <div className="shop-av">{shop.name.slice(0, 1)}</div>
        <div className="who"><b>{shop.name}</b><span>{t("{n} জন Customer", { n: rows.length })}</span></div>
        <LangSwitch />
        <Link className="icon-btn mob-only" href="/settings" aria-label="Settings"><Icon name="gear" size={18} /></Link>
        <Link className="icon-btn" href="/alerts" aria-label="Notification"><Icon name="bell" size={18} />{alerts > 0 && <span className="dot num">{f.n(alerts)}</span>}</Link>
      </header>
      <main className="view">{children}</main>
      <Nav shopName={shop.name} unread={unread} />
    </div>
  );
}
