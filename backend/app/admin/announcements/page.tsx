import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dateTimeBn } from "@/lib/format";
import { toggleAnnouncement } from "../actions";
import { AnnouncementForm } from "../forms";

export default async function Announcements() {
  const me = await requireAdmin();
  if (!me.perms.announcements) redirect("/admin");
  const list = await db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <h1>Announcements</h1>
      <p className="muted">Merchant-দের হোম পেজের ওপরে দেখায় (একসাথে সর্বোচ্চ ২টি)। নতুন Feature, Maintenance বা Offer জানাতে ব্যবহার করুন।</p>
      <div className="card" style={{ maxWidth: 760 }}><AnnouncementForm /></div>
      <div className="list">
        {list.map((a) => (
          <div key={a.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div style={{ minWidth: 0 }}><div className="nm">{a.title} <span className={`pill ${a.active ? "ok" : "off"}`}>{a.active ? "দেখাচ্ছে" : "লুকানো"}</span> <span className="pill off">{a.audience}</span></div><div className="meta">{a.body.slice(0, 120)} · {dateTimeBn(a.createdAt)}{a.endsAt ? ` → ${dateTimeBn(a.endsAt)}` : ""}</div></div>
            <form action={toggleAnnouncement.bind(null, a.id)}><button className="btn ghost sm">{a.active ? "লুকান" : "দেখান"}</button></form>
          </div>
        ))}
      </div>
    </>
  );
}
