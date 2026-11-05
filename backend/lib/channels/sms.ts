import type { ChannelConfig } from "../config";
type SMS = NonNullable<ChannelConfig["sms"]>;

/** Sends an SMS through the shop's provider: an HTTP gateway (Bangladesh) or Twilio (worldwide). */
export async function sendSms(cfg: SMS, to: string, text: string) {
  return cfg.kind === "twilio" ? sendTwilioSms(cfg, to, text) : sendGatewaySms(cfg, to, text);
}

async function sendTwilioSms(cfg: Extract<SMS, { kind: "twilio" }>, to: string, text: string) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64") },
    body: new URLSearchParams({ To: "+" + to, From: cfg.from, Body: text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Twilio SMS ${res.status}`);
  return String(data.sid ?? "");
}

/**
 * HTTP SMS gateway with the common "api_key / senderid / number / message" form API (e.g. BulkSMSBD).
 * Other gateways: adapt the field names here.
 */
async function sendGatewaySms(cfg: Extract<SMS, { kind: "gateway" }>, to: string, text: string) {
  const body = new URLSearchParams({ api_key: cfg.key, senderid: cfg.sender, number: to, message: text, type: "unicode" });
  const res = await fetch(cfg.url, { method: "POST", body });
  const raw = await res.text();
  if (!res.ok) throw new Error(`SMS gateway ${res.status}: ${raw.slice(0, 200)}`);
  let id = "";
  try {
    const j = JSON.parse(raw);
    const code = j.response_code ?? j.status_code ?? j.code;
    if (code !== undefined && ![200, 202, "200", "202", "SUCCESS"].includes(code)) throw new Error(j.error_message || j.message || raw.slice(0, 200));
    id = String(j.message_id ?? j.id ?? "");
  } catch (e) {
    if (e instanceof SyntaxError) return "";
    throw e;
  }
  return id;
}
