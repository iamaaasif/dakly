import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ago } from "@/lib/format";

export default async function Tickets({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const me = await requireAdmin();
  if (!me.perms.support) redirect("/admin");
  const { s = "open" } = await searchParams;
  const list = await db.ticket.findMany({ where: s === "all" ? {} : { status: s }, orderBy: [{ priority: "asc" }, { updatedAt: "asc" }], take: 200, include: { shop: { select: { name: true } }, _count: { select: { messages: true } } } });
  return (
    <>
      <h1>Support Ticket</h1>
      <div className="chips">{[["open", "উত্তর দরকার"], ["waiting", "Merchant-এর অপেক্ষায়"], ["closed", "বন্ধ"], ["all", "সব"]].map(([k, l]) => <Link key={k} className={`chip ${s === k ? "on" : ""}`} href={`/admin/tickets?s=${k}`}>{l}</Link>)}</div>
      <div className="list">
        {list.length ? list.map((t) => (
          <Link key={t.id} href={`/admin/tickets/${t.id}`} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div style={{ minWidth: 0 }}><div className="nm">{t.priority === "high" && <span className="pill bad">High</span>}{t.subject}</div><div className="meta">{t.shop.name} · {t._count.messages}টি Message · শেষ {ago(t.updatedAt)}</div></div>
            <span className={`pill ${t.status === "open" ? "warn" : t.status === "waiting" ? "ok" : "off"}`}>{t.status}</span>
          </Link>
        )) : <div className="empty">কোনো Ticket নেই।</div>}
      </div>
    </>
  );
}
