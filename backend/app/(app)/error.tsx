"use client";
import { useLoc } from "@/components/I18n";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const { t } = useLoc();
  return (
    <div className="card empty">
      <h3>{t("কিছু একটা ঠিকমতো হয়নি")}</h3>
      <p className="muted">{t("আবার চেষ্টা করুন। সমস্যা থাকলে কিছুক্ষণ পরে আসুন।")}</p>
      <button className="btn primary" onClick={reset}>{t("আবার চেষ্টা করুন")}</button>
    </div>
  );
}
