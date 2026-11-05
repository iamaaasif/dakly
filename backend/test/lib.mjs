// Shared helpers for the end-to-end tests.
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const BASE = process.env.BASE || "http://localhost:3000";
export const MOCK = process.env.MOCK || "http://localhost:9090";
export const SECRETS = { wa: "wa-app-secret-test", twilio: "twilio-test-token", stripe: "whsec_testsecret", cron: "cron-test-secret", verify: "verify-me" };
const COMPOSE = (process.env.COMPOSE || "docker compose -f docker-compose.yml -f test/docker-compose.test.yml").split(" ");

/* ---------- tiny test runner ---------- */
export const results = [];
let area = "";
export const section = (name) => { area = name; console.log(`\n## ${name}`); };
export async function t(id, name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ id, area, name, ok: true, ms: Date.now() - t0 });
    console.log(`  PASS ${id} ${name}`);
  } catch (e) {
    results.push({ id, area, name, ok: false, ms: Date.now() - t0, error: String(e?.message ?? e).slice(0, 600) });
    console.log(`  FAIL ${id} ${name}\n       ${String(e?.message ?? e).slice(0, 600)}`);
  }
}
export function eq(a, b, msg = "") { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
export function ok(v, msg = "assertion failed") { if (!v) throw new Error(msg); }

/* ---------- HTTP ---------- */
export async function api(method, path, { token, body, lang = "en", headers = {}, raw = false, form } = {}) {
  const h = { "Accept-Language": lang, ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h["Content-Type"] = "application/json"; payload = typeof body === "string" ? body : JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
  if (raw) return res;
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { _text: text }; }
  return { status: res.status, json, headers: res.headers };
}
export const get = (p, o) => api("GET", p, o);
export const post = (p, body, o = {}) => api("POST", p, { ...o, body });
export const patch = (p, body, o = {}) => api("PATCH", p, { ...o, body });
export const del = (p, body, o = {}) => api("DELETE", p, { ...o, body });

export async function mock(path, body) {
  const r = await fetch(MOCK + path, body ? { method: "POST", body: JSON.stringify(body) } : {});
  return r.json();
}
export const mockLog = (host) => mock(`/__log?host=${host}`);
export const mail = () => mock("/__mail");
export const fail = (host, status, opts = {}) => mock("/__fail", { host, status, ...opts });

/* ---------- database and scheduler ---------- */
export function sql(q) {
  return execFileSync(COMPOSE[0], [...COMPOSE.slice(1), "exec", "-T", "db", "psql", "-U", "dakly", "-d", "dakly", "-tAc", q], { encoding: "utf8" }).trim();
}
export const cron = () => get(`/api/cron?key=${SECRETS.cron}`);

/* ---------- signed provider webhooks ---------- */
export async function waWebhook(payload, secret = SECRETS.wa) {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return fetch(BASE + "/api/webhooks/whatsapp", { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig }, body: raw });
}
export const waInbound = (phoneNumberId, from, text, id = "wamid.IN" + crypto.randomBytes(5).toString("hex"), name = "Inbound Person") =>
  waWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneNumberId }, contacts: [{ wa_id: from, profile: { name } }], messages: [{ from, id, type: "text", text: { body: text } }] } }] }] });
export const waStatus = (id, status) => waWebhook({ entry: [{ changes: [{ value: { statuses: [{ id, status }] } }] }] });

export async function twilioHook(query, params, token = SECRETS.twilio) {
  const url = BASE + "/api/webhooks/twilio" + query;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const sig = crypto.createHmac("sha1", token).update(data).digest("base64");
  return fetch(url, { method: "POST", headers: { "X-Twilio-Signature": sig, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
}
export async function stripeHook(event, secret = SECRETS.stripe) {
  const raw = JSON.stringify(event), ts = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
  return fetch(BASE + "/api/billing/stripe", { method: "POST", headers: { "Stripe-Signature": `t=${ts},v1=${v1}`, "Content-Type": "application/json" }, body: raw });
}

/* ---------- accounts ---------- */
export const uniq = () => crypto.randomBytes(4).toString("hex");
export async function newShop(extra = {}) {
  const email = `m-${uniq()}@dakly.test`;
  // A different client IP per sign-up so the per-IP sign-up limit does not trip in tests
  const ip = `198.51.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const r = await post("/api/v1/auth/register", { name: "Test Owner", shop: "Test Shop " + uniq(), email, password: "password123", ...extra }, { headers: { "X-Forwarded-For": ip } });
  if (r.status !== 201) throw new Error("register failed " + JSON.stringify(r.json));
  const me = await get("/api/v1/me", { token: r.json.token });
  return { token: r.json.token, email, password: extra.password ?? "password123", shopId: me.json.shop.id, userId: me.json.user.id };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function until(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(250); }
  throw new Error("timed out waiting");
}
