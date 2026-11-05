// Fake versions of every outside service Dakly talks to, for end-to-end tests.
// One HTTPS server answers for all provider hosts (docker network aliases point them here),
// a tiny SMTP server catches email, and an HTTP control port lets tests read logs and inject failures.
//
//   GET  :8080/__log?host=api.openai.com   recorded requests (newest last)
//   GET  :8080/__mail                      caught emails
//   POST :8080/__fail {host, match, status, body, times}   make the next matching call fail
//   POST :8080/__reset                     clear logs, mail and failures
//   POST :8080/__stripe {id, payment_status} change what a Stripe session reports
import https from "node:https";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import { URL } from "node:url";

const CERT_DIR = process.env.CERT_DIR || new URL("./certs/", import.meta.url).pathname;
let log = [], mail = [], fails = [], seq = 1000;
const ssl = new Map(); // tran_id -> amount
const stripe = new Map(); // session id -> session

const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const form = (buf, type = "") => {
  if (type.includes("application/json")) { try { return JSON.parse(buf.toString()); } catch { return {}; } }
  if (type.includes("multipart/form-data")) {
    const out = {};
    for (const m of buf.toString("latin1").matchAll(/name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:[^\r\n]+\r\n)*\r\n([\s\S]*?)\r\n--/g)) out[m[1]] = m[2].length > 200 ? `<${m[2].length} bytes>` : m[2];
    return out;
  }
  return Object.fromEntries(new URLSearchParams(buf.toString()));
};

/* ---------- fixtures ---------- */
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const shopifyOrders = [
  { id: 5001, created_at: daysAgo(3), total_price: "2450.00", phone: "+8801811111111", email: "sumi@example.com", customer: { first_name: "Sumi", last_name: "Akter" }, billing_address: { city: "Dhaka" }, line_items: [{ title: "Jamdani Saree", quantity: 1 }] },
  { id: 5002, created_at: daysAgo(80), total_price: "1200.00", phone: "", customer: { first_name: "Karim", last_name: "Mia", phone: "01822222222" }, billing_address: { city: "Chattogram" }, line_items: [{ title: "Panjabi", quantity: 2 }] },
  { id: 5003, created_at: daysAgo(2), total_price: "999.00", cancelled_at: daysAgo(1), customer: { first_name: "Gone" }, phone: "01833333333", line_items: [] },
];
const shopifyPage2 = [{ id: 5004, created_at: daysAgo(1), total_price: "3100.00", phone: "01844444444", customer: { first_name: "Nadia", last_name: "Islam" }, billing_address: { city: "Sylhet" }, line_items: [{ title: "Three-piece", quantity: 1 }] }];
const wooOrders = [
  { id: 71, status: "completed", total: "1850.00", date_created_gmt: daysAgo(5).slice(0, 19), billing: { first_name: "Tania", last_name: "Rahman", phone: "01955555555", email: "tania@example.com", city: "Khulna" }, line_items: [{ name: "Kurti", quantity: 2 }] },
  { id: 72, status: "refunded", total: "500.00", date_created_gmt: daysAgo(4).slice(0, 19), billing: { first_name: "Refund", phone: "01966666666" }, line_items: [] },
];

function chatReply(body) {
  const sys = body.messages?.[0]?.content ?? "";
  const user = body.messages?.[1]?.content ?? "";
  const bn = /বাংলা|বাংলাদেশের/.test(sys);
  if (body.response_format?.type === "json_object") {
    if (/Extract a customer record/.test(sys)) return JSON.stringify({ name: "Rahim Uddin", phone: "01712345678", items: "Panjabi", amount: 3200 });
    if (/tips/.test(sys)) return JSON.stringify({ tips: [
      { title: "Win back sleeping customers", body: "Mock tip one.", segment: "inactive", offer: "10% off to come back", why: "inactive count" },
      { title: "VIP early access", body: "Mock tip two.", segment: "vip", offer: "VIP preview", why: "top products" },
      { title: "Nudge regulars", body: "Mock tip three.", segment: "bogus", offer: "Weekly deal", why: "slipping" },
    ] });
    return "{}";
  }
  if (/replying on WhatsApp/.test(sys)) return bn ? "জি, [mock-ai] আমরা দেখে জানাচ্ছি।" : "Sure, [mock-ai] let me check.";
  if (/Facebook Page Post|Facebook Page post/.test(user)) return "✨ [mock-ai] post\n#dakly";
  return `${bn ? "{নাম}" : "{name}"}, [mock-ai] ${user.split("\n").find((l) => /^(কী জানাতে চাই|What to say):/.test(l))?.split(":").slice(1).join(":").trim() ?? "offer"}`;
}

/** 2.5 s of a 440 Hz tone as raw 24 kHz 16-bit PCM: what OpenAI returns for response_format "pcm". */
function tone() {
  const sr = 24000, n = sr * 2.5, buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(9000 * Math.sin((2 * Math.PI * 440 * i) / sr)), i * 2);
  return buf;
}

/* ---------- provider routes ---------- */
async function route(host, method, path, q, b, req, res) {
  const auth = req.headers.authorization || "";
  // OpenAI
  if (host === "api.openai.com") {
    if (!/^Bearer sk-/.test(auth)) return send(res, 401, { error: { message: "Incorrect API key provided" } });
    if (path === "/v1/models") return send(res, 200, { data: [{ id: "gpt-4o-mini" }] });
    if (path === "/v1/chat/completions") return send(res, 200, { choices: [{ message: { content: chatReply(b) } }] });
    if (path === "/v1/audio/transcriptions") return send(res, 200, { text: "রহিম উদ্দিন জিরো ওয়ান সেভেন ওয়ান টু থ্রি ফোর ফাইভ সিক্স সেভেন এইট পাঞ্জাবি বত্রিশশো টাকা" });
    if (path === "/v1/audio/speech" && b?.response_format === "pcm") return send(res, 200, tone(), "application/octet-stream");
    if (path === "/v1/audio/speech") return send(res, 200, Buffer.from("ID3mockmp3data"), "audio/mpeg");
  }
  // Meta Graph (WhatsApp Cloud API + Facebook Pages)
  if (host === "graph.facebook.com") {
    const m = path.match(/^\/v[\d.]+\/(.+)$/);
    const p = m?.[1] ?? "";
    if (p === "oauth/access_token") return send(res, 200, { access_token: q.get("fb_exchange_token") ? "LONG-USER-TOKEN" : "SHORT-USER-TOKEN" });
    if (p === "me/accounts") return send(res, 200, { data: [{ id: "PAGE1", name: "Test Page One", access_token: "PAGE1-TOKEN" }, { id: "PAGE2", name: "Test Page Two", access_token: "PAGE2-TOKEN" }] });
    if (/^\d+\/messages$/.test(p) && method === "POST") {
      if (!/^Bearer /.test(auth)) return send(res, 401, { error: { message: "Invalid OAuth access token" } });
      if (b.status === "read") return send(res, 200, { success: true });
      return send(res, 200, { messaging_product: "whatsapp", messages: [{ id: `wamid.MOCK${seq++}` }] });
    }
    if (/^[^/]+\/feed$/.test(p) && method === "POST") return send(res, 200, { id: `${p.split("/")[0]}_${seq++}` });
    if (/^\d+$/.test(p) && method === "GET") return /^Bearer /.test(auth) || q.get("access_token") ? send(res, 200, { id: p, display_phone_number: "+880 1700-000000", verified_name: "Dakly Test" }) : send(res, 401, { error: { message: "Invalid OAuth access token" } });
    if (p === "app" || p === "debug_token") return send(res, 200, { id: "1234", name: "Dakly" });
  }
  if (host === "www.facebook.com") return send(res, 200, "<html>Facebook login (mock)</html>", "text/html");
  // Twilio
  if (host === "api.twilio.com") {
    const m = path.match(/^\/2010-04-01\/Accounts\/(AC\w+)(\.json|\/Messages\.json|\/Calls\.json)$/);
    if (!m) return send(res, 404, { message: "not found" });
    const [user] = Buffer.from(auth.replace("Basic ", ""), "base64").toString().split(":");
    if (user !== m[1]) return send(res, 401, { message: "Authenticate" });
    if (m[2] === ".json") return send(res, 200, { sid: m[1], status: "active", friendly_name: "Mock" });
    if (m[2] === "/Messages.json") return send(res, 201, { sid: `SM${seq++}`, status: "queued" });
    if (m[2] === "/Calls.json") return send(res, 201, { sid: `CA${seq++}`, status: "queued" });
  }
  // BulkSMSBD-style gateway
  if (host === "bulksmsbd.net") {
    if (path === "/api/smsapi") return b.api_key ? send(res, 200, { response_code: 202, message_id: seq++, success_message: "SMS Submitted Successfully" }) : send(res, 200, { response_code: 1002, error_message: "Sender Id/Masking Not Found" });
    if (path === "/api/getBalanceApi") return send(res, 200, { response_code: 202, balance: 1234.5 });
  }
  // SSLCommerz
  if (host === "sandbox.sslcommerz.com" || host === "securepay.sslcommerz.com") {
    if (path === "/gwprocess/v4/api.php") {
      if (!b.store_id || !b.store_passwd) return send(res, 200, { status: "FAILED", failedreason: "Store Credential Error Or Store is De-active" });
      ssl.set(b.tran_id, b.total_amount);
      return send(res, 200, { status: "SUCCESS", sessionkey: "S" + seq++, GatewayPageURL: `https://${host}/EasyCheckOut/${b.tran_id}` });
    }
    if (path === "/validator/api/validationserverAPI.php") {
      const tran = (q.get("val_id") || "").replace(/^VAL-/, "");
      if (!ssl.has(tran)) return send(res, 200, { status: "INVALID_TRANSACTION" });
      return send(res, 200, { status: "VALID", tran_id: tran, amount: ssl.get(tran), currency_type: "BDT", card_type: "BKASH-BKash" });
    }
  }
  // Stripe
  if (host === "api.stripe.com") {
    if (!/^Bearer sk_/.test(auth)) return send(res, 401, { error: { message: "Invalid API Key provided" } });
    if (path === "/v1/checkout/sessions" && method === "POST") {
      const id = `cs_test_${seq++}`;
      const s = { id, url: `https://checkout.stripe.com/c/pay/${id}`, payment_status: "paid", amount_total: Number(b["line_items[0][price_data][unit_amount]"]), currency: b["line_items[0][price_data][currency]"], metadata: { tranId: b["metadata[tranId]"], shopId: b["metadata[shopId]"] }, client_reference_id: b.client_reference_id };
      stripe.set(id, s);
      return send(res, 200, s);
    }
    const m = path.match(/^\/v1\/checkout\/sessions\/(.+)$/);
    if (m) return stripe.has(m[1]) ? send(res, 200, stripe.get(m[1])) : send(res, 404, { error: { message: "No such checkout.session" } });
    if (path === "/v1/balance") return send(res, 200, { object: "balance", livemode: false });
  }
  // Shopify Admin API
  if (host.endsWith(".myshopify.com")) {
    if (req.headers["x-shopify-access-token"] !== "shpat_test") return send(res, 401, { errors: "[API] Invalid API key or access token" });
    if (/^\/admin\/api\/[\w-]+\/orders\.json$/.test(path)) {
      if (q.get("page_info") === "p2") return send(res, 200, { orders: shopifyPage2 });
      res.setHeader("Link", `<https://${host}${path}?page_info=p2&limit=250>; rel="next"`);
      return send(res, 200, { orders: shopifyOrders });
    }
    if (/^\/admin\/api\/[\w-]+\/shop\.json$/.test(path)) return send(res, 200, { shop: { name: "Test Store" } });
  }
  // WooCommerce
  if (host === "woo.dakly-test.com") {
    const [k, s] = Buffer.from(auth.replace("Basic ", ""), "base64").toString().split(":");
    if (k !== "ck_test" || s !== "cs_test") return send(res, 401, { code: "woocommerce_rest_cannot_view", message: "Sorry, you cannot list resources." });
    if (path === "/wp-json/wc/v3/orders") return send(res, 200, q.get("page") === "1" ? wooOrders : []);
  }
  return send(res, 404, { error: `mock: no route for ${method} ${host}${path}` });
}

const handler = async (req, res) => {
  const host = (req.headers.host || "").split(":")[0];
  const u = new URL(req.url, `https://${host}`);
  const raw = await readBody(req);
  const b = form(raw, req.headers["content-type"] || "");
  const entry = { at: new Date().toISOString(), host, method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body: b, headers: { authorization: req.headers.authorization ? "<set>" : undefined } };
  log.push(entry);
  const f = fails.find((x) => x.host === host && (!x.match || (u.pathname + JSON.stringify(b)).includes(x.match)));
  if (f) { if (--f.times <= 0) fails = fails.filter((x) => x !== f); entry.injected = f.status; return send(res, f.status, f.body ?? { error: { message: "injected failure" } }); }
  try { await route(host, req.method, u.pathname, u.searchParams, b, req, res); } catch (e) { send(res, 500, { error: String(e) }); }
};

https.createServer({ key: fs.readFileSync(CERT_DIR + "server.key"), cert: fs.readFileSync(CERT_DIR + "server.crt") }, handler).listen(443, () => console.log("[mock] https :443"));

/* ---------- SMTP sink ---------- */
net.createServer((s) => {
  let data = false, cur = { from: "", to: [], raw: "" }, buf = "";
  s.write("220 mock.smtp ESMTP\r\n");
  s.on("data", (d) => {
    buf += d.toString("utf8");
    while (true) {
      if (data) {
        const end = buf.indexOf("\r\n.\r\n");
        if (end < 0) return;
        cur.raw = buf.slice(0, end); buf = buf.slice(end + 5); data = false;
        const headers = cur.raw.slice(0, cur.raw.indexOf("\r\n\r\n")).replace(/\r\n[ \t]+/g, " ");
        const subj = headers.match(/^Subject: (.*)$/mi)?.[1] ?? "";
        mail.push({ at: new Date().toISOString(), from: cur.from, to: cur.to, subject: decodeHeader(subj), raw: cur.raw, text: decodeBody(cur.raw) });
        cur = { from: "", to: [], raw: "" };
        s.write("250 OK queued\r\n");
        continue;
      }
      const i = buf.indexOf("\r\n");
      if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO") s.write("250-mock.smtp\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
      else if (cmd === "HELO") s.write("250 mock.smtp\r\n");
      else if (cmd === "AUTH") s.write("235 Authentication successful\r\n");
      else if (cmd === "MAIL") { cur.from = line.slice(10); s.write("250 OK\r\n"); }
      else if (cmd === "RCPT") { cur.to.push(line.slice(8)); s.write("250 OK\r\n"); }
      else if (cmd === "DATA") { data = true; s.write("354 End with .\r\n"); }
      else if (cmd === "QUIT") { s.write("221 Bye\r\n"); s.end(); }
      else s.write("250 OK\r\n");
    }
  });
  s.on("error", () => {});
}).listen(587, () => console.log("[mock] smtp :587"));

function decodeHeader(h) {
  // RFC 2047: join adjacent encoded words, then decode at byte level (UTF-8 may be split between words)
  h = h.replace(/(\?=)\s+(=\?)/g, "$1$2");
  return h.replace(/(=\?utf-8\?[BQ]\?[^?]*\?=)+/gi, (run) => Buffer.concat([...run.matchAll(/=\?utf-8\?([BQ])\?([^?]*)\?=/gi)].map(([, enc, txt]) =>
    enc.toUpperCase() === "B" ? Buffer.from(txt, "base64") : Buffer.from(txt.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))), "latin1"))).toString("utf8"));
}
function decodePart(head, body) {
  if (/Content-Transfer-Encoding: base64/i.test(head)) return Buffer.from(body.replace(/\s/g, ""), "base64").toString();
  if (/Content-Transfer-Encoding: quoted-printable/i.test(head)) return Buffer.from(body.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))), "latin1").toString("utf8");
  return body;
}
/** Plain-text body of an email (the text/plain part of a multipart message). */
function decodeBody(raw) {
  const sep = raw.indexOf("\r\n\r\n");
  const head = raw.slice(0, sep), body = raw.slice(sep + 4);
  const boundary = head.match(/boundary="?([^";\r\n]+)"?/i)?.[1];
  if (!boundary) return decodePart(head, body);
  for (const part of body.split("--" + boundary)) {
    const i = part.indexOf("\r\n\r\n");
    if (i < 0) continue;
    const ph = part.slice(0, i);
    if (/Content-Type: text\/plain/i.test(ph)) return decodePart(ph, part.slice(i + 4).replace(/\r\n$/, ""));
  }
  return body;
}

/* ---------- control ---------- */
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const b = form(await readBody(req), "application/json");
  if (u.pathname === "/__log") return send(res, 200, log.filter((e) => !u.searchParams.get("host") || e.host === u.searchParams.get("host")));
  if (u.pathname === "/__mail") return send(res, 200, mail);
  if (u.pathname === "/__fail") { fails.push({ times: 1, ...b }); return send(res, 200, { ok: true }); }
  if (u.pathname === "/__stripe") { const s = stripe.get(b.id); if (s) Object.assign(s, b); return send(res, 200, { ok: !!s }); }
  if (u.pathname === "/__reset") { log = []; mail = []; fails = []; return send(res, 200, { ok: true }); }
  send(res, 404, { error: "unknown" });
}).listen(8080, () => console.log("[mock] control :8080"));
