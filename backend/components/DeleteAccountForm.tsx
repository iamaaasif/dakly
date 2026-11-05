"use client";
import { useActionState, useState } from "react";
import { deleteMyAccount, type FormState } from "@/app/actions";
import { useLoc } from "./I18n";

export function DeleteAccountForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(deleteMyAccount, undefined);
  const [open, setOpen] = useState(false);
  const { t } = useLoc();
  if (!open) return <button type="button" className="btn ghost" onClick={() => setOpen(true)}>{t("Account মুছে ফেলুন")}</button>;
  return (
    <form action={action} className="form" onSubmit={(e) => { if (!confirm(t("সত্যিই সব মুছে ফেলবেন?"))) e.preventDefault(); }}>
      {s?.error && <div className="err">{s.error}</div>}
      <label className="field">Password<input id="del-password" name="password" type="password" required autoComplete="current-password" /></label>
      <label className="field">{t("নিশ্চিত করতে DELETE লিখুন")}<input id="del-confirm" name="confirm" required autoComplete="off" /></label>
      <div className="row-btns">
        <button className="btn primary" style={{ background: "var(--dak)" }} disabled={pending}>{pending ? t("মুছছি…") : t("চিরতরে মুছে ফেলুন")}</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{t("বাতিল")}</button>
      </div>
    </form>
  );
}
