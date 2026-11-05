import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dateTimeBn } from "@/lib/format";
import { StaffReplyForm } from "../../forms";

export default async function TicketAdmin({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  if (!me.perms.support) redirect("/admin");
  const { id } = await params;
  const t = await db.ticket.findUnique({ where: { id }, include: { shop: { include: { owner: true } }, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } } });
  if (!t) notFound();
  return (
    <>
      <div><h1>{t.subject}</h1><p className="muted"><Link href={`/admin/merchants/${t.shopId}`} style={{ color: "var(--accent)" }}>{t.shop.name}</Link> · {t.shop.owner.email} · {t.status}</p></div>
      <div className="thread" style={{ maxWidth: 760 }}>
        {t.messages.map((m) => <div key={m.id} className={`msg ${m.fromStaff ? "me" : "them"}`}>{m.body}<small>{m.author.name} · {dateTimeBn(m.createdAt)}</small></div>)}
      </div>
      <div className="card" style={{ maxWidth: 760 }}><StaffReplyForm ticketId={t.id} status={t.status} priority={t.priority} /></div>
    </>
  );
}
