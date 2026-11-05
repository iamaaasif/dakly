import Link from "next/link";
import { getLoc } from "@/lib/i18n/server";
export default async function NotFound() {
  const { t } = await getLoc();
  return (
    <div className="auth"><div className="card" style={{ textAlign: "center" }}>
      <h1>{t("পাতাটা পাওয়া যায়নি")}</h1><p className="muted">{t("Link-টা ভুল হতে পারে, বা জিনিসটা মুছে ফেলা হয়েছে।")}</p>
      <Link className="btn primary" href="/">{t("হোমে ফিরে যান")}</Link>
    </div></div>
  );
}
