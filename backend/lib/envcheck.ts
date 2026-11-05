/**
 * Checks .env before Dakly starts. No network, no database: only presence and format.
 * Used by scripts/doctor.ts (runs on every container start) and the admin System page.
 *
 *   error -> Dakly will not start (core settings) or that feature is switched off with a reason
 *   warn  -> works, but something important is missing for a real launch
 *   ok    -> set and looks right
 */
export type Level = "ok" | "warn" | "error" | "off";
export type Check = { group: string; key: string; level: Level; message: string; fatal?: boolean };

const PLACEHOLDER = /dummy|replace-with|change-me|changeme|example|your[-_]|xxxx|^0+$/i;
/** True for values that are clearly still the example text from .env.example. */
export const isPlaceholder = (v: string) => PLACEHOLDER.test(v) || /^(\+?1?5550000000|ACx+)$/.test(v);
const raw = (e: NodeJS.ProcessEnv, k: string) => (e[k] ?? "").trim();
const set = (e: NodeJS.ProcessEnv, k: string) => { const v = raw(e, k); return !!v && !isPlaceholder(v); };

export function checkEnv(e: NodeJS.ProcessEnv = process.env): Check[] {
  const out: Check[] = [];
  const add = (group: string, key: string, level: Level, message: string, fatal = false) => out.push({ group, key, level, message, fatal });
  const prod = e.NODE_ENV === "production";

  /* ---------- core: the app refuses to start without these ---------- */
  const G = "Core";
  if (!raw(e, "DATABASE_URL")) add(G, "DATABASE_URL", "error", "Not set. docker compose sets it for you; outside Docker give a postgresql:// URL.", true);
  else if (!/^postgres(ql)?:\/\//.test(raw(e, "DATABASE_URL"))) add(G, "DATABASE_URL", "error", "Must start with postgresql://", true);
  else add(G, "DATABASE_URL", "ok", "Set");

  const app = raw(e, "APP_URL");
  let appOk = false;
  try { const u = new URL(app); appOk = /^https?:$/.test(u.protocol); } catch { /* bad */ }
  if (!appOk) add(G, "APP_URL", "error", "Set it to the public address of Dakly, e.g. https://app.yourdomain.com", true);
  else if (!app.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(app)) add(G, "APP_URL", "warn", "Not https. WhatsApp, Twilio, Facebook and payment callbacks need a public https address.");
  else if (!app.startsWith("https://")) add(G, "APP_URL", "warn", "Local address: fine for trying Dakly, but webhooks and payments only work on a public https address.");
  else add(G, "APP_URL", "ok", app);

  for (const k of ["AUTH_SECRET", "ENCRYPTION_KEY"]) {
    const v = raw(e, k);
    if (!v) add(G, k, "error", "Not set. Generate one with: openssl rand -hex 32", true);
    else if (PLACEHOLDER.test(v)) add(G, k, "error", "Still the example value. Generate a real one with: openssl rand -hex 32", true);
    else if (v.length < 32) add(G, k, "error", `Too short (${v.length} characters). Use 32 or more: openssl rand -hex 32`, true);
    else add(G, k, "ok", "Set");
  }
  if (raw(e, "AUTH_SECRET") && raw(e, "AUTH_SECRET") === raw(e, "ENCRYPTION_KEY")) add(G, "ENCRYPTION_KEY", "warn", "Same as AUTH_SECRET. Use two different random values.");
  if (/^(dakly|postgres|password|change-me)?$/.test(raw(e, "POSTGRES_PASSWORD")) && prod) add(G, "POSTGRES_PASSWORD", "warn", "Weak or default database password. Set a long random one before the first start (it cannot be changed by .env later).");

  const admins = raw(e, "ADMIN_EMAILS").split(",").map((x) => x.trim()).filter(Boolean);
  if (!admins.length) add(G, "ADMIN_EMAILS", "warn", "Nobody can open the back office (/admin). Add your email.");
  else if (admins.some((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a))) add(G, "ADMIN_EMAILS", "error", "Contains something that is not an email address.");
  else add(G, "ADMIN_EMAILS", "ok", admins.join(", "));
  if (raw(e, "SIGNUP_APPROVAL") && !["auto", "manual"].includes(raw(e, "SIGNUP_APPROVAL"))) add(G, "SIGNUP_APPROVAL", "error", 'Must be "auto" or "manual".');

  /* ---------- email ---------- */
  const M = "Email";
  if (!set(e, "SMTP_HOST")) add(M, "SMTP_HOST", "warn", "No email server: password reset, receipts, approvals and ticket replies are only written to the log. Set SMTP_HOST/PORT/USER/PASS (e.g. Zoho, Brevo, Amazon SES, Gmail).");
  else {
    const port = Number(raw(e, "SMTP_PORT") || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) add(M, "SMTP_PORT", "error", "Not a port number (usually 587 or 465).");
    else add(M, "SMTP_HOST", "ok", `${raw(e, "SMTP_HOST")}:${port}`);
    if (raw(e, "SMTP_USER") && !raw(e, "SMTP_PASS")) add(M, "SMTP_PASS", "warn", "SMTP_USER is set but SMTP_PASS is empty.");
    if (raw(e, "MAIL_FROM") && !/<?[^@\s<]+@[^@\s>]+>?/.test(raw(e, "MAIL_FROM"))) add(M, "MAIL_FROM", "error", 'Use the form: Dakly <no-reply@yourdomain.com>');
  }

  /* ---------- providers: all keys of a group, or none ---------- */
  // trigger: the keys whose presence means "this provider is meant to be on" (others may have defaults)
  const group = (name: string, keys: string[], fmt: Record<string, [RegExp, string]> = {}, offMsg = "Not set: this channel runs in test mode (nothing is sent).", trigger = keys) => {
    const have = keys.filter((k) => set(e, k));
    if (!trigger.some((k) => set(e, k))) { add(name, keys[0], "off", offMsg); return false; }
    let good = true;
    for (const k of keys) if (!set(e, k)) { add(name, k, "error", `Missing (or still a placeholder) while ${have.join(", ")} ${have.length > 1 ? "are" : "is"} set. ${name} stays off until it is filled in.`); good = false; }
    for (const [k, [re, hint]] of Object.entries(fmt)) if (set(e, k) && !re.test(raw(e, k))) { add(name, k, "error", hint); good = false; }
    if (good) add(name, keys[0], "ok", "Set");
    return good;
  };

  group("OpenAI", ["OPENAI_API_KEY"], { OPENAI_API_KEY: [/^sk-/, "Should start with sk-"] }, "Not set: AI writing, voice input, AI calls and AI tips use simple templates instead.");
  if (group("WhatsApp", ["WA_PHONE_NUMBER_ID", "WA_ACCESS_TOKEN", "WA_TEMPLATE_NAME"], { WA_PHONE_NUMBER_ID: [/^\d{6,20}$/, "Digits only (the Phone number ID from Meta, not the phone number)"], WA_TEMPLATE_NAME: [/^[a-z0-9_]+$/, "Template names are lowercase letters, digits and _"] }, undefined, ["WA_PHONE_NUMBER_ID", "WA_ACCESS_TOKEN"])) {
    if (!set(e, "WA_APP_SECRET")) add("WhatsApp", "WA_APP_SECRET", "error", "Needed to accept Meta webhooks (inbox, delivery receipts, STOP). Copy it from Meta App settings, Basic.");
    if (!set(e, "WA_VERIFY_TOKEN")) add("WhatsApp", "WA_VERIFY_TOKEN", "error", "Needed to register the webhook in Meta. Use any random string and enter the same in Meta.");
  }
  const smsGw = group("SMS gateway", ["SMS_API_URL", "SMS_API_KEY"], { SMS_API_URL: [/^https:\/\//, "Must start with https://"] }, "Not set: Bangladesh SMS uses Twilio if set, otherwise test mode.", ["SMS_API_KEY"]);
  if (smsGw && !raw(e, "SMS_SENDER_ID")) add("SMS gateway", "SMS_SENDER_ID", "warn", "Empty sender ID: many BD gateways reject messages without one.");
  const tw = group("Twilio", ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"], { TWILIO_ACCOUNT_SID: [/^AC[0-9a-f]{32}$/i, "Should be AC followed by 32 letters/digits"], TWILIO_FROM: [/^\+\d{8,15}$/, "Use international format: +15551234567"], TWILIO_SMS_FROM: [/^(\+\d{8,15})?$/, "Use international format: +15551234567"] }, "Not set: AI voice calls and international SMS run in test mode.");
  if (tw && !set(e, "OPENAI_API_KEY")) add("Twilio", "OPENAI_API_KEY", "warn", "AI voice calls also need OPENAI_API_KEY (speech).");
  group("Facebook", ["FB_APP_ID", "FB_APP_SECRET"], { FB_APP_ID: [/^\d{5,20}$/, "Digits only (App ID)"] }, "Not set: merchants cannot connect a Facebook Page (posts fail with a clear reason).");

  const ssl = group("SSLCommerz", ["SSLCZ_STORE_ID", "SSLCZ_STORE_PASSWORD"], {}, "Not set: Bangladesh shops cannot pay online (they see 'contact support'; admins can still give plans by hand).");
  if (ssl) {
    const sb = raw(e, "SSLCZ_SANDBOX");
    if (sb !== "false" && prod) add("SSLCommerz", "SSLCZ_SANDBOX", "warn", "Sandbox mode: payments are test payments. Set SSLCZ_SANDBOX=false with your live store ID to take real money.");
  }
  const st = group("Stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], { STRIPE_SECRET_KEY: [/^(sk|rk)_(live|test)_/, "Should start with sk_live_ or sk_test_"], STRIPE_WEBHOOK_SECRET: [/^whsec_/, "Should start with whsec_"] }, "Not set: shops outside Bangladesh cannot pay online.");
  if (st && /_test_/.test(raw(e, "STRIPE_SECRET_KEY")) && prod) add("Stripe", "STRIPE_SECRET_KEY", "warn", "Test key: no real money is taken. Use sk_live_ for launch.");

  /* ---------- scheduler and misc ---------- */
  if (raw(e, "RUN_SCHEDULER") === "false" && !set(e, "CRON_SECRET")) add("Scheduler", "CRON_SECRET", "error", "RUN_SCHEDULER=false but no CRON_SECRET: nothing will send scheduled campaigns or posts.");
  for (const k of ["PRICE_STARTER_BDT", "PRICE_GROWTH_BDT", "PRICE_STARTER_USD", "PRICE_GROWTH_USD", "USD_TO_BDT", "COST_WA_BDT", "COST_SMS_BDT", "COST_VOICE_BDT", "COST_AI_BDT"])
    if (raw(e, k) && !(Number(raw(e, k)) > 0)) add("Prices", k, "error", "Must be a positive number (or empty for the default).");
  const fp = raw(e, "ANDROID_CERT_SHA256");
  if (fp && fp.split(",").some((x) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(x.trim()))) add("Android", "ANDROID_CERT_SHA256", "error", "Each fingerprint must be 32 hex pairs separated by colons (from Play Console, App signing).");
  for (const k of ["SUPPORT_EMAIL"]) if (raw(e, k) && !/^[^@\s]+@[^@\s]+$/.test(raw(e, k))) add("Core", k, "error", "Not an email address.");
  return out;
}

export const fatal = (c: Check[]) => c.filter((x) => x.fatal);

/** Text table for logs and the CLI. */
export function formatChecks(checks: { group: string; key: string; level: Level; message: string }[]) {
  const icon = { ok: "  OK  ", warn: " WARN ", error: "ERROR ", off: "  --  " } as const;
  return checks.map((c) => `${icon[c.level]} ${c.group.padEnd(12)} ${c.key.padEnd(22)} ${c.message}`).join("\n");
}
