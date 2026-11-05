"use client";
import { useActionState, useEffect, useRef } from "react";
import { saveKnowledge, saveBrandVoice, type FormState } from "@/app/actions";
import { useLoc } from "./I18n";

const TYPES: [string, string, string][] = [
  ["product", "পণ্য", "যেমন: শীতের কাশ্মীরি শাল · রং: লাল, নীল · Size: Free"],
  ["policy", "নিয়ম", "যেমন: ঢাকায় Delivery ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা, ২-৩ দিন"],
  ["faq", "প্রশ্ন-উত্তর", "যেমন: প্রশ্ন: Cash on Delivery আছে? উত্তর: হ্যাঁ, সারা দেশে।"],
  ["note", "অন্যান্য", "যেমন: শুক্রবার দোকান বন্ধ"],
];

export function KnowledgeForm({ item, currency }: { item?: { id: string; type: string; title: string; body: string; price: string }; currency: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(saveKnowledge.bind(null, item?.id ?? null), undefined);
  const { t } = useLoc();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.ok && !item) ref.current?.reset(); }, [s, item]);
  return (
    <form ref={ref} action={action} className="form">
      {s?.error && <div className="err">{s.error}</div>}
      {s?.ok && <div className="okmsg">{s.ok}</div>}
      <label className="field">{t("ধরন")}
        <select id="kb-type" name="type" defaultValue={item?.type ?? "product"}>{TYPES.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      </label>
      <label className="field">{t("শিরোনাম")}<input id="kb-title" name="title" required defaultValue={item?.title} /></label>
      <label className="field">{t("বিস্তারিত")}<small>{t(TYPES[0][2])}</small><textarea id="kb-body" name="body" rows={4} defaultValue={item?.body} /></label>
      <label className="field">{t("দাম")} ({currency}) <small>({t("ঐচ্ছিক")})</small><input id="kb-price" name="price" inputMode="numeric" defaultValue={item?.price} /></label>
      <button className="btn primary" disabled={pending}>{pending ? t("Save হচ্ছে…") : t("Save করুন")}</button>
    </form>
  );
}

export function BrandVoiceForm({ value }: { value: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(saveBrandVoice, undefined);
  const { t } = useLoc();
  return (
    <form action={action} className="form">
      {s?.error && <div className="err">{s.error}</div>}
      {s?.ok && <div className="okmsg">{s.ok}</div>}
      <textarea id="brandVoice" name="brandVoice" rows={3} defaultValue={value} />
      <button className="btn ghost" disabled={pending}>{t("Save করুন")}</button>
    </form>
  );
}
