"use client";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword, resetPassword, type FormState } from "@/app/actions";
import { useLoc } from "./I18n";

export function ForgotForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(forgotPassword, undefined);
  const { t } = useLoc();
  return (
    <div className="auth"><form className="card form" action={action}>
      <h1>{t("Password ভুলে গেছেন?")}</h1>
      <p className="muted">{t("Account-এর Email দিন, নতুন Password দেওয়ার Link পাঠাব।")}</p>
      {s?.ok && <div className="okmsg">{s.ok}</div>}
      {s?.error && <div className="err">{s.error}</div>}
      <label className="field">Email<input id="email" name="email" type="email" required autoComplete="email" /></label>
      <button className="btn primary block" disabled={pending}>{t("Link পাঠান")}</button>
      <Link href="/login" className="muted" style={{ textAlign: "center" }}>{t("Login-এ ফিরে যান")}</Link>
    </form></div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(resetPassword, undefined);
  const { t } = useLoc();
  return (
    <div className="auth"><form className="card form" action={action}>
      <h1>{t("নতুন Password দিন")}</h1>
      {s?.error && <div className="err">{s.error} <Link href="/forgot" style={{ fontWeight: 600 }}>{t("নতুন Link চান")}</Link></div>}
      <input type="hidden" name="token" value={token} />
      <label className="field">{t("নতুন Password")}<input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
      <button className="btn primary block" disabled={pending}>{t("Save করে Login করুন")}</button>
    </form></div>
  );
}
