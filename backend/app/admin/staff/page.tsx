import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, isAdmin } from "@/lib/auth";
import { setStaffRole } from "../actions";
import { StaffForm } from "../forms";

export default async function Staff() {
  const me = await requireAdmin();
  if (!me.perms.staff) redirect("/admin");
  const list = await db.user.findMany({ where: { role: { in: ["admin", "support", "billing"] } }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <h1>Staff</h1>
      <div className="card"><p className="muted"><b>Admin</b>: সব কিছু। <b>Support</b>: Merchant দেখা, Ticket, Announcement, Password Reset Link। <b>Billing</b>: Merchant দেখা, Plan, Payment, Usage ও খরচ। ADMIN_EMAILS-এ থাকা Email সবসময় Admin।</p></div>
      <div className="card" style={{ maxWidth: 860 }}><StaffForm /></div>
      <div className="list">
        {list.map((u) => (
          <div key={u.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div style={{ minWidth: 0 }}><div className="nm">{u.name} {u.disabled && <span className="pill bad">বন্ধ</span>}{isAdmin(u) && u.role !== "admin" && <span className="pill warn">ADMIN_EMAILS</span>}</div><div className="meta">{u.email}</div></div>
            {u.id === me.id ? <span className="pill ok">আপনি</span> : (
              <form action={setStaffRole.bind(null, u.id)} className="row-btns">
                <select name="role" className="input" defaultValue={u.disabled ? "remove" : u.role} style={{ width: "auto" }} aria-label="Role"><option value="admin">Admin</option><option value="support">Support</option><option value="billing">Billing</option><option value="remove">Access বন্ধ</option></select>
                <button className="btn ghost sm">Save</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
