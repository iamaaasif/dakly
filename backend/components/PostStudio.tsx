"use client";
import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { aiPost, schedulePost } from "@/app/actions";
import { useLoc } from "./I18n";

function slot(dayOffset: number, h: number, m = 0) {
  const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0);
  return d;
}
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function PostStudio({ shopName, best }: { shopName: string; best: { label: string; at: string } }) {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("বন্ধুসুলভ");
  const [text, setText] = useState("");
  const [at, setAt] = useState(local(new Date(best.at)));
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, start] = useTransition();
  const { t } = useLoc();

  const gen = () => start(async () => { setMsg({}); const r = await aiPost({ prompt, tone }); if (r.error) setMsg({ error: r.error }); else setText(r.text ?? ""); });
  const save = () => start(async () => {
    setMsg({});
    const r = await schedulePost({ prompt, text, at: new Date(at).toISOString() });
    if (r.error) setMsg({ error: r.error }); else { setMsg({ ok: t("Schedule হয়েছে। সময় হলে Dakly নিজেই Publish করবে।") }); setText(""); setPrompt(""); }
  });
  const quick: [string, Date][] = [[`${t("AI সেরা সময়")} (${best.label})`, new Date(best.at)], [t("আজ সন্ধ্যা ৭:৩০"), slot(0, 19, 30)], [t("কাল সকাল ১০টা"), slot(1, 10)], [t("কাল রাত ৯টা"), slot(1, 21)]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div className="card form">
        <label className="field">{t("AI-কে বলুন কী Promote করবেন")}
          <textarea id="pp" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={t("যেমন: শীতের নতুন শাল আর কার্ডিগান, দাম ৮৫০ টাকা থেকে")} style={{ minHeight: 80 }} />
        </label>
        <div className="chips">{["বন্ধুসুলভ", "Offer-কেন্দ্রিক", "মজার", "আবেগী"].map((x) => <button key={x} type="button" className={`chip ${tone === x ? "on" : ""}`} onClick={() => setTone(x)}>{t(x)}</button>)}</div>
        <button type="button" className="btn primary" disabled={busy || prompt.trim().length < 3} onClick={gen}><Icon name="spark" size={18} /> {text ? t("আবার তৈরি করুন") : t("AI দিয়ে Post লিখুন")}</button>
      </div>
      {msg.error && <div className="err">{msg.error}</div>}
      {msg.ok && <div className="okmsg">{msg.ok}</div>}
      {text && (
        <>
          <div className="fb">
            <div className="fb-h"><div className="shop-av">{shopName.slice(0, 1)}</div><div><b>{shopName}</b><span>{t("Preview · Edit করতে পারবেন")}</span></div></div>
            <textarea className="fb-t" id="post-text" value={text} onChange={(e) => setText(e.target.value)} aria-label="Post" />
          </div>
          <div className="card form">
            <b>{t("কখন Publish হবে?")}</b>
            <div className="chips">{quick.map(([l, d]) => <button key={l} type="button" className={`chip ${at === local(d) ? "on" : ""}`} onClick={() => setAt(local(d))}>{l}</button>)}</div>
            <label className="field">{t("অথবা নিজে বাছুন")}<input id="post-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
            <button type="button" className="btn primary" disabled={busy} onClick={save}><Icon name="cal" size={18} /> {t("Schedule করুন")}</button>
          </div>
        </>
      )}
    </div>
  );
}
