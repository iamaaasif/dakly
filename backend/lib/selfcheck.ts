/**
 * Live self-check: signs in to every configured provider with the keys from .env and reports
 * whether each one really works. Runs at startup (logged and shown in /admin/system) and from
 * `docker compose exec app npm run doctor`. Read-only calls only; nothing is sent or charged.
 */
import nodemailer from "nodemailer";
import { checkEnv, isPlaceholder, type Level } from "./envcheck";

export type Live = { group: string; key: string; level: Level; message: string };
const v = (k: string) => { const x = (process.env[k] || "").trim(); return x && !isPlaceholder(x) ? x : null; };

async function call(url: string, init: RequestInit = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const text = await res.text();
    let json: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  } finally { clearTimeout(t); }
}
const why = (r: { status: number; json: Record<string, any>; text: string }) => // eslint-disable-line @typescript-eslint/no-explicit-any
  String(r.json?.error?.message ?? r.json?.message ?? r.json?.error ?? r.text).slice(0, 160);

export async function liveCheck(opts: { db?: () => Promise<unknown> } = {}): Promise<Live[]> {
  const out: Live[] = [];
  const run = async (group: string, key: string, fn: () => Promise<string>) => {
    try { out.push({ group, key, level: "ok", message: await fn() }); }
    catch (e) { out.push({ group, key, level: "error", message: (e as Error).name === "AbortError" ? "No answer within 10 seconds (network or firewall?)" : (e as Error).message }); }
  };
  const tasks: Promise<void>[] = [];

  if (opts.db) tasks.push(run("Core", "DATABASE_URL", async () => {
    try { await opts.db!(); return "Connected"; }
    catch (e) {
      const m = (e as Error).message;
      if (/authentication failed|password/i.test(m)) throw new Error("Database refused the password. POSTGRES_PASSWORD was changed after the first start: put the old one back, or reset the database volume.");
      if (/does not exist|relation/i.test(m)) throw new Error("Tables are missing: migrations did not run (npx prisma migrate deploy).");
      throw new Error("Cannot reach the database: " + m.slice(0, 120));
    }
  }));
  if (v("OPENAI_API_KEY")) tasks.push(run("OpenAI", "OPENAI_API_KEY", async () => {
    const r = await call("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${v("OPENAI_API_KEY")}` } });
    if (r.status === 401) throw new Error("OpenAI says the key is wrong or revoked.");
    if (r.status === 429) throw new Error("OpenAI account has no credit or is rate limited (add billing at platform.openai.com).");
    if (r.status !== 200) throw new Error(`OpenAI ${r.status}: ${why(r)}`);
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const ids: string[] = (r.json.data ?? []).map((m: { id: string }) => m.id);
    return ids.length && !ids.includes(model) ? `Key works, but model ${model} is not available to it` : "Key works";
  }));
  if (v("WA_PHONE_NUMBER_ID") && v("WA_ACCESS_TOKEN")) tasks.push(run("WhatsApp", "WA_ACCESS_TOKEN", async () => {
    const r = await call(`https://graph.facebook.com/v21.0/${v("WA_PHONE_NUMBER_ID")}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${v("WA_ACCESS_TOKEN")}` } });
    if (r.status === 401 || r.json?.error?.code === 190) throw new Error("Meta says the access token is invalid or expired. Use a permanent System User token.");
    if (r.status !== 200) throw new Error(`Meta ${r.status}: ${why(r)} (check WA_PHONE_NUMBER_ID)`);
    return `Number ${r.json.display_phone_number ?? ""} ${r.json.verified_name ? `(${r.json.verified_name})` : ""}`.trim();
  }));
  if (v("TWILIO_ACCOUNT_SID") && v("TWILIO_AUTH_TOKEN")) tasks.push(run("Twilio", "TWILIO_AUTH_TOKEN", async () => {
    const sid = v("TWILIO_ACCOUNT_SID")!;
    const r = await call(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: "Basic " + Buffer.from(`${sid}:${v("TWILIO_AUTH_TOKEN")}`).toString("base64") } });
    if (r.status === 401) throw new Error("Twilio refused the Account SID / Auth Token pair.");
    if (r.status !== 200) throw new Error(`Twilio ${r.status}: ${why(r)}`);
    if (r.json.status && r.json.status !== "active") throw new Error(`Twilio account is ${r.json.status}.`);
    return "Account active";
  }));
  if (v("SMS_API_URL") && v("SMS_API_KEY")) tasks.push(run("SMS gateway", "SMS_API_KEY", async () => {
    const u = new URL(v("SMS_API_URL")!);
    if (!/bulksmsbd/.test(u.host)) return `Format OK (${u.host}; live check only for BulkSMSBD)`;
    const r = await call(`${u.origin}/api/getBalanceApi?api_key=${encodeURIComponent(v("SMS_API_KEY")!)}`);
    if (r.json.balance === undefined) throw new Error(`Gateway did not accept the key: ${why(r)}`);
    return `Key works, balance ${r.json.balance}`;
  }));
  if (v("FB_APP_ID") && v("FB_APP_SECRET")) tasks.push(run("Facebook", "FB_APP_SECRET", async () => {
    const r = await call(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${v("FB_APP_ID")}&client_secret=${encodeURIComponent(v("FB_APP_SECRET")!)}&grant_type=client_credentials`);
    if (r.status !== 200 || !r.json.access_token) throw new Error(`Facebook refused the App ID / App Secret: ${why(r)}`);
    return "App ID and secret work";
  }));
  if (v("STRIPE_SECRET_KEY")) tasks.push(run("Stripe", "STRIPE_SECRET_KEY", async () => {
    const r = await call("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${v("STRIPE_SECRET_KEY")}` } });
    if (r.status === 401) throw new Error("Stripe says the secret key is wrong.");
    if (r.status !== 200) throw new Error(`Stripe ${r.status}: ${why(r)}`);
    return r.json.livemode ? "Live key works" : "Test key works (no real money)";
  }));
  if (v("SSLCZ_STORE_ID") && v("SSLCZ_STORE_PASSWORD")) tasks.push(run("SSLCommerz", "SSLCZ_STORE_ID", async () => {
    // A validation lookup for a made-up id: a wrong store gives a credential error, a right one "invalid transaction"
    const base = process.env.SSLCZ_SANDBOX === "false" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
    const r = await call(`${base}/validator/api/validationserverAPI.php?val_id=selfcheck&store_id=${encodeURIComponent(v("SSLCZ_STORE_ID")!)}&store_passwd=${encodeURIComponent(v("SSLCZ_STORE_PASSWORD")!)}&format=json`);
    if (/credential|de-?active|not found/i.test(r.text)) throw new Error(`SSLCommerz refused the store ID / password (${process.env.SSLCZ_SANDBOX === "false" ? "live" : "sandbox"}).`);
    return `Reachable (${process.env.SSLCZ_SANDBOX === "false" ? "live" : "sandbox"})`;
  }));
  if (v("SMTP_HOST")) tasks.push(run("Email", "SMTP_HOST", async () => {
    const port = Number(process.env.SMTP_PORT || 587);
    const t = nodemailer.createTransport({ host: v("SMTP_HOST")!, port, secure: port === 465, auth: v("SMTP_USER") ? { user: v("SMTP_USER")!, pass: process.env.SMTP_PASS || "" } : undefined, connectionTimeout: 10_000, greetingTimeout: 10_000 });
    try { await t.verify(); } catch (e) { throw new Error(/auth|535|credentials/i.test((e as Error).message) ? "Mail server refused SMTP_USER / SMTP_PASS." : `Cannot talk to the mail server: ${(e as Error).message.slice(0, 120)}`); }
    return "Mail server accepts the login";
  }));
  await Promise.all(tasks);
  return out;
}

/** Everything for the System page and the CLI: format checks plus live checks. */
export async function fullCheck(opts: { db?: () => Promise<unknown> } = {}) {
  return { env: checkEnv(), live: await liveCheck(opts), at: new Date().toISOString() };
}
