import { requireAdmin, ROLES } from "@/lib/auth";
import { logout } from "@/app/actions";
import { AdminNav } from "./AdminNav";

export const metadata = { title: "Dakly Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const p = me.perms;
  const items: [string, string][] = [["/admin", "Overview"]];
  if (p.merchants) items.push(["/admin/merchants", "Merchants"]);
  if (p.billing) items.push(["/admin/payments", "Payments"], ["/admin/usage", "Usage ও খরচ"]);
  if (p.support) items.push(["/admin/tickets", "Support"]);
  if (p.announcements) items.push(["/admin/announcements", "Announcements"]);
  if (p.staff) items.push(["/admin/staff", "Staff"]);
  if (p.system) items.push(["/admin/audit", "Audit log"], ["/admin/system", "System"]);
  return (
    <div className="adm">
      <header className="adm-top">
        <div className="bar1">
          <div><b>Dakly Back Office</b><div className="who">{me.name} · {ROLES[p.role as keyof typeof ROLES] ?? p.role}</div></div>
          <form action={logout}><button className="btn sm" style={{ background: "transparent", color: "var(--hero-2)", border: "1px solid rgba(255,255,255,.2)" }}>Logout</button></form>
        </div>
        <AdminNav items={items} />
      </header>
      <main>{children}</main>
    </div>
  );
}
