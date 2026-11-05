"use client";
import { useActionState, useEffect, useRef } from "react";
import { addCustomer, addOrder, type FormState } from "@/app/actions";
import { useLoc } from "./I18n";

const SAMPLE: Record<string, string> = { BD: "01711-234567", IN: "98765 43210", PK: "0301 2345678", US: "(201) 555-0123", GB: "07400 123456", AE: "050 123 4567" };

export function ManualForm({ initial, source = "manual", onDone }: { initial?: { name?: string; phone?: string; items?: string; amount?: string }; source?: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCustomer, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const { t, f } = useLoc();
  useEffect(() => { if (state?.ok) { ref.current?.reset(); onDone?.(); } }, [state, onDone]);
  return (
    <form ref={ref} className="form" action={action} key={JSON.stringify(initial)}>
      {state?.error && <div className="err" role="alert">{state.error}</div>}
      {state?.ok && <div className="okmsg" role="status">{state.ok}</div>}
      <input type="hidden" name="source" value={source} />
      <label className="field">{t("নাম")}<input id="c-name" name="name" required defaultValue={initial?.name} /></label>
      <label className="field">{t("মোবাইল নম্বর")}<input id="c-phone" name="phone" required inputMode="tel" placeholder={SAMPLE[f.country] ?? "+" } defaultValue={initial?.phone} /></label>
      <label className="field">{t("কী কিনেছেন")} <small>({t("ঐচ্ছিক")})</small><input id="c-items" name="items" defaultValue={initial?.items} /></label>
      <label className="field">{t("কত টাকা")} ({f.symbol}) <small>({t("ঐচ্ছিক")})</small><input id="c-amount" name="amount" inputMode="numeric" defaultValue={initial?.amount} /></label>
      <label className="field">{t("এলাকা")} <small>({t("ঐচ্ছিক")})</small><input id="c-area" name="area" /></label>
      <button className="btn primary block" disabled={pending}>{pending ? t("Save হচ্ছে…") : t("Customer Save করুন")}</button>
    </form>
  );
}

export function OrderForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addOrder.bind(null, customerId), undefined);
  const { t, f } = useLoc();
  return (
    <form className="form" action={action}>
      {state?.error && <div className="err">{state.error}</div>}
      {state?.ok && <div className="okmsg">{state.ok}</div>}
      <label className="field">{t("কী কিনেছেন")}<input id="o-items" name="items" /></label>
      <label className="field">{t("কত টাকা")} ({f.symbol})<input id="o-amount" name="amount" inputMode="numeric" required /></label>
      <button className="btn primary" disabled={pending}>{t("Order যোগ করুন")}</button>
    </form>
  );
}
