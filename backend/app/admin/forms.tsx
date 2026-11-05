"use client";
import { useActionState } from "react";
import { setPlan, setLimit, staffReply, createAnnouncement, addStaff, type AState } from "./actions";

const Msg = ({ s }: { s: AState }) => <>{s?.error && <div className="err">{s.error}</div>}{s?.ok && <div className="okmsg">{s.ok}</div>}</>;

export function PlanForm({ shopId }: { shopId: string }) {
  const [s, a, p] = useActionState<AState, FormData>(setPlan.bind(null, shopId), undefined);
  return (
    <form action={a} className="form">
      <Msg s={s} />
      <div className="row-btns">
        <label className="field" style={{ flex: 1 }}>Plan<select name="plan" defaultValue="starter"><option value="free">Free</option><option value="starter">Starter</option><option value="growth">Growth</option></select></label>
        <label className="field" style={{ width: 110 }}>মাস যোগ<input name="months" type="number" min={0} max={24} defaultValue={1} /></label>
      </div>
      <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" name="record" value="1" style={{ width: "auto" }} /> Manual Payment হিসেবে রেকর্ড করুন (bKash/Bank-এ পাওয়া টাকা)</label>
      <div className="row-btns">
        <label className="field" style={{ flex: 1 }}>টাকা<input name="amount" type="number" min={0} placeholder="খালি রাখলে Plan-এর দাম" /></label>
        <label className="field" style={{ flex: 2 }}>নোট<input name="note" placeholder="যেমন bKash TrxID" /></label>
      </div>
      <button className="btn primary" disabled={p}>Plan Save করুন</button>
    </form>
  );
}

export function LimitForm({ shopId, value }: { shopId: string; value: number | null }) {
  const [s, a, p] = useActionState<AState, FormData>(setLimit.bind(null, shopId), undefined);
  return (
    <form action={a} className="form">
      <Msg s={s} />
      <label className="field">মাসিক Message সীমা<small>খালি রাখলে Plan অনুযায়ী</small><input name="limit" type="number" min={0} defaultValue={value ?? ""} /></label>
      <button className="btn ghost" disabled={p}>Save</button>
    </form>
  );
}

export function StaffReplyForm({ ticketId, status, priority }: { ticketId: string; status: string; priority: string }) {
  const [s, a, p] = useActionState<AState, FormData>(staffReply.bind(null, ticketId), undefined);
  return (
    <form action={a} className="form">
      <Msg s={s} />
      <label className="field">উত্তর<textarea name="body" style={{ minHeight: 100 }} /></label>
      <div className="row-btns">
        <label className="field" style={{ flex: 1 }}>অবস্থা<select name="status" defaultValue={status === "open" ? "waiting" : status}><option value="waiting">উত্তর দেওয়া হয়েছে</option><option value="open">খোলা রাখুন</option><option value="closed">বন্ধ করুন</option></select></label>
        <label className="field" style={{ flex: 1 }}>Priority<select name="priority" defaultValue={priority}><option value="normal">Normal</option><option value="high">High</option></select></label>
      </div>
      <button className="btn primary" disabled={p}>পাঠান</button>
    </form>
  );
}

export function AnnouncementForm() {
  const [s, a, p] = useActionState<AState, FormData>(createAnnouncement, undefined);
  return (
    <form action={a} className="form">
      <Msg s={s} />
      <label className="field">শিরোনাম<input name="title" required /></label>
      <label className="field">লেখা<textarea name="body" required /></label>
      <div className="row-btns">
        <label className="field" style={{ flex: 1 }}>কারা দেখবে<select name="audience"><option value="all">সব Merchant</option><option value="free">শুধু Free</option><option value="paid">শুধু Paid</option></select></label>
        <label className="field" style={{ flex: 1 }}>ধরন<select name="tone"><option value="info">তথ্য</option><option value="warning">সতর্কতা</option></select></label>
        <label className="field" style={{ flex: 1 }}>কবে পর্যন্ত<input name="endsAt" type="datetime-local" /></label>
      </div>
      <button className="btn primary" disabled={p}>প্রকাশ করুন</button>
    </form>
  );
}

export function StaffForm() {
  const [s, a, p] = useActionState<AState, FormData>(addStaff, undefined);
  return (
    <form action={a} className="form">
      <Msg s={s} />
      <div className="row-btns">
        <label className="field" style={{ flex: 1 }}>নাম<input name="name" required /></label>
        <label className="field" style={{ flex: 1 }}>Email<input name="email" type="email" required /></label>
        <label className="field" style={{ flex: 1 }}>Role<select name="role"><option value="support">Support</option><option value="billing">Billing</option><option value="admin">Admin</option></select></label>
      </div>
      <button className="btn primary" disabled={p}>Staff যোগ করুন</button>
    </form>
  );
}
