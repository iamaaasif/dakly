"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login, register, type FormState } from "@/app/actions";
import { Icon } from "./Icon";
import { useLoc } from "./I18n";
import { LangSwitch } from "./LangSwitch";
import { COUNTRIES } from "@/lib/i18n";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : register, undefined);
  const { t, lang } = useLoc();
  return (
    <div className="auth">
      <form className="card form" action={action}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div className="mark"><Icon name="mega" size={24} stroke={2.2} /></div><LangSwitch className="btn ghost sm" /></div>
        <div>
          <h1>{mode === "login" ? t("Dakly-তে Login করুন") : t("Dakly শুরু করুন")}</h1>
          <p className="muted">{t("Customer-কে আবার ডাকুন। আরও বিক্রি করুন।")}</p>
        </div>
        {state?.error && <div className="err" role="alert">{state.error}</div>}
        {mode === "register" && (
          <>
            <label className="field">{t("আপনার নাম")}<input id="name" name="name" required autoComplete="name" /></label>
            <label className="field">{t("দোকান বা Facebook Page-এর নাম")}<input id="shop" name="shop" required /></label>
            <label className="field">{t("দেশ")}<select id="country" name="country" defaultValue="BD">{Object.entries(COUNTRIES).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select></label>
            <input type="hidden" name="language" value={lang} />
          </>
        )}
        <label className="field">Email<input id="email" name="email" type="email" required autoComplete="email" /></label>
        <label className="field">Password<input id="password" name="password" type="password" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {mode === "login" && <Link href="/forgot" className="muted" style={{ textAlign: "right", marginTop: -6 }}>{t("Password ভুলে গেছেন?")}</Link>}
        <button className="btn primary block" disabled={pending}>{pending ? t("অপেক্ষা করুন…") : mode === "login" ? "Login" : t("Account খুলুন")}</button>
        <p className="muted" style={{ textAlign: "center" }}>
          {mode === "login" ? <>{t("Account নেই?")} <Link href="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("নতুন খুলুন")}</Link></> : <>{t("Account আছে?")} <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("Login করুন")}</Link></>}
        </p>
        <p className="muted" style={{ textAlign: "center", fontSize: 12.5 }}><Link href="/privacy">{t("Privacy Policy")}</Link> · <Link href="/delete-account">{t("Account মুছে ফেলা")}</Link></p>
      </form>
    </div>
  );
}
