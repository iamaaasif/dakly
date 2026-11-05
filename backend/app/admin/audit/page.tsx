import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dateTimeBn } from "@/lib/format";

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdmin();
  if (!me.perms.system) redirect("/admin");
  const { q = "" } = await searchParams;
  const list = await db.auditLog.findMany({
    where: q ? { OR: [{ actor: { contains: q, mode: "insensitive" } }, { action: { contains: q, mode: "insensitive" } }, { target: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" }, take: 300,
  });
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Staff আর System কে কখন কী বদলেছে। মুছে ফেলা যায় না।</p>
      <form className="filters" action="/admin/audit"><input className="input" name="q" defaultValue={q} placeholder="কে, কী বা কোন দোকান" aria-label="খুঁজুন" /><button className="btn ghost sm">খুঁজুন</button></form>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>সময়</th><th>কে</th><th>কাজ</th><th>কার ওপর</th><th>বিস্তারিত</th></tr></thead>
        <tbody>{list.map((l) => <tr key={l.id}><td className="num">{dateTimeBn(l.createdAt)}</td><td>{l.actor}</td><td><code>{l.action}</code></td><td>{l.target ?? ""}</td><td style={{ whiteSpace: "normal", minWidth: 200 }}>{l.detail ?? ""}</td></tr>)}</tbody>
      </table></div>
    </>
  );
}
