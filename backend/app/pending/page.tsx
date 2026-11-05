import { logout } from "@/app/actions";
import { getLoc } from "@/lib/i18n/server";
export default async function Pending() {
  const { t } = await getLoc();
  return (
    <div className="auth"><div className="card" style={{ textAlign: "center" }}>
      <h1>{t("Account যাচাই হচ্ছে")}</h1>
      <p className="muted">{t("Dakly টিম আপনার Account দেখে চালু করে দেবে, সাধারণত ২৪ ঘণ্টার মধ্যে। চালু হলে Email পাবেন।")}</p>
      <form action={logout}><button className="btn ghost">Logout</button></form>
    </div></div>
  );
}
