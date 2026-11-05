import "server-only";
import nodemailer from "nodemailer";
import { appUrl, env, supportEmail } from "./config";
import { logError } from "./audit";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
const transporter = () => {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: env("SMTP_HOST")!, port, secure: port === 465,
    auth: env("SMTP_USER") ? { user: env("SMTP_USER")!, pass: process.env.SMTP_PASS || "" } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  return transport;
};
export const mailReady = () => !!env("SMTP_HOST");
export const verifyMail = () => transporter().verify();

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
/** Simple branded HTML version of a plain-text email. Links become buttons when they are on their own line. */
function html(text: string) {
  const body = esc(text).split("\n").map((l) => {
    const u = l.trim().match(/^(https?:\/\/\S+)$/);
    return u ? `<p><a href="${u[1]}" style="display:inline-block;background:#c8402a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">${u[1].length > 60 ? "Open" : u[1]}</a></p>` : l ? `<p style="margin:0 0 10px">${l.replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>` : "";
  }).join("");
  return `<!doctype html><meta charset="utf-8"><div style="font-family:system-ui,-apple-system,'Noto Sans Bengali',sans-serif;background:#f3f5f2;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #d5dcd4;border-radius:14px;padding:24px;color:#13261d;font-size:15px;line-height:1.55"><div style="font-weight:800;font-size:20px;color:#c8402a;margin-bottom:14px">Dakly</div>${body}<hr style="border:0;border-top:1px solid #e3e8e2;margin:18px 0"><p style="color:#5b6b62;font-size:12.5px;margin:0">Dakly · ${esc(appUrl())} · ${esc(supportEmail())}</p></div></div>`;
}

/**
 * Sends an email through SMTP (plain text plus a simple HTML version).
 * Without SMTP_HOST the message is printed to the server log instead, so nothing breaks in test setups.
 * Never throws: failures are written to the error log (System page) and false is returned.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!mailReady()) {
    console.log(`[mail:not-configured] to=${to} subject=${subject}\n${text}`);
    return false;
  }
  try {
    await transporter().sendMail({ from: process.env.MAIL_FROM || "Dakly <no-reply@dakly.com.bd>", replyTo: supportEmail(), to, subject, text, html: html(text) });
    return true;
  } catch (e) {
    transport = null;
    await logError("mail", e);
    return false;
  }
}

/** Emails every address in ADMIN_EMAILS (new pending merchant, payment problems). */
export async function mailAdmins(subject: string, text: string) {
  for (const a of (process.env.ADMIN_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean)) await sendMail(a, subject, text);
}
