import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLoc } from "@/lib/i18n/server";
import { TicketForm } from "@/components/TicketForms";

const ST: Record<string, string> = { open: "খোলা", waiting: "উত্তর এসেছে", closed: "বন্ধ" };

export default async function Support() {
  const { shop } = await requireShop();
  const { t, f } = await getLoc();
  const tickets = await db.ticket.findMany({ where: { shopId: shop.id }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <div className="greet"><h2>Support</h2><p>{t("কোনো সমস্যা বা প্রশ্ন? Dakly টিম সাধারণত ২৪ ঘণ্টার মধ্যে উত্তর দেয়।")}</p></div>
      <div className="grid2">
        <div className="card form"><h3 style={{ fontSize: 17 }}>{t("নতুন Ticket")}</h3><TicketForm /></div>
        <div className="list">
          {tickets.length ? tickets.map((tk) => (
            <Link key={tk.id} href={`/support/${tk.id}`} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div style={{ minWidth: 0 }}><div className="nm">{tk.subject}</div><div className="meta">{f.ago(tk.updatedAt)}</div></div>
              <span className={`badge b-${tk.status === "waiting" ? "sent" : tk.status === "open" ? "queued" : "draft"}`}>{t(ST[tk.status])}</span>
            </Link>
          )) : <div className="empty">{t("এখনো কোনো Ticket নেই।")}</div>}
        </div>
      </div>
    </>
  );
}
