import { notFound } from "next/navigation";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLoc } from "@/lib/i18n/server";
import { ReplyForm } from "@/components/TicketForms";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { shop } = await requireShop();
  const { t: tt, f } = await getLoc();
  const t = await db.ticket.findFirst({ where: { id, shopId: shop.id }, include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } } });
  if (!t) notFound();
  return (
    <>
      <div className="greet"><h2>{t.subject}</h2><p>{t.status === "closed" ? tt("এই Ticket বন্ধ। নতুন Message দিলে আবার খুলবে।") : tt("Dakly টিম উত্তর দিলে এখানে দেখাবে।")}</p></div>
      <div className="thread" style={{ maxWidth: 720 }}>
        {t.messages.map((m) => <div key={m.id} className={`msg ${m.fromStaff ? "them" : "me"}`}>{m.body}<small>{m.fromStaff ? `${tt("Dakly টিম")} · ${m.author.name}` : tt("আপনি")} · {f.dt(m.createdAt)}</small></div>)}
      </div>
      <div className="card form" style={{ maxWidth: 720 }}><ReplyForm ticketId={t.id} /></div>
    </>
  );
}
