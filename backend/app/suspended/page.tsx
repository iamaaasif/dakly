import { currentUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { getLoc } from "@/lib/i18n/server";
import { supportEmail } from "@/lib/config";
export default async function Suspended() {
  const u = await currentUser();
  const { t } = await getLoc();
  return (
    <div className="auth"><div className="card" style={{ textAlign: "center" }}>
      <h1>{t("Account স্থগিত")}</h1>
      <p className="muted">{u?.shop?.suspendedReason || t("আপনার Account সাময়িকভাবে বন্ধ আছে।")} {t("বিস্তারিত জানতে {e}-এ লিখুন।", { e: supportEmail() })}</p>
      <form action={logout}><button className="btn ghost">Logout</button></form>
    </div></div>
  );
}
