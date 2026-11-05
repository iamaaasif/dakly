"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendChat, suggestChatReply, logCall } from "@/app/actions";
import { Icon } from "./Icon";
import { useLoc } from "./I18n";

export function ChatBox({ customerId, open, optedOut, ai, smsReady }: { customerId: string; open: boolean; optedOut: boolean; ai: boolean; smsReady: boolean }) {
  const { t } = useLoc();
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const send = (channel: "wa" | "sms") => start(async () => {
    setErr("");
    const r = await sendChat(customerId, text, channel);
    if ("error" in r && r.error) setErr(r.error); else { setText(""); router.refresh(); }
  });
  const suggest = () => start(async () => { setErr(""); const r = await suggestChatReply(customerId); if (r.error) setErr(r.error); else setText(r.text ?? ""); });
  if (optedOut && !open) return <div className="err">{t("এই Customer Message বন্ধ করতে বলেছেন (STOP)। উনি নিজে Message দিলে উত্তর দিতে পারবেন।")}</div>;
  return (
    <div className="card form" style={{ maxWidth: 760, position: "sticky", bottom: 76 }}>
      {err && <div className="err">{err}</div>}
      <textarea id="chat-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={busy ? t("লিখছি…") : t("উত্তর লিখুন")} style={{ minHeight: 70 }} />
      <div className="row-btns">
        <button type="button" className="btn ghost sm" onClick={suggest} disabled={busy}><Icon name="spark" size={16} /> {ai ? t("AI উত্তর লিখুক") : t("উত্তরের নমুনা")}</button>
        <span style={{ flex: 1 }} />
        {smsReady && <button type="button" className="btn ghost sm" onClick={() => send("sms")} disabled={busy || text.trim().length < 1}>SMS</button>}
        <button type="button" className="btn primary sm" onClick={() => send("wa")} disabled={busy || text.trim().length < 1}><Icon name="send" size={16} /> {open ? t("পাঠান") : t("Template দিয়ে পাঠান")}</button>
      </div>
    </div>
  );
}

/** Call or WhatsApp the customer from the owner's own phone (tel: and wa.me links), and note it in the conversation. */
export function ContactButtons({ phone, customerId }: { phone: string; customerId: string }) {
  const { t } = useLoc();
  return (
    <div className="row-btns">
      <a className="btn ghost sm" href={`tel:+${phone}`} onClick={() => { void logCall(customerId, "phone"); }}><Icon name="phone" size={16} /> {t("Call")}</a>
      <a className="btn ghost sm" href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" onClick={() => { void logCall(customerId, "whatsapp"); }}><Icon name="wa" size={16} /> {t("WhatsApp Call / Chat")}</a>
    </div>
  );
}
