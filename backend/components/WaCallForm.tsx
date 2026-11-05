"use client";
import { useActionState, useState } from "react";
import { saveWaCall, type FormState } from "@/app/actions";
import { waCallButtonHtml, waCallLink } from "@/lib/wacall";
import { useLoc } from "./I18n";

/** Settings card: the shop's WhatsApp number for free customer calls, the link, and a website button. */
export function WaCallForm({ number, inSms }: { number: string; inSms: boolean }) {
  const [s, action, pending] = useActionState<FormState, FormData>(saveWaCall, undefined);
  const { t } = useLoc();
  const [copied, setCopied] = useState("");
  const html = number ? waCallButtonHtml(number, t("WhatsApp-এ কল করুন")) : "";
  const copy = async (what: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { /* ignore */ } };
  return (
    <div className="card form" style={{ maxWidth: 720 }} id="whatsapp-call">
      <div className="sec-h"><h3>{t("WhatsApp-এ ফ্রি কল")}</h3><span className={`badge ${number ? "b-sent" : "b-test"}`}>{number ? t("চালু") : t("চালু নেই")}</span></div>
      <p className="muted">{t("Customer আপনার WhatsApp নম্বরে কল করলে কারও কোনো খরচ নেই। নম্বর দিন, তারপর Link বা বোতামটা Website আর SMS-এ দিন।")}</p>
      <form action={action} className="form">
        {s?.error && <div className="err">{s.error}</div>}
        {s?.ok && <div className="okmsg">{s.ok}</div>}
        <label htmlFor="waCallNumber">{t("আপনার WhatsApp নম্বর")}</label>
        <input className="input" id="waCallNumber" name="waCallNumber" inputMode="tel" placeholder="01712-345678" defaultValue={number ? "+" + number : ""} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="waCallInSms" defaultChecked={inSms} />
          {t("SMS Campaign-এর শেষে \"WhatsApp-এ ফ্রি কল\" Link দিন")}
        </label>
        <button className="btn ghost" disabled={pending}>{pending ? t("Save হচ্ছে…") : t("Save করুন")}</button>
      </form>
      {number && (
        <>
          <label>Link</label>
          <div className="row-btns">
            <a className="btn ghost sm" href={waCallLink(number)} target="_blank" rel="noopener noreferrer">{waCallLink(number).replace("https://", "")}</a>
            <button type="button" className="btn ghost sm" onClick={() => copy("link", waCallLink(number))}>{copied === "link" ? t("Copy হয়েছে") : t("Copy করুন")}</button>
          </div>
          <label htmlFor="waCallHtml">{t("Website-এর বোতাম (Shopify, WooCommerce বা যেকোনো Page-এ বসান)")}</label>
          <textarea id="waCallHtml" readOnly rows={3} value={html} style={{ fontFamily: "monospace", fontSize: 12 }} />
          <div className="row-btns"><button type="button" className="btn ghost sm" onClick={() => copy("html", html)}>{copied === "html" ? t("Copy হয়েছে") : t("Code Copy করুন")}</button></div>
        </>
      )}
    </div>
  );
}
