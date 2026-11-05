import crypto from "node:crypto";
import { appUrl } from "./config";

/** Signed, unguessable opt-out link for one customer: /u/<customerId>.<sig>. */
const sig = (id: string) => crypto.createHmac("sha256", process.env.AUTH_SECRET || "").update("optout:" + id).digest("base64url").slice(0, 10);
export const optoutToken = (customerId: string) => `${customerId}.${sig(customerId)}`;
export const optoutUrl = (customerId: string) => `${appUrl()}/u/${optoutToken(customerId)}`;
export function readOptoutToken(token: string): string | null {
  const [id, s] = token.split(".");
  if (!id || !s || s.length !== 10) return null;
  return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(sig(id))) ? id : null;
}
/** SMS campaigns end with an opt-out link (turn off with SMS_OPTOUT_LINK=false). */
export const smsFooter = (customerId: string, lang: string) =>
  process.env.SMS_OPTOUT_LINK === "false" ? "" : `\n${lang === "bn" ? "বন্ধ করতে" : "Stop"}: ${optoutUrl(customerId)}`;
