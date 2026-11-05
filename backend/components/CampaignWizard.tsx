"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { aiMessage, createCampaign } from "@/app/actions";
import { useLoc } from "./I18n";

const SEGS = [
  ["inactive", "Inactive Customer", "৬০ দিনের বেশি কেনেননি · Winback"],
  ["vip", "VIP Customer", "সবচেয়ে বেশি কেনেন · Exclusive Offer"],
  ["regular", "Regular Customer", "নিয়মিত কেনেন"],
  ["new", "New Customer", "গত ৩০ দিনে প্রথম কেনা · Welcome Offer"],
  ["all", "সব Customer", "সবাইকে একই Message"],
] as const;
const CHANNELS = [
  ["wa", "WhatsApp", "W", "#1fa855", "পড়ার হার সবচেয়ে বেশি। না পৌঁছালে SMS-এ যাবে (SMS বাছলে)"],
  ["sms", "SMS", "S", "#2f6690", "যাদের WhatsApp নেই তাদের কাছেও পৌঁছায়"],
  ["voice", "AI Voice Call", "☎", "#070707", "AI ফোন করে Offer জানাবে, আগ্রহী হলে Customer ১ চাপবেন"],
] as const;
const STEP = ["", "কাকে পাঠাবেন?", "কোথায় পাঠাবেন?", "কী বলবেন?", "দেখে নিন, পাঠান"];

export function CampaignWizard(props: {
  shopName: string; counts: Record<string, number>; sample: Record<string, string>; initialSegment: string;
  ready: { wa: boolean; sms: boolean; voice: boolean }; left: number | null;
  initialOffer: string; voicePlan: boolean; best: { label: string; at: string };
}) {
  const router = useRouter();
  const { t, f, lang } = useLoc();
  const bn = (x: number) => f.n(x);
  const NAME = lang === "bn" ? "{নাম}" : "{name}", PRODUCT = lang === "bn" ? "{পণ্য}" : "{product}";
  const [step, setStep] = useState(1);
  const [segment, setSegment] = useState(props.initialSegment);
  const [channels, setChannels] = useState<string[]>(["wa"]);
  const [offer, setOffer] = useState(props.initialOffer);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState("");
  const [err, setErr] = useState("");
  const [busy, startBusy] = useTransition();
  const voice = channels.includes("voice");
  const n = props.counts[segment] ?? 0;

  function toggle(ch: string) {
    if (ch === "voice" && !props.voicePlan) return;
    setMessage("");
    if (ch === "voice") return setChannels(voice ? ["wa"] : ["voice"]);
    const base = channels.filter((c) => c !== "voice");
    setChannels(base.includes(ch) ? base.filter((c) => c !== ch) : [...base, ch]);
  }
  function write() {
    setErr("");
    startBusy(async () => {
      const r = await aiMessage({ segment, offer, channel: voice ? "voice" : "text" });
      if (r.error) setErr(r.error); else setMessage(r.text ?? "");
    });
  }
  function submit() {
    setErr("");
    startBusy(async () => {
      const r = await createCampaign({
        name: name || `${t(SEGS.find((s) => s[0] === segment)?.[1] ?? "")} · ${offer.slice(0, 30) || "Offer"}`,
        segment, message, channels, when, sendAt: sendAt ? new Date(sendAt).toISOString() : undefined,
      });
      if (r.error) setErr(r.error); else router.push(`/campaigns/${r.id}`);
    });
  }
  const first = (props.sample[segment] ?? t("রহিমা")).split(" ")[0];
  const preview = message.replace(/\{নাম\}|\{name\}/g, first).replace(/\{পণ্য\}|\{product\}/g, t("[ওনার জন্য বাছা পণ্য]"));
  const notReady = channels.filter((c) => !props.ready[c as "wa"]);

  return (
    <>
      <div className="steps">{[1, 2, 3, 4].map((i) => <div key={i} className={i <= step ? "on" : ""} />)}</div>
      <div className="step-l">{t("ধাপ {a}/{b}", { a: step, b: 4 })} · {t(STEP[step])}</div>
      <div className="grid2">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {step === 1 && (
            <div className="pick">
              {SEGS.map(([k, l, d]) => (
                <button key={k} type="button" className={`pk ${segment === k ? "on" : ""}`} onClick={() => { setSegment(k); setMessage(""); }}>
                  <span className="radio" /><span className="t"><b>{t(l)}</b><span>{t(d)}</span></span><span className="n num">{bn(props.counts[k] ?? 0)}</span>
                </button>
              ))}
            </div>
          )}
          {step === 2 && (
            <>
              <div className="pick">
                {CHANNELS.map(([k, l, ic, bg, d]) => (
                  <button key={k} type="button" className={`pk ${channels.includes(k) ? "on" : ""}`} onClick={() => toggle(k)}>
                    <span className="ch-ic" style={{ background: bg }}>{ic}</span>
                    <span className="t"><b>{l} {k === "voice" && !props.voicePlan ? <span className="badge b-vip">Growth Plan</span> : !props.ready[k] && <span className="badge b-test">{t("Setup বাকি")}</span>}</b><span>{t(d)}</span></span>
                    <span className="box">{channels.includes(k) && <Icon name="check" size={14} stroke={3} />}</span>
                  </button>
                ))}
              </div>
              <p className="muted">{t("AI Voice Call আলাদা Campaign হিসেবে যায়, কারণ এর Message হয় কথা বলার Script।")}</p>
            </>
          )}
          {step === 3 && (
            <>
              <label className="field">{t("কী জানাতে চান?")} <small>{t("যেমন: শীতের নতুন শাল এসেছে, ১৫% ছাড়, শুক্রবার পর্যন্ত")}</small>
                <input id="offer" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={t("Offer বা খবর লিখুন")} />
              </label>
              <div className="row-btns"><button type="button" className="btn ghost" onClick={write} disabled={busy}><Icon name="spark" size={16} /> {message ? t("আবার লিখুন") : t("AI দিয়ে লিখুন")}</button></div>
              <label className="field">{voice ? t("ফোন কলের Script") : "Message"} <small>{t("{a} জায়গায় প্রত্যেকের নাম বসবে। {b} লিখলে AI প্রত্যেকের জন্য আলাদা পণ্য বেছে বসাবে (যা উনি এখনো কেনেননি)।", { a: NAME, b: PRODUCT })}</small>
                <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={7} placeholder={busy ? t("লিখছি…") : ""} />
              </label>
            </>
          )}
          {step === 4 && (
            <div className="card">
              <dl className="summary">
                <dt>{t("কাকে")}</dt><dd>{t(SEGS.find((s) => s[0] === segment)?.[1] ?? "")} · {t("{n} জন", { n })}</dd>
                <dt>Channel</dt><dd>{channels.map((c) => CHANNELS.find((x) => x[0] === c)?.[1]).join(", ")}</dd>
                <dt>{t("কখন")}</dt><dd><span className="chips" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className={`chip ${when === "now" ? "on" : ""}`} onClick={() => setWhen("now")}>{t("এখনই")}</button>
                  <button type="button" className={`chip ${when === "later" ? "on" : ""}`} onClick={() => setWhen("later")}>{t("পরে")}</button></span></dd>
              </dl>
              {when === "later" && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <button type="button" className="note-ai" style={{ border: 0, textAlign: "left", cursor: "pointer" }} onClick={() => { const d = new Date(props.best.at); setSendAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }}>
                    <Icon name="spark" size={16} /><span>{t("AI সেরা সময়:")} <b>{props.best.label}</b>. {t("এই সময়ে Schedule করতে চাপুন।")}</span>
                  </button>
                </div>
              )}
              {when === "later" && <label className="field" style={{ marginTop: 10 }}>{t("তারিখ ও সময়")}<input id="sendAt" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} /></label>}
              <label className="field" style={{ marginTop: 10 }}>{t("Campaign-এর নাম")} <small>({t("ঐচ্ছিক")})</small><input id="cname" value={name} onChange={(e) => setName(e.target.value)} /></label>
              {props.left !== null && <p className="muted" style={{ marginTop: 10 }}>{t("এই মাসে আরও {n}টি Message পাঠাতে পারবেন।", { n: props.left })}</p>}
              {notReady.length > 0 && <div className="err" style={{ marginTop: 10 }}>{notReady.map((c) => CHANNELS.find((x) => x[0] === c)?.[1]).join(", ")} {t("এখনো Settings-এ Connect করা নেই। Test mode-এ চলবে: কিছু পাঠানো হবে না, শুধু হিসাব থাকবে।")}</div>}
            </div>
          )}
          {err && <div className="err" role="alert">{err}</div>}
          <div className="nav-btns">
            {step > 1 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>{t("আগের ধাপ")}</button>}
            {step < 4 ? (
              <button type="button" className="btn primary" disabled={(step === 1 && !n) || (step === 2 && !channels.length) || (step === 3 && message.trim().length < 5) || busy}
                onClick={() => { setStep(step + 1); if (step === 2 && !message && offer) write(); }}>{t("পরের ধাপ")}</button>
            ) : (
              <button type="button" className="btn primary" disabled={busy || (when === "later" && !sendAt)} onClick={submit}>
                <Icon name={voice ? "phone" : "mega"} size={18} /> {busy ? t("অপেক্ষা করুন…") : when === "now" ? t("{n} জনকে এখনই পাঠান", { n }) : t("Schedule করুন")}
              </button>
            )}
          </div>
          {step === 1 && !n && <p className="muted">{t("এই দলে এখনো কোনো Customer নেই।")}</p>}
        </div>
        <div style={{ minWidth: 0 }}>
          {message && !voice && (
            <div className="wa"><div className="wa-h">Preview · {props.sample[segment]}</div><div className="bubble">{preview}</div></div>
          )}
          {message && voice && (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <b><Icon name="phone" size={16} /> {t("{name}-কে AI যা বলবে", { name: props.sample[segment] ?? "" })}</b>
              <p style={{ whiteSpace: "pre-wrap" }}>{preview}</p>
              <p className="muted">{t('Customer ১ চাপলে Campaign-এ "আগ্রহী" দেখাবে।')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
