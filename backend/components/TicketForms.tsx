"use client";
import { useActionState, useEffect, useRef } from "react";
import { openTicket, replyTicket, type FormState } from "@/app/actions";
import { useLoc } from "./I18n";

export function TicketForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(openTicket, undefined);
  const { t } = useLoc();
  return (
    <form action={action} className="form">
      {s?.error && <div className="err">{s.error}</div>}
      <label className="field">{t("বিষয়")}<input id="t-subject" name="subject" required /></label>
      <label className="field">{t("বিস্তারিত")}<textarea id="t-body" name="body" required /></label>
      <button className="btn primary" disabled={pending}>{t("পাঠান")}</button>
    </form>
  );
}

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(replyTicket.bind(null, ticketId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  const { t } = useLoc();
  useEffect(() => { if (s?.ok) ref.current?.reset(); }, [s]);
  return (
    <form ref={ref} action={action} className="form">
      {s?.error && <div className="err">{s.error}</div>}
      <label className="field">{t("উত্তর লিখুন")}<textarea id="t-reply" name="body" required style={{ minHeight: 90 }} /></label>
      <button className="btn primary" disabled={pending}>{t("পাঠান")}</button>
    </form>
  );
}
