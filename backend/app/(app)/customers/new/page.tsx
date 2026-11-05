import { AddCustomer } from "@/components/AddCustomer";
import { aiEnabled } from "@/lib/ai";
import { getLoc } from "@/lib/i18n/server";

export default async function NewCustomer({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const { t } = await getLoc();
  return (
    <>
      <div className="greet"><h2>{t("Customer যোগ করুন")}</h2><p>{t("যেভাবে সুবিধা, সেভাবে।")}</p></div>
      <AddCustomer initialMode={(["excel", "voice", "manual"].includes(mode ?? "") ? mode : "excel") as "excel" | "voice" | "manual"} ai={aiEnabled()} />
    </>
  );
}
