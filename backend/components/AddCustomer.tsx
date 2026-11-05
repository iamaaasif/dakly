"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { ManualForm } from "./CustomerForms";
import { useLoc } from "./I18n";

type Mode = "excel" | "voice" | "manual";
const OPTS: [Mode | "store", string, string, string, string][] = [
  ["excel", "up", "t-leaf", "Excel থেকে Upload", "পুরোনো List একবারে তুলে দিন"],
  ["voice", "mic", "t-dak", "মুখে বলে যোগ", "নিজের ভাষায় বলুন, AI লিখে নেবে"],
  ["manual", "edit", "t-haldi", "নিজে লিখে যোগ", "নাম, ফোন, কী কিনেছেন"],
  ["store", "trend", "t-sky", "Online Store Connect", "Shopify, WooCommerce থেকে নিজে আসবে"],
];

export function AddCustomer({ initialMode, ai }: { initialMode: Mode; ai: boolean }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const { t } = useLoc();
  return (
    <>
      <div className="opts">
        {OPTS.map(([k, icon, tone, title, sub]) => (
          k === "store" ? (
            <Link key={k} href="/settings#store" className="opt"><span className={`ic ${tone}`}><Icon name={icon} /></span><b>{t(title)}</b><span>{t(sub)}</span></Link>
          ) : (
            <button key={k} type="button" className={`opt ${mode === k ? "on" : ""}`} onClick={() => setMode(k)}>
              <span className={`ic ${tone}`}><Icon name={icon} /></span><b>{t(title)}</b><span>{t(sub)}</span>
            </button>
          )
        ))}
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        {mode === "excel" && <ExcelImport />}
        {mode === "voice" && <VoiceAdd ai={ai} />}
        {mode === "manual" && <ManualForm />}
      </div>
    </>
  );
}

type Preview = { rows: number; mapping: Record<string, string | null>; sample: Record<string, string>[]; invalid: number };
const FIELD_BN: Record<string, string> = { name: "নাম", phone: "ফোন", total: "মোট কেনা", last: "শেষ কেনা", count: "Order সংখ্যা", email: "Email", area: "এলাকা" };

function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const { t } = useLoc();

  async function send(dry: boolean, f = file) {
    if (!f) return;
    setBusy(true); setMsg({});
    const fd = new FormData(); fd.append("file", f);
    const res = await fetch(`/api/import${dry ? "?dry=1" : ""}`, { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ error: data.error });
    if (dry) setPreview(data);
    else { setMsg({ ok: t("{a} জন নতুন, {b} জন আগে থেকেই ছিলেন (তথ্য মিলিয়ে নেওয়া হয়েছে)।", { a: data.created, b: data.updated }) + (data.skipped ? " " + t("Free Plan-এর সীমার কারণে {n} জন বাদ গেছেন, Plan Upgrade করলে আনা যাবে।", { n: data.skipped }) : "") }); setPreview(null); setFile(null); }
  }

  return (
    <div className="form">
      <label className="drop" htmlFor="xl">
        <Icon name="up" size={24} /><br />
        <b>{file ? file.name : t("Excel (.xlsx) বা CSV ফাইল বাছুন")}</b><br />
        <span className="muted">{t("কলামে নাম আর মোবাইল নম্বর থাকলেই চলবে। মোট কেনা, শেষ কেনার তারিখ থাকলে Segment আরও ঠিক হবে।")}</span>
      </label>
      <input id="xl" type="file" accept=".xlsx,.csv" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(null); if (f) send(true, f); }} />
      {busy && <p className="muted">{t("পড়ছি…")}</p>}
      {msg.error && <div className="err">{msg.error}</div>}
      {msg.ok && <div className="okmsg">{msg.ok} <Link href="/customers" style={{ fontWeight: 600 }}>{t("Customer দেখুন")} →</Link></div>}
      {preview && (
        <>
          <p style={{ fontWeight: 600 }}>{t("{n}টি সারি পাওয়া গেছে। কলামগুলো এভাবে মিলিয়েছি:", { n: preview.rows })}</p>
          <div className="scroll-x"><table className="tbl"><tbody>
            {Object.entries(preview.mapping).map(([field, col]) => (
              <tr key={field}><td>{t(FIELD_BN[field])}</td><td style={{ color: col ? "var(--leaf)" : "var(--ink-3)", fontWeight: 600 }}>{col ? `"${col}" ✓` : t("পাওয়া যায়নি")}</td></tr>
            ))}
          </tbody></table></div>
          {preview.invalid > 0 && <p className="muted">{t("{n}টি সারিতে সঠিক মোবাইল নম্বর নেই, সেগুলো বাদ যাবে।", { n: preview.invalid })}</p>}
          <div className="scroll-x"><table className="tbl"><thead><tr>{["নাম", "ফোন", "মোট কেনা", "শেষ কেনা"].map((h) => <th key={h}>{t(h)}</th>)}</tr></thead><tbody>
            {preview.sample.map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.phone}</td><td>{r.total}</td><td>{r.last}</td></tr>)}
          </tbody></table></div>
          <button className="btn primary block" disabled={busy || !preview.mapping.name || !preview.mapping.phone} onClick={() => send(false)}>
            {t("{n} জন Import করুন", { n: preview.rows - preview.invalid })}
          </button>
        </>
      )}
    </div>
  );
}

function VoiceAdd({ ai }: { ai: boolean }) {
  const [state, setState] = useState<"idle" | "rec" | "busy" | "done">("idle");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<{ name: string; phone: string; items: string; amount: string } | null>(null);
  const [err, setErr] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const { t } = useLoc();

  async function toggle() {
    setErr("");
    if (state === "rec") { rec.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setState("busy");
        const blob = new Blob(chunks.current, { type: mr.mimeType });
        const fd = new FormData();
        fd.append("audio", blob, mr.mimeType.includes("mp4") ? "voice.mp4" : "voice.webm");
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) { setErr(data.error); setState("idle"); return; }
        setText(data.text);
        setParsed({ name: data.parsed.name, phone: data.parsed.phone, items: data.parsed.items, amount: data.parsed.amount ? String(data.parsed.amount) : "" });
        setState("done");
      };
      rec.current = mr;
      mr.start();
      setState("rec");
    } catch {
      setErr(t("Microphone চালু করা যায়নি। Browser-এ Mic-এর অনুমতি দিন।"));
    }
  }

  if (!ai) return <div className="err">{t("Voice Input চালাতে Server-এ OPENAI_API_KEY দিতে হবে।")}</div>;
  return (
    <div className="form">
      <button type="button" className={`mic ${state === "rec" ? "live" : ""}`} onClick={toggle} disabled={state === "busy"} aria-label={state === "rec" ? t("থামান") : t("বলা শুরু করুন")}>
        <Icon name="mic" size={34} />
      </button>
      <p className="muted" style={{ textAlign: "center" }}>
        {state === "idle" && t("Mic চেপে বলুন, শেষ হলে আবার চাপুন")}
        {state === "rec" && t("শুনছি… শেষ হলে আবার চাপুন")}
        {state === "busy" && t("বুঝে নিচ্ছি…")}
        {state === "done" && t("মিলিয়ে দেখুন, দরকার হলে ঠিক করে Save করুন")}
      </p>
      <div className="card" style={{ background: "var(--paper)", border: 0, fontSize: 14, color: "var(--ink-2)" }}>
        {text ? `"${text}"` : t('যেমন: "তাসলিমা বেগম, নাম্বার জিরো ওয়ান সেভেন ওয়ান ওয়ান টু থ্রি ফোর ফাইভ সিক্স সেভেন, দুইটা থ্রি-পিস নিয়েছেন বত্রিশশো টাকা"')}
      </div>
      {err && <div className="err">{err}</div>}
      {parsed && <ManualForm initial={parsed} source="voice" onDone={() => { setParsed(null); setText(""); setState("idle"); }} />}
    </div>
  );
}
