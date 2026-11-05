import crypto from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { appUrl, type SipVoice, type TwilioVoice, type VoiceConfig } from "../config";
import { prepareCallAudio } from "../voice-audio";

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** Thrown when a call should wait for the next round (the trunk is at its call limit). */
export class RetryLater extends Error {}

/** The provider that calls this number: the SIP trunk for its countries, Twilio for the rest. */
export function voiceRoute(cfg: VoiceConfig, phone: string): TwilioVoice | SipVoice | null {
  const country = parsePhoneNumberFromString("+" + phone)?.country;
  if (cfg.sip && country && cfg.sip.countries.includes(country)) return cfg.sip;
  return cfg.twilio;
}

/**
 * Places an AI voice call. The speech for the message is made with OpenAI, played to the
 * customer, and pressing 1 marks them as interested. Returns the provider's call id.
 */
export async function placeCall(cfg: VoiceConfig, to: string, messageId: string): Promise<string> {
  const p = voiceRoute(cfg, to);
  if (!p) throw new Error("No voice provider for this country");
  return p.kind === "sip" ? placeSipCall(p, to, messageId) : placeTwilioCall(p, to, messageId);
}

// ---------- Twilio (numbers outside the SIP trunk's countries) ----------

async function placeTwilioCall(cfg: TwilioVoice, to: string, messageId: string) {
  const audio = `${appUrl()}/api/voice/audio/${messageId}`;
  const gather = `${appUrl()}/api/webhooks/twilio?m=${messageId}`;
  const twiml =
    `<Response><Gather numDigits="1" timeout="6" action="${xml(gather)}" method="POST">` +
    `<Play>${xml(audio)}</Play></Gather>` +
    `<Play>${xml(audio)}?part=bye</Play></Response>`;
  const body = new URLSearchParams({
    To: "+" + to,
    From: cfg.from,
    Twiml: twiml,
    StatusCallback: `${appUrl()}/api/webhooks/twilio?m=${messageId}&kind=status`,
    StatusCallbackMethod: "POST",
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Calls.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64") },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Twilio error ${res.status}`);
  return String(data.sid ?? "");
}

/** Checks Twilio's X-Twilio-Signature header. */
export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string | null) {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Asterisk + SIP trunk (IPCallBD) ----------

/** The number as the trunk wants it: intl 8801711234567, local 01711234567, e164 +8801711234567. */
export function trunkNumber(phone: string, format: SipVoice["numberFormat"]) {
  const p = parsePhoneNumberFromString("+" + phone);
  if (!p) throw new Error("Phone number is not valid");
  if (format === "local") return p.formatNational().replace(/\D/g, "");
  if (format === "e164") return p.number;
  return p.number.slice(1);
}

/** Signature Asterisk sends back with each callback for this message. */
export function asteriskSig(messageId: string) {
  const secret = process.env.AUTH_SECRET || process.env.ENCRYPTION_KEY || "";
  return crypto.createHmac("sha256", secret).update("asterisk:" + messageId).digest("hex").slice(0, 40);
}

export function validAsteriskSig(messageId: string, sig: string | null) {
  if (!sig) return false;
  const a = Buffer.from(asteriskSig(messageId)), b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const ari = (cfg: SipVoice, path: string, init?: RequestInit) =>
  fetch(cfg.ariUrl + "/ari" + path, {
    ...init,
    headers: { Authorization: "Basic " + Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64"), "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

/** Dakly calls in progress on Asterisk (one Local/s@dakly-call;1 channel per call). */
export async function activeSipCalls(cfg: SipVoice) {
  const res = await ari(cfg, "/channels");
  if (!res.ok) throw new Error(`Asterisk error ${res.status}`);
  const list = (await res.json()) as { name: string }[];
  return list.filter((c) => c.name.startsWith("Local/s@dakly-call-") && c.name.endsWith(";1")).length;
}

async function placeSipCall(cfg: SipVoice, to: string, messageId: string) {
  if ((await activeSipCalls(cfg)) >= cfg.maxCalls) throw new RetryLater("SIP trunk busy");
  // Make the speech first so the customer hears it the moment they answer
  await prepareCallAudio(messageId, "main", "sln24");
  const q = new URLSearchParams({ endpoint: "Local/s@dakly-call/n", context: "dakly-hold", extension: "s", priority: "1", timeout: "90" });
  const res = await ari(cfg, "/channels?" + q, {
    method: "POST",
    body: JSON.stringify({ variables: { DAKLY_TO: trunkNumber(to, cfg.numberFormat), DAKLY_MSG: messageId, DAKLY_SIG: asteriskSig(messageId) } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Asterisk error ${res.status}`);
  return "sip:" + String(data.id ?? "");
}
