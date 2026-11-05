"use client";
import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions";
import { useLoc } from "./I18n";

export function PasswordForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(changePassword, undefined);
  const { t } = useLoc();
  return (
    <form action={action} className="form">
      {s?.error && <div className="err">{s.error}</div>}
      {s?.ok && <div className="okmsg">{s.ok}</div>}
      <label className="field">{t("এখনকার Password")}<input id="pw-current" name="current" type="password" required autoComplete="current-password" /></label>
      <label className="field">{t("নতুন Password")}<input id="pw-new" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      <label className="field">{t("নতুন Password আবার")}<input id="pw-confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
      <div className="row-btns"><button className="btn ghost" disabled={pending}>{pending ? "…" : t("Password বদলান")}</button></div>
    </form>
  );
}
