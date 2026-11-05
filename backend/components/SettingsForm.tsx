"use client";
import { useActionState } from "react";
import { saveSettings, connectStore, syncStoreNow, disconnectStore, type FormState } from "@/app/actions";
import { useLoc } from "./I18n";
import { COUNTRIES, CURRENCIES, LANGS } from "@/lib/i18n";

type V = Record<string, string>;
const LABEL = { own: ["b-sent", "আপনার Account"], platform: ["b-sent", "Dakly-র মাধ্যমে চালু"], off: ["b-test", "Test mode"] } as const;

export function SettingsForm({ values, has, state }: { values: V; has: Record<string, boolean>; state: Record<string, "own" | "platform" | "off"> }) {
  const [res, action, pending] = useActionState<FormState, FormData>(saveSettings, undefined);
  const { t } = useLoc();
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [values.timezone];
  const secret = (name: string, label: string) => (
    <label className="field">{t(label)}<input id={name} name={name} type="password" autoComplete="off" placeholder={has[name] ? "•••••••• " + t("(Save করা আছে, বদলাতে নতুন দিন)") : ""} /></label>
  );
  const text = (name: string, label: string, hint?: string) => (
    <label className="field">{t(label)}{hint && <small>{t(hint)}</small>}<input id={name} name={name} defaultValue={values[name]} autoComplete="off" /></label>
  );
  const head = (h: string, k: string) => <div className="sec-h"><h3>{h}</h3><span className={`badge ${LABEL[state[k]][0]}`}>{t(LABEL[state[k]][1])}</span></div>;
  return (
    <form action={action} className="form" style={{ maxWidth: 720 }}>
      {res?.error && <div className="err">{res.error}</div>}
      {res?.ok && <div className="okmsg">{res.ok}</div>}
      <div className="card form">
        {text("name", "দোকানের নাম")}
        <label className="field">{t("দেশ")}<small>{t("দেশের কোড ছাড়া লেখা ফোন নম্বর এই দেশের ধরে নেওয়া হবে")}</small>
          <select id="country" name="country" defaultValue={values.country}>{Object.entries(COUNTRIES).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select>
        </label>
        <label className="field">{t("Customer-দের Message-এর ভাষা")}<small>{t("AI এই ভাষায় Message, Post আর Voice Call লিখবে")}</small>
          <select id="language" name="language" defaultValue={values.language}>{Object.entries(LANGS).map(([k, l]) => <option key={k} value={k}>{l.name}</option>)}</select>
        </label>
        <label className="field">{t("মুদ্রা")}
          <select id="currency" name="currency" defaultValue={values.currency}>{[...new Set([values.currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label className="field">{t("Time zone")}<small>{t("Schedule, রিপোর্ট আর দৈনিক পরামর্শ এই সময় ধরে চলে")}</small>
          <select id="timezone" name="timezone" defaultValue={values.timezone}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select>
        </label>
      </div>
      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Message Channel (WhatsApp, SMS, Voice Call)</summary>
        <div className="form" style={{ marginTop: 12 }}>
          <p className="muted">{t("সাধারণত Dakly-র নিজের Account দিয়েই পাঠানো হয়। নিজের WhatsApp নম্বর বা SMS Gateway ব্যবহার করতে চাইলে নিচে দিন।")}</p>
          {head("WhatsApp (Cloud API)", "wa")}
          <p className="muted">{t("Template-এর Body-তে দুটো Variable লাগবে:")} {"{{1}}"} = {t("নাম")}, {"{{2}}"} = Message.</p>
          {text("waPhoneNumberId", "Phone Number ID")}
          {secret("waAccessToken", "Access Token")}
          {text("waTemplateName", "Template-এর নাম")}
          {text("waTemplateLang", "Template-এর ভাষা", "যেমন bn বা en")}
          {head("SMS Gateway", "sms")}
          <p className="muted">{t("এই ফর্মটা HTTP SMS Gateway-এর জন্য (যেমন BulkSMSBD)। খালি রাখলে Dakly দেশ অনুযায়ী নিজের Gateway বা Twilio SMS ব্যবহার করবে।")}</p>
          {text("smsApiUrl", "API URL", "যেমন https://bulksmsbd.net/api/smsapi")}
          {secret("smsApiKey", "API Key")}
          {text("smsSenderId", "Sender ID")}
          {head("AI Voice Call (Twilio)", "voice")}
          {text("twilioSid", "Account SID")}
          {secret("twilioToken", "Auth Token")}
          {text("twilioFrom", "Twilio নম্বর", "+1… ফরম্যাটে")}
          <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><input type="checkbox" name="clear" value="1" style={{ width: "auto" }} /> {t("নিজের সব Channel তথ্য মুছে Dakly-র Default ব্যবহার করুন")}</label>
        </div>
      </details>
      <button className="btn primary" disabled={pending}>{pending ? t("Save হচ্ছে…") : t("Save করুন")}</button>
    </form>
  );
}

export function StoreForm({ connected, type, url }: { connected: boolean; type: string; url: string }) {
  const [res, action, pending] = useActionState<FormState, FormData>(connectStore, undefined);
  const [syncRes, sync, syncing] = useActionState<FormState, FormData>(async () => syncStoreNow(), undefined);
  const r = syncRes ?? res;
  const { t } = useLoc();
  return (
    <>
      {r?.error && <div className="err">{r.error}</div>}
      {r?.ok && <div className="okmsg">{r.ok}</div>}
      {connected ? (
        <div className="row-btns">
          <form action={sync}><button className="btn primary" disabled={syncing}>{syncing ? t("Sync হচ্ছে…") : t("এখনই Sync করুন")}</button></form>
          <form action={disconnectStore}><button className="btn ghost">Disconnect</button></form>
        </div>
      ) : (
        <form action={action} className="form">
          <label className="field">{t("Store-এর ধরন")}
            <select id="storeType" name="storeType" defaultValue={type}><option value="woocommerce">WooCommerce</option><option value="shopify">Shopify</option></select>
          </label>
          <label className="field">Store URL<small>WooCommerce: https://yourshop.com · Shopify: your-store.myshopify.com</small><input id="storeUrl" name="storeUrl" defaultValue={url} /></label>
          <label className="field">Consumer Key / Admin API Access Token<input id="storeKey" name="storeKey" type="password" autoComplete="off" /></label>
          <label className="field">Consumer Secret<small>{t("শুধু WooCommerce-এর জন্য")}</small><input id="storeSecret" name="storeSecret" type="password" autoComplete="off" /></label>
          <button className="btn primary" disabled={pending}>{pending ? t("Connect হচ্ছে…") : t("Connect করে Customer আনুন")}</button>
        </form>
      )}
    </>
  );
}
