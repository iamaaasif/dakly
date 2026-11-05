import { requireShop } from "@/lib/auth";
import { listKnowledge } from "@/lib/services";
import { getLoc } from "@/lib/i18n/server";
import { KB_TYPES } from "@/lib/knowledge";
import { KnowledgeForm, BrandVoiceForm } from "@/components/KnowledgeForms";
import { deleteKnowledge, toggleKnowledge } from "@/app/actions";
import Link from "next/link";

const TYPE_LABEL: Record<string, string> = { product: "পণ্য", policy: "নিয়ম", faq: "প্রশ্ন-উত্তর", voice: "কথার ধরন", note: "অন্যান্য" };

export default async function Knowledge({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; edit?: string }> }) {
  const sp = await searchParams;
  const { shop } = await requireShop();
  const { t, f } = await getLoc();
  const items = await listKnowledge(shop.id, sp.q, sp.type);
  const editing = sp.edit ? items.find((i) => i.id === sp.edit) : undefined;
  return (
    <>
      <div className="greet"><h2>AI Knowledge</h2><p>{t("আপনার দোকানের পণ্য, দাম, Delivery, Return-এর নিয়ম আর সাধারণ প্রশ্নের উত্তর এখানে লিখুন। Campaign Message, Facebook Post, Voice Call আর Inbox-এর উত্তর লেখার সময় AI এগুলো দেখে লিখবে, নিজে থেকে দাম বা নিয়ম বানাবে না।")}</p></div>
      <div className="grid2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="card form">
            <h3 style={{ fontSize: 17 }}>{editing ? t("তথ্য বদলান") : t("নতুন তথ্য যোগ করুন")}</h3>
            <KnowledgeForm key={editing?.id ?? "new"} item={editing ? { id: editing.id, type: editing.type, title: editing.title, body: editing.body, price: editing.price != null ? String(editing.price) : "" } : undefined} currency={f.symbol} />
          </div>
          <div className="card form">
            <h3 style={{ fontSize: 17 }}>{t("কথার ধরন (Brand voice)")}</h3>
            <p className="muted">{t("কীভাবে কথা বলেন: যেমন \"আপু/ভাইয়া বলে সম্বোধন করি, সালাম দিয়ে শুরু করি, খুব বেশি Emoji দিই না\"।")}</p>
            <BrandVoiceForm value={shop.brandVoice ?? ""} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <form className="search" action="/knowledge"><input id="kq" name="q" placeholder={t("খুঁজুন")} defaultValue={sp.q ?? ""} aria-label={t("খুঁজুন")} /></form>
          <div className="chips">
            <Link className={`chip ${!sp.type ? "on" : ""}`} href="/knowledge">{t("সব")} · {f.n(items.length)}</Link>
            {KB_TYPES.filter((k) => k !== "voice").map((k) => <Link key={k} className={`chip ${sp.type === k ? "on" : ""}`} href={`/knowledge?type=${k}`}>{t(TYPE_LABEL[k])}</Link>)}
          </div>
          {items.length ? items.map((i) => (
            <div key={i.id} className="card" style={{ opacity: i.active ? 1 : 0.55, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="sec-h"><b>{i.title}{i.price != null ? ` · ${f.money(i.price)}` : ""}</b><span className="badge b-regular">{t(TYPE_LABEL[i.type] ?? i.type)}</span></div>
              {i.body && <p style={{ fontSize: 14, whiteSpace: "pre-wrap", color: "var(--ink-2)" }}>{i.body}</p>}
              <div className="row-btns">
                <Link className="btn ghost sm" href={`/knowledge?edit=${i.id}`}>{t("বদলান")}</Link>
                <form action={toggleKnowledge.bind(null, i.id, !i.active)}><button className="btn ghost sm">{i.active ? t("বন্ধ রাখুন") : t("চালু করুন")}</button></form>
                <form action={deleteKnowledge.bind(null, i.id)}><button className="btn ghost sm">{t("মুছুন")}</button></form>
              </div>
            </div>
          )) : <div className="card empty">{t("এখনো কিছু নেই। প্রথমে আপনার জনপ্রিয় পণ্য আর Delivery-র নিয়ম লিখুন।")}</div>}
        </div>
      </div>
    </>
  );
}
