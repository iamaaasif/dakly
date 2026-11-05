"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { useLoc } from "./I18n";

const ITEMS = [
  ["/", "হোম", "home"],
  ["/customers", "Customer", "users"],
  ["/inbox", "Inbox", "chat"],
  ["/campaigns", "Campaign", "mega"],
  ["/posts", "AI Post", "pen"],
] as const;
const MORE = [["/reports", "রিপোর্ট", "trend"], ["/knowledge", "AI Knowledge", "spark"], ["/alerts", "Notification", "bell"], ["/billing", "Plan ও Payment", "gift"], ["/support", "Support", "phone"], ["/settings", "Settings", "gear"]] as const;

export function Nav({ shopName, unread = 0 }: { shopName: string; unread?: number }) {
  const path = usePathname();
  const { t, f } = useLoc();
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <nav className="tabs" aria-label="Main">
      <div className="brandrow"><span><Icon name="mega" size={17} stroke={2.2} /></span>Dakly</div>
      {ITEMS.map(([href, label, icon]) => (
        <Link key={href} href={href} className={on(href) ? "on" : ""} aria-current={on(href) ? "page" : undefined} style={{ position: "relative" }}>
          <Icon name={icon} size={22} stroke={on(href) ? 2.3 : 1.9} /><span>{t(label)}</span>
          {href === "/inbox" && unread > 0 && <span className="dot num" style={{ position: "absolute", top: 2, left: "55%" }}>{f.n(unread)}</span>}
        </Link>
      ))}
      {MORE.map(([href, label, icon]) => (
        <Link key={href} href={href} className={`desk-only ${on(href) ? "on" : ""}`}><Icon name={icon} size={22} stroke={1.9} /><span>{t(label)}</span></Link>
      ))}
      <div className="side-only">{shopName}</div>
    </nav>
  );
}
