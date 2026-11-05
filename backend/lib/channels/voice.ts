import crypto from "node:crypto";
import { appUrl, type ChannelConfig } from "../config";
type Voice = NonNullable<ChannelConfig["voice"]>;
const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/**
 * Places an AI voice call with Twilio. Twilio plays the Bangla speech that
 * /api/voice/audio/[id] generates with OpenAI, then waits for a key press.
 * Pressing 1 marks the customer as interested.
 */
export async function placeCall(cfg: Voice, to: string, messageId: string) {
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
