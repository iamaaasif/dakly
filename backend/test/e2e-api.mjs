// End-to-end use-case tests against a running test stack (see test/README.md).
// Every outside provider is the mock in test/mock/server.mjs.
import fs from "node:fs";
import ExcelJS from "exceljs";
import { t, section, eq, ok, get, post, patch, del, api, mock, mockLog, mail, fail, sql, cron, waInbound, waStatus, waWebhook, twilioHook, stripeHook, newShop, uniq, until, results, SECRETS, BASE, sleep } from "./lib.mjs";

const WA_PLATFORM = "109876543210";
await mock("/__reset", {});

/* ======================= A. Sign-up, login, onboarding ======================= */
section("A. Sign-up, login and account");
let A, US;
await t("A1", "Register a Bangladesh shop: BDT, Asia/Dhaka, Bangla by default", async () => {
  A = await newShop();
  const me = await get("/api/v1/me", { token: A.token });
  eq(me.status, 200);
  eq([me.json.shop.country, me.json.shop.currency, me.json.shop.timezone, me.json.shop.language, me.json.shop.status], ["BD", "BDT", "Asia/Dhaka", "bn", "active"]);
  eq(me.json.plan.key, "free");
});
await t("A2", "Register an international shop (US): USD, New York time, English", async () => {
  US = await newShop({ country: "US" });
  const me = await get("/api/v1/me", { token: US.token });
  eq([me.json.shop.currency, me.json.shop.timezone, me.json.shop.language], ["USD", "America/New_York", "en"]);
});
await t("A3", "Duplicate email is refused", async () => {
  const r = await post("/api/v1/auth/register", { name: "X Y", shop: "Dup", email: A.email, password: "password123" });
  eq(r.status, 400); ok(/already/i.test(r.json.error), r.json.error);
});
await t("A4", "Bad email and short password are refused with a readable message", async () => {
  const r1 = await post("/api/v1/auth/register", { name: "X Y", shop: "Shop", email: "nope", password: "password123" });
  eq(r1.status, 400); eq(r1.json.code, "invalid");
  const r2 = await post("/api/v1/auth/register", { name: "X Y", shop: "Shop", email: `x-${uniq()}@dakly.test`, password: "short" });
  eq(r2.status, 400); ok(/8/.test(r2.json.error), r2.json.error);
});
await t("A5", "Login works; wrong password gives 401 bad_credentials", async () => {
  const r = await post("/api/v1/auth/login", { email: A.email.toUpperCase(), password: A.password });
  eq(r.status, 200); ok(r.json.token); eq(r.json.shop.currency, "BDT");
  const bad = await post("/api/v1/auth/login", { email: A.email, password: "wrong-pass" });
  eq(bad.status, 401); eq(bad.json.code, "bad_credentials");
});
await t("A6", "Login is locked for 15 minutes after repeated wrong passwords", async () => {
  const B = await newShop();
  for (let i = 0; i < 8; i++) await post("/api/v1/auth/login", { email: B.email, password: "wrong" + i }, { headers: { "X-Forwarded-For": "10.9.9." + i } });
  const r = await post("/api/v1/auth/login", { email: B.email, password: B.password }, { headers: { "X-Forwarded-For": "10.9.8.1" } });
  eq([r.status, r.json.code], [429, "rate_limited"]); ok(/15/.test(r.json.error), r.json.error);
});
await t("A7", "Token refresh returns a new working token", async () => {
  const r = await post("/api/v1/auth/refresh", {}, { token: A.token });
  eq(r.status, 200); ok(r.json.token);
  eq((await get("/api/v1/me", { token: r.json.token })).status, 200);
});
await t("A8", "No token, a garbage token or a tampered token gets 401 unauthorized", async () => {
  eq((await get("/api/v1/me")).json.code, "unauthorized");
  eq((await get("/api/v1/me", { token: "abc.def.ghi" })).status, 401);
  const [h, p] = A.token.split(".");
  eq((await get("/api/v1/me", { token: `${h}.${p}.AAAA` })).status, 401);
});
await t("A9", "PATCH /me changes name and panel language", async () => {
  eq((await patch("/api/v1/me", { name: "Renamed Owner", uiLang: "en" }, { token: A.token })).status, 200);
  const me = await get("/api/v1/me", { token: A.token });
  eq([me.json.user.name, me.json.user.uiLang], ["Renamed Owner", "en"]);
});
await t("A10", "Logout revokes the token on the server", async () => {
  const C = await newShop();
  eq((await post("/api/v1/auth/logout", {}, { token: C.token })).status, 200);
  eq((await get("/api/v1/me", { token: C.token })).status, 401);
});
await t("A11", "A new shop gets a welcome email", async () => {
  const m = await until(async () => (await mail()).find((x) => x.to.join().includes(A.email)));
  ok(/Dakly/.test(m.subject), m.subject);
});
await t("A12", "Onboarding checklist is returned by /me", async () => {
  const me = await get("/api/v1/me", { token: A.token });
  ok(Array.isArray(me.json.onboarding?.steps), JSON.stringify(me.json.onboarding));
  eq(me.json.onboarding.steps.find((s) => s.key === "customers").done, false);
});

/* ======================= B. Password reset ======================= */
section("B. Password reset");
await t("B1", "Forgot password always answers 200 and emails a link only for real accounts", async () => {
  const before = (await mail()).length;
  eq((await post("/api/v1/auth/forgot", { email: "nobody-" + uniq() + "@dakly.test" })).status, 200);
  await sleep(500);
  eq((await mail()).length, before, "no email for unknown address");
  eq((await post("/api/v1/auth/forgot", { email: A.email })).status, 200);
  const m = await until(async () => (await mail()).find((x) => x.to.join().includes(A.email) && /reset\?token=/.test(x.text)));
  ok(m.text.includes(BASE + "/reset?token="), m.text);
});
await t("B2", "Reset link sets a new password, works once, and signs out old tokens", async () => {
  const m = (await mail()).filter((x) => x.to.join().includes(A.email) && /reset\?token=/.test(x.text)).pop();
  const token = m.text.match(/reset\?token=([\w-]+)/)[1];
  const r = await post("/api/v1/auth/reset", { token, password: "newpassword456" });
  eq(r.status, 200, JSON.stringify(r.json)); ok(r.json.token);
  eq((await get("/api/v1/me", { token: A.token })).status, 401, "old token revoked");
  const again = await post("/api/v1/auth/reset", { token, password: "another-pass-789" });
  eq(again.status, 400);
  const login = await post("/api/v1/auth/login", { email: A.email, password: "newpassword456" });
  eq(login.status, 200);
  A.token = login.json.token; A.password = "newpassword456";
});
await t("B3", "Forgot password is rate limited per address", async () => {
  for (let i = 0; i < 4; i++) await post("/api/v1/auth/forgot", { email: A.email });
  await sleep(500);
  const n = (await mail()).filter((x) => x.to.join().includes(A.email) && /reset\?token=/.test(x.text)).length;
  ok(n <= 4, `sent ${n} reset emails`);
});

/* ======================= C. Customers and import ======================= */
section("C. Customers and import");
let cust1;
await t("C1", "Add a customer with a local BD number (01712-345678 → 8801712345678) and first order", async () => {
  const r = await post("/api/v1/customers", { name: "Rahima Begum", phone: "01712-345678", amount: "২,৫০০", items: "Saree" }, { token: A.token });
  eq(r.status, 201, JSON.stringify(r.json)); cust1 = r.json.id;
  const c = await get(`/api/v1/customers/${cust1}`, { token: A.token });
  eq([c.json.phone, c.json.total, c.json.orders.length, c.json.segment], ["8801712345678", 2500, 1, "new"]);
});
await t("C2", "Bangla digits and +880 format both work and match the same customer", async () => {
  const r = await post("/api/v1/customers", { name: "Rahima B.", phone: "+৮৮০১৭১২৩৪৫৬৭৮" }, { token: A.token });
  eq(r.status, 201); eq(r.json.id, cust1, "same customer, not a duplicate");
});
await t("C3", "An invalid phone number is refused", async () => {
  const r = await post("/api/v1/customers", { name: "Bad Phone", phone: "12345" }, { token: A.token });
  eq(r.status, 400); eq(r.json.code, "invalid");
});
await t("C4", "Add order, edit and delete a customer", async () => {
  eq((await post(`/api/v1/customers/${cust1}/orders`, { amount: 1500, items: "Kurti" }, { token: A.token })).status, 201);
  eq((await post(`/api/v1/customers/${cust1}/orders`, { amount: 0 }, { token: A.token })).status, 400);
  eq((await patch(`/api/v1/customers/${cust1}`, { area: "Mirpur", note: "Likes red", email: "r@example.com" }, { token: A.token })).status, 200);
  const c = await get(`/api/v1/customers/${cust1}`, { token: A.token });
  eq([c.json.total, c.json.area, c.json.note], [4000, "Mirpur", "Likes red"]);
  const tmp = await post("/api/v1/customers", { name: "Temp Person", phone: "01799999999" }, { token: A.token });
  eq((await del(`/api/v1/customers/${tmp.json.id}`, undefined, { token: A.token })).status, 200);
  eq((await get(`/api/v1/customers/${tmp.json.id}`, { token: A.token })).status, 404);
});
await t("C5", "CSV import with Bangla headers: preview, then import, existing customers updated", async () => {
  const csv = "নাম,মোবাইল,মোট টাকা,শেষ তারিখ,এলাকা\nKamal Hossain,01711000001,18000,01/09/2026,Dhanmondi\nJamal Uddin,01711000002,\"3,200\",15/10/2026,Uttara\nNo Phone,,500,,\nRahima Begum,01712345678,999,,Mirpur\n";
  const fd = () => { const f = new FormData(); f.set("file", new Blob([csv], { type: "text/csv" }), "list.csv"); return f; };
  const dry = await api("POST", "/api/v1/customers/import?dry=1", { token: A.token, form: fd() });
  eq(dry.status, 200, JSON.stringify(dry.json)); eq([dry.json.rows, dry.json.invalid], [4, 1]);
  eq([dry.json.mapping.name, dry.json.mapping.phone, dry.json.mapping.total], ["নাম", "মোবাইল", "মোট টাকা"]);
  const r = await api("POST", "/api/v1/customers/import", { token: A.token, form: fd() });
  eq(r.json, { created: 2, updated: 1, skipped: 0 });
});
await t("C6", "Excel (.xlsx) import", async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Customers");
  ws.addRow(["Customer Name", "Phone Number", "Total Spent", "Last Order"]);
  ws.addRow(["Excel One", "01711000011", 1200, new Date(Date.now() - 10 * 86400000)]);
  ws.addRow(["Excel Two", "8801711000012", 800, new Date(Date.now() - 100 * 86400000)]);
  const buf = await wb.xlsx.writeBuffer();
  const f = new FormData(); f.set("file", new Blob([buf]), "list.xlsx");
  const r = await api("POST", "/api/v1/customers/import", { token: A.token, form: f });
  eq(r.json, { created: 2, updated: 0, skipped: 0 });
});
await t("C7", "A broken file gives a clear error", async () => {
  const f = new FormData(); f.set("file", new Blob(["not excel"]), "x.xlsx");
  const r = await api("POST", "/api/v1/customers/import", { token: A.token, form: f });
  eq(r.status, 400); ok(r.json.error);
});
await t("C8", "Customer list: search by name and phone, segment filter, paging", async () => {
  const s1 = await get("/api/v1/customers?q=kamal", { token: A.token });
  eq(s1.json.total, 1);
  const s2 = await get("/api/v1/customers?q=01711000002", { token: A.token });
  eq(s2.json.items[0]?.name, "Jamal Uddin");
  const p = await get("/api/v1/customers?pageSize=2&page=1&sort=name", { token: A.token });
  eq([p.json.items.length, p.json.hasMore], [2, true]);
  const vip = await get("/api/v1/customers?segment=vip", { token: A.token });
  ok(vip.json.items.every((c) => c.segment === "vip"));
});
await t("C9", "Voice input: speech to text and the customer fields pulled out", async () => {
  const f = new FormData(); f.set("audio", new Blob([Buffer.alloc(4000, 1)], { type: "audio/webm" }), "note.webm");
  const r = await api("POST", "/api/v1/customers/voice", { token: A.token, form: f });
  eq(r.status, 200, JSON.stringify(r.json));
  eq([r.json.parsed.name, r.json.parsed.phone, r.json.parsed.amount], ["Rahim Uddin", "01712345678", 3200]);
});
await t("C10", "One shop can never see or change another shop's customers", async () => {
  const B = await newShop();
  eq((await get(`/api/v1/customers/${cust1}`, { token: B.token })).status, 404);
  eq((await patch(`/api/v1/customers/${cust1}`, { name: "Hacked" }, { token: B.token })).status, 404);
  eq((await del(`/api/v1/customers/${cust1}`, undefined, { token: B.token })).status, 404);
  eq((await post(`/api/v1/customers/${cust1}/orders`, { amount: 5 }, { token: B.token })).status, 404);
  eq((await get(`/api/v1/inbox/${cust1}`, { token: B.token })).status, 404);
});
await t("C11", "Free plan keeps at most 500 customers; import skips the rest", async () => {
  const B = await newShop();
  const rows = ["name,phone"]; for (let i = 0; i < 505; i++) rows.push(`P${i},0171${String(2000000 + i)}`);
  const f = new FormData(); f.set("file", new Blob([rows.join("\n")]), "big.csv");
  const r = await api("POST", "/api/v1/customers/import", { token: B.token, form: f });
  eq([r.json.created, r.json.skipped], [500, 5]);
  const add = await post("/api/v1/customers", { name: "One More", phone: "01913000000" }, { token: B.token });
  eq(add.status, 400); ok(/500/.test(add.json.error), add.json.error);
});

/* ======================= D. Segments ======================= */
section("D. Segments");
let S; // shop with known segments
await t("D1", "VIP, Regular, New and Inactive are worked out from orders", async () => {
  S = await newShop();
  const mk = async (name, phone, orders) => {
    const c = await post("/api/v1/customers", { name, phone }, { token: S.token });
    for (const [amount, days] of orders) {
      const o = await post(`/api/v1/customers/${c.json.id}/orders`, { amount }, { token: S.token });
      sql(`UPDATE "Order" SET "orderedAt" = now() - interval '${days} days' WHERE id='${o.json.id}'`);
    }
    return c.json.id;
  };
  await mk("Vip Person", "01811000001", [[16000, 5]]);
  await mk("Regular Person", "01811000002", [[1000, 50], [1000, 10]]);
  await mk("New Person", "01811000003", [[500, 3]]);
  await mk("Inactive Person", "01811000004", [[2000, 90]]);
  const a = await get("/api/v1/campaigns/audience", { token: S.token });
  eq(a.json.counts, { vip: 1, regular: 1, new: 1, inactive: 1, all: 4 });
  eq(a.json.channels, { wa: true, sms: true, voice: true, voiceAllowedOnPlan: false });
  eq(a.json.placeholders, { name: "{নাম}", product: "{পণ্য}" });
});

/* ======================= E. Campaigns on every channel ======================= */
section("E. Campaigns");
const campaignDone = (tok, id) => until(async () => { const c = await get(`/api/v1/campaigns/${id}`, { token: tok }); return c.json.status === "sent" ? c.json : null; }, 15000);
await t("E1", "WhatsApp campaign to everyone: template sent with first name and personalised text", async () => {
  await mock("/__reset", {});
  const r = await post("/api/v1/campaigns", { name: "Eid", segment: "all", message: "{নাম}, ঈদের নতুন Collection এসেছে!", channels: ["wa"] }, { token: S.token });
  eq(r.status, 201, JSON.stringify(r.json));
  const c = await campaignDone(S.token, r.json.id);
  eq(c.summary.sent, 4);
  const sent = (await mockLog("graph.facebook.com")).filter((e) => e.path.endsWith("/messages"));
  eq(sent.length, 4);
  const one = sent.find((e) => e.body.to === "8801811000001");
  eq(one.body.template.name, "dakly_offer");
  eq(one.body.template.components[0].parameters[0].text, "Vip");
  ok(one.body.template.components[0].parameters[1].text.startsWith("Vip, ঈদের"), JSON.stringify(one.body));
});
await t("E2", "Delivery and read receipts from WhatsApp update the campaign", async () => {
  const c = (await get("/api/v1/campaigns", { token: S.token })).json.items[0];
  const msgId = sql(`SELECT "providerId" FROM "CampaignMessage" WHERE "campaignId"='${c.id}' LIMIT 1`);
  await waStatus(msgId, "delivered"); await waStatus(msgId, "read"); await waStatus(msgId, "delivered");
  const d = await get(`/api/v1/campaigns/${c.id}`, { token: S.token });
  eq([d.json.summary.delivered, d.json.summary.read], [1, 1]);
});
await t("E3", "SMS campaign in Bangladesh goes through the BD gateway", async () => {
  await mock("/__reset", {});
  const r = await post("/api/v1/campaigns", { segment: "vip", message: "{name}: VIP offer today", channels: ["sms"] }, { token: S.token });
  const c = await campaignDone(S.token, r.json.id);
  eq(c.summary.sent, 1);
  const log = await mockLog("bulksmsbd.net");
  eq([log.length, log[0].body.number, log[0].body.message.split("\n")[0], log[0].body.senderid], [1, "8801811000001", "Vip: VIP offer today", "8809612345678"]);
});
await t("E4", "SMS campaign outside Bangladesh goes through Twilio", async () => {
  await mock("/__reset", {});
  eq((await post("/api/v1/customers", { name: "Jane Doe", phone: "(212) 555-0175", amount: 50 }, { token: US.token })).status, 201);
  const r = await post("/api/v1/campaigns", { segment: "all", message: "Hi {name}, new arrivals", channels: ["sms"] }, { token: US.token });
  const c = await campaignDone(US.token, r.json.id);
  eq(c.summary.sent, 1);
  const log = await mockLog("api.twilio.com");
  eq([log[0].path.endsWith("/Messages.json"), log[0].body.To, log[0].body.Body.split("\n")[0]], [true, "+12125550175", "Hi Jane, new arrivals"]);
  ok(log[0].body.Body.includes("Stop: http"), "English opt-out line");
});
await t("E5", "AI voice call is refused on Free and Starter plans", async () => {
  const r = await post("/api/v1/campaigns", { segment: "all", message: "Hello {name} calling", channels: ["voice"] }, { token: S.token });
  eq(r.status, 400); ok(/Growth/.test(r.json.error), r.json.error);
});
let callMsg;
await t("E6", "AI voice call on Growth: Twilio call placed, audio served, press 1 marks interested", async () => {
  sql(`UPDATE "Shop" SET plan='growth', "planUntil"=now()+interval '30 days' WHERE id='${S.shopId}'`);
  await mock("/__reset", {});
  const r = await post("/api/v1/campaigns", { segment: "vip", message: "আসসালামু আলাইকুম {নাম}, VIP Offer!", channels: ["voice"] }, { token: S.token });
  eq(r.status, 201, JSON.stringify(r.json));
  await until(async () => (await mockLog("api.twilio.com")).length > 0);
  const call = (await mockLog("api.twilio.com"))[0];
  ok(call.path.endsWith("/Calls.json")); eq(call.body.To, "+8801811000001");
  callMsg = sql(`SELECT id FROM "CampaignMessage" WHERE "campaignId"='${r.json.id}'`);
  ok(call.body.Twiml.includes(`/api/voice/audio/${callMsg}`), call.body.Twiml);
  const audio = await fetch(`${BASE}/api/voice/audio/${callMsg}`);
  eq([audio.status, audio.headers.get("content-type")], [200, "audio/mpeg"]);
  const tts = (await mockLog("api.openai.com")).find((e) => e.path === "/v1/audio/speech");
  ok(tts.body.input.startsWith("আসসালামু আলাইকুম Vip"), tts.body.input);
  const bad = await twilioHook(`?m=${callMsg}`, { Digits: "1" }, "wrong-token");
  eq(bad.status, 403);
  const g = await twilioHook(`?m=${callMsg}`, { Digits: "1" });
  ok((await g.text()).includes("part=thanks"));
  await twilioHook(`?m=${callMsg}&kind=status`, { CallStatus: "completed" });
  const d = await get(`/api/v1/campaigns/${r.json.id}`, { token: S.token });
  eq(d.json.summary.interested, 1);
});
await t("E7", "Scheduled campaign waits, then goes out when the scheduler runs", async () => {
  await mock("/__reset", {});
  const at = new Date(Date.now() + 3600000).toISOString();
  const r = await post("/api/v1/campaigns", { segment: "new", message: "{name} scheduled hello", channels: ["wa"], when: "later", sendAt: at }, { token: S.token });
  eq(r.status, 201);
  await cron();
  eq((await get(`/api/v1/campaigns/${r.json.id}`, { token: S.token })).json.status, "scheduled");
  sql(`UPDATE "Campaign" SET "sendAt"=now()-interval '1 minute' WHERE id='${r.json.id}'`);
  const tick = await cron();
  eq(tick.status, 200); eq(tick.json.campaigns, 1);
  eq((await get(`/api/v1/campaigns/${r.json.id}`, { token: S.token })).json.status, "sent");
});
await t("E8", "A time in the past and an empty audience are refused", async () => {
  const r = await post("/api/v1/campaigns", { segment: "all", message: "{name} hello there", channels: ["wa"], when: "later", sendAt: "2020-01-01T00:00:00Z" }, { token: S.token });
  eq(r.status, 400);
  const B = await newShop();
  const r2 = await post("/api/v1/campaigns", { segment: "all", message: "{name} hello there", channels: ["wa"] }, { token: B.token });
  eq(r2.status, 400);
});
await t("E9", "WhatsApp refuses a message: it is marked failed with the reason, and logged", async () => {
  await mock("/__reset", {});
  await fail("graph.facebook.com", 400, { match: "8801811000003", body: { error: { message: "(#132001) Template name does not exist in the translation" } } });
  const r = await post("/api/v1/campaigns", { segment: "all", message: "{name} failing test", channels: ["wa"] }, { token: S.token });
  const c = await campaignDone(S.token, r.json.id);
  eq([c.summary.sent, c.summary.failed], [3, 1]);
  ok(c.messages.find((m) => m.status === "failed").error.includes("132001"));
});
await t("E10", "{product} is filled with a product the customer is likely to want", async () => {
  await mock("/__reset", {});
  const r = await post("/api/v1/campaigns", { segment: "vip", message: "{name}, new {product} for you", channels: ["sms"] }, { token: S.token });
  await campaignDone(S.token, r.json.id);
  const m = (await mockLog("bulksmsbd.net"))[0].body.message;
  ok(!m.includes("{product}") && m.startsWith("Vip, new "), m);
});
await t("E11", "Message limit: a campaign larger than what is left this month is refused", async () => {
  sql(`UPDATE "Shop" SET "limitOverride"=2 WHERE id='${S.shopId}'`);
  const r = await post("/api/v1/campaigns", { segment: "all", message: "{name} over the limit", channels: ["wa"] }, { token: S.token });
  eq(r.status, 400); ok(/Upgrade|smaller|limit/i.test(r.json.error), r.json.error);
  sql(`UPDATE "Shop" SET "limitOverride"=NULL WHERE id='${S.shopId}'`);
});

/* ======================= F. AI and knowledge base ======================= */
section("F. AI and the knowledge base");
let kbId;
await t("F1", "Knowledge base: add, list, search, edit, switch off, delete", async () => {
  const r = await post("/api/v1/knowledge", { type: "product", title: "Jamdani Saree Royal Blue", body: "Handwoven, 6 yards", price: "৳4,500" }, { token: S.token });
  eq(r.status, 201, JSON.stringify(r.json)); kbId = r.json.id;
  eq((await post("/api/v1/knowledge", { type: "policy", title: "Delivery", body: "Dhaka 60 Taka, outside 120 Taka, 2-3 days" }, { token: S.token })).status, 201);
  eq((await post("/api/v1/knowledge", { type: "nonsense", title: "x" }, { token: S.token })).status, 400);
  const l = await get("/api/v1/knowledge?q=jamdani", { token: S.token });
  eq([l.json.items.length, l.json.items[0].price], [1, 4500]);
  eq((await patch(`/api/v1/knowledge/${kbId}`, { price: 4200 }, { token: S.token })).status, 200);
  eq((await get(`/api/v1/knowledge/${kbId}`, { token: S.token })).json.price, 4200);
  const tmp = await post("/api/v1/knowledge", { type: "note", title: "Temp note" }, { token: S.token });
  eq((await del(`/api/v1/knowledge/${tmp.json.id}`, undefined, { token: S.token })).status, 200);
});
await t("F2", "AI campaign message is written with the shop's knowledge and brand voice", async () => {
  await patch("/api/v1/settings", { brandVoice: "Always say Apu, never use slang" }, { token: S.token });
  await mock("/__reset", {});
  const r = await post("/api/v1/ai/message", { segment: "vip", offer: "Jamdani Saree discount", channel: "text" }, { token: S.token });
  eq(r.status, 200, JSON.stringify(r.json)); eq(r.json.ai, true); ok(r.json.text.includes("[mock-ai]"));
  const sys = (await mockLog("api.openai.com"))[0].body.messages[0].content;
  ok(sys.includes("Jamdani Saree Royal Blue (4200 BDT)"), "product with price in prompt");
  ok(sys.includes("Always say Apu"), "brand voice in prompt");
});
await t("F3", "Switched-off knowledge is not given to the AI", async () => {
  await patch(`/api/v1/knowledge/${kbId}`, { active: false }, { token: S.token });
  await mock("/__reset", {});
  await post("/api/v1/ai/message", { segment: "vip", offer: "Jamdani", channel: "text" }, { token: S.token });
  ok(!(await mockLog("api.openai.com"))[0].body.messages[0].content.includes("Royal Blue"));
  await patch(`/api/v1/knowledge/${kbId}`, { active: true }, { token: S.token });
});
await t("F4", "AI Facebook post and AI voice script", async () => {
  const p = await post("/api/v1/ai/post", { prompt: "Winter shawl collection", tone: "মজার" }, { token: S.token });
  eq(p.status, 200); ok(p.json.text.includes("[mock-ai]"));
  const v = await post("/api/v1/ai/message", { segment: "inactive", offer: "come back", channel: "voice" }, { token: S.token });
  eq(v.status, 200);
});
await t("F5", "English shops get English AI prompts and the {name} placeholder", async () => {
  await mock("/__reset", {});
  const r = await post("/api/v1/ai/message", { segment: "all", offer: "Black Friday", channel: "text" }, { token: US.token });
  ok(r.json.text.startsWith("{name}"), r.json.text);
  ok((await mockLog("api.openai.com"))[0].body.messages[0].content.includes("United States"));
});
await t("F6", "Daily AI tips: three tips, bad segments cleaned, cached for the day", async () => {
  const r = await get("/api/v1/insights?refresh=1", { token: S.token });
  eq(r.status, 200); eq(r.json.aiTips.source, "ai"); eq(r.json.aiTips.tips.length, 3);
  eq(r.json.aiTips.tips[2].segment, "all");
  ok(r.json.aiTips.tips[0].campaignHref.startsWith("/campaigns/new?segment=inactive"));
  const d = await get("/api/v1/dashboard", { token: S.token });
  eq(d.json.aiTips.tips.length, 3);
});
await t("F7", "OpenAI down: the merchant gets a clear error, nothing crashes", async () => {
  await fail("api.openai.com", 500, { match: "chat/completions" });
  const r = await post("/api/v1/ai/message", { segment: "vip", offer: "x", channel: "text" }, { token: S.token });
  eq(r.status, 400); ok(/AI/.test(r.json.error), r.json.error);
});
await t("F8", "Monthly AI limit (Free = 50) returns 429 limit_reached", async () => {
  const B = await newShop();
  sql(`INSERT INTO "AiUsage"(id,"shopId",kind,"createdAt") SELECT 'x'||g||'${uniq()}','${B.shopId}','message',now() FROM generate_series(1,50) g`);
  const r = await post("/api/v1/ai/message", { segment: "all", offer: "x", channel: "text" }, { token: B.token });
  eq(r.status, 429, JSON.stringify(r.json)); eq(r.json.code, "limit_reached");
});

/* ======================= G. WhatsApp inbox ======================= */
section("G. WhatsApp inbox");
const vipId = () => sql(`SELECT id FROM "Customer" WHERE "shopId"='${S.shopId}' AND phone='8801811000001'`);
await t("G1", "Meta webhook verification answers the challenge only with the right token", async () => {
  eq(await (await fetch(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${SECRETS.verify}&hub.challenge=42`)).text(), "42");
  eq((await fetch(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`)).status, 403);
});
await t("G2", "Unsigned or wrongly signed webhooks are refused", async () => {
  eq((await fetch(`${BASE}/api/webhooks/whatsapp`, { method: "POST", body: "{}" })).status, 403);
  eq((await waWebhook({ entry: [] }, "wrong-secret")).status, 403);
});
await t("G3", "A customer reply lands in the right shop's inbox as unread; retries are not duplicated", async () => {
  const id = "wamid.IN-G3";
  eq((await waInbound(WA_PLATFORM, "8801811000001", "দাম কত?", id)).status, 200);
  await waInbound(WA_PLATFORM, "8801811000001", "দাম কত?", id);
  const inbox = await get("/api/v1/inbox", { token: S.token });
  const conv = inbox.json.conversations.find((c) => c.customer.id === vipId());
  eq([conv.unread, conv.windowOpen, conv.last.body], [1, true, "দাম কত?"]);
  eq(inbox.json.unreadTotal, 1);
});
await t("G4", "AI suggests a reply from the conversation and knowledge", async () => {
  const r = await post(`/api/v1/inbox/${vipId()}/suggest`, {}, { token: S.token });
  eq(r.status, 200); ok(r.json.text.includes("[mock-ai]"));
});
await t("G5", "Reply inside the 24h window is free text and does not use the monthly limit", async () => {
  await mock("/__reset", {});
  const before = (await get("/api/v1/me", { token: S.token })).json.plan.messages.used;
  const r = await post(`/api/v1/inbox/${vipId()}`, { text: "দাম ৪২০০ টাকা" }, { token: S.token });
  eq([r.status, r.json.kind], [201, "text"]);
  const sent = (await mockLog("graph.facebook.com")).find((e) => e.path.endsWith("/messages"));
  eq([sent.body.type, sent.body.text.body], ["text", "দাম ৪২০০ টাকা"]);
  eq((await get("/api/v1/me", { token: S.token })).json.plan.messages.used, before);
});
await t("G6", "Opening the chat marks it read and sends the WhatsApp read receipt", async () => {
  await mock("/__reset", {});
  eq((await post(`/api/v1/inbox/${vipId()}/read`, {}, { token: S.token })).status, 200);
  eq((await get("/api/v1/inbox", { token: S.token })).json.unreadTotal, 0);
  ok((await mockLog("graph.facebook.com")).some((e) => e.body.status === "read" && e.body.message_id === "wamid.IN-G3"));
});
await t("G7", "Outside the 24h window the approved template is used and counted", async () => {
  sql(`UPDATE "Customer" SET "lastInboundAt"=now()-interval '2 days' WHERE id='${vipId()}'`);
  await mock("/__reset", {});
  const before = (await get("/api/v1/me", { token: S.token })).json.plan.messages.used;
  const r = await post(`/api/v1/inbox/${vipId()}`, { text: "Following up" }, { token: S.token });
  eq(r.json.kind, "template");
  eq((await mockLog("graph.facebook.com")).find((e) => e.path.endsWith("/messages")).body.type, "template");
  eq((await get("/api/v1/me", { token: S.token })).json.plan.messages.used, before + 1);
});
await t("G8", "One-to-one SMS and call log appear in the conversation", async () => {
  eq((await post(`/api/v1/inbox/${vipId()}`, { text: "SMS hello", channel: "sms" }, { token: S.token })).json.kind, "text");
  eq((await post(`/api/v1/customers/${vipId()}/calls`, { how: "phone", durationSec: 120, note: "Wants blue" }, { token: S.token })).status, 201);
  const th = await get(`/api/v1/inbox/${vipId()}`, { token: S.token });
  ok(th.json.messages.some((m) => m.channel === "sms" && m.body === "SMS hello"));
  ok(th.json.messages.some((m) => m.kind === "call" && m.body.includes("2 min")));
});
await t("G9", "Provider error on a reply gives 502 provider_error", async () => {
  await fail("graph.facebook.com", 400, { match: "/messages", body: { error: { message: "Recipient phone number not in allowed list" } } });
  const r = await post(`/api/v1/inbox/${vipId()}`, { text: "will fail" }, { token: S.token });
  eq([r.status, r.json.code], [502, "provider_error"]);
});
await t("G10", "A shop with its own WhatsApp number receives messages from new people as new customers", async () => {
  const O = await newShop();
  eq((await patch("/api/v1/settings", { waPhoneNumberId: "555000111", waAccessToken: "EAAOWN", waTemplateName: "own_tpl", waTemplateLang: "en" }, { token: O.token })).status, 200);
  eq(sql(`SELECT "waAccessToken" LIKE 'enc:v1:%' FROM "Shop" WHERE id='${O.shopId}'`), "t", "token stored encrypted");
  await waInbound("555000111", "8801999000111", "Hi, is this available?", undefined, "New Lead");
  const inbox = await get("/api/v1/inbox", { token: O.token });
  eq(inbox.json.conversations[0]?.customer.name, "New Lead");
  const st = await get("/api/v1/settings", { token: O.token });
  eq([st.json.channels.state.wa, st.json.channels.saved.waAccessToken], ["own", true]);
  ok(!JSON.stringify(st.json).includes("EAAOWN"), "secret never returned");
});

/* ======================= H. Store sync ======================= */
section("H. Online store sync");
await t("H1", "Shopify: connect imports customers and orders, follows pages, skips cancelled orders", async () => {
  const B = await newShop();
  const r = await post("/api/v1/settings/store", { storeType: "shopify", storeUrl: "https://teststore.myshopify.com", storeKey: "shpat_test" }, { token: B.token });
  eq(r.status, 200, JSON.stringify(r.json));
  const l = await get("/api/v1/customers?pageSize=50", { token: B.token });
  eq(l.json.total, 3);
  ok(l.json.items.some((c) => c.phone === "8801822222222" && c.name === "Karim Mia"));
  const again = await post("/api/v1/settings/store/sync", {}, { token: B.token });
  eq(again.status, 200);
  eq(sql(`SELECT count(*) FROM "Order" o JOIN "Customer" c ON c.id=o."customerId" WHERE c."shopId"='${B.shopId}'`), "3", "no duplicate orders on re-sync");
  eq((await del("/api/v1/settings/store", undefined, { token: B.token })).status, 200);
  eq((await get("/api/v1/settings", { token: B.token })).json.store.type, null);
});
await t("H2", "WooCommerce: connect imports orders and skips refunded ones", async () => {
  const B = await newShop();
  const r = await post("/api/v1/settings/store", { storeType: "woocommerce", storeUrl: "https://woo.dakly-test.com", storeKey: "ck_test", storeSecret: "cs_test" }, { token: B.token });
  eq(r.status, 200, JSON.stringify(r.json));
  const l = await get("/api/v1/customers", { token: B.token });
  eq([l.json.total, l.json.items[0].name, l.json.items[0].stats.total], [1, "Tania Rahman", 1850]);
});
await t("H3", "Wrong store keys: clear error and nothing saved", async () => {
  const B = await newShop();
  const r = await post("/api/v1/settings/store", { storeType: "woocommerce", storeUrl: "https://woo.dakly-test.com", storeKey: "ck_bad", storeSecret: "cs_bad" }, { token: B.token });
  eq(r.status, 400); ok(/401/.test(r.json.error), r.json.error);
  eq((await get("/api/v1/settings", { token: B.token })).json.store.type, null);
  const r2 = await post("/api/v1/settings/store", { storeType: "shopify", storeUrl: "https://example.com", storeKey: "x" }, { token: B.token });
  eq(r2.status, 400);
});

/* ======================= I. Opt-out ======================= */
section("I. Opt-out (STOP)");
await t("I1", "Customer sends STOP: opted out, left out of campaigns, one-to-one messages blocked", async () => {
  const cid = sql(`SELECT id FROM "Customer" WHERE "shopId"='${S.shopId}' AND phone='8801811000002'`);
  await waInbound(WA_PLATFORM, "8801811000002", "STOP");
  eq(sql(`SELECT "optedOut" FROM "Customer" WHERE id='${cid}'`), "t");
  eq((await get("/api/v1/campaigns/audience", { token: S.token })).json.counts.all, 3);
  sql(`UPDATE "Customer" SET "lastInboundAt"=now()-interval '2 days' WHERE id='${cid}'`);
  const r = await post(`/api/v1/inbox/${cid}`, { text: "please buy" }, { token: S.token });
  eq([r.status, r.json.code], [400, "opted_out"]);
});
await t("I2", "Bangla বন্ধ also opts out", async () => {
  const cid = sql(`SELECT id FROM "Customer" WHERE "shopId"='${S.shopId}' AND phone='8801811000003'`);
  await waInbound(WA_PLATFORM, "8801811000003", "বন্ধ");
  eq(sql(`SELECT "optedOut" FROM "Customer" WHERE id='${cid}'`), "t");
  eq((await patch(`/api/v1/customers/${cid}`, { optedOut: false }, { token: S.token })).status, 200);
  eq(sql(`SELECT "optedOut" FROM "Customer" WHERE id='${cid}'`), "f");
});
await t("I3", "SMS campaigns carry a one-tap opt-out link that works", async () => {
  await mock("/__reset", {});
  const r = await post("/api/v1/campaigns", { segment: "vip", message: "{name}: weekend sale", channels: ["sms"] }, { token: S.token });
  await campaignDone(S.token, r.json.id);
  const m = (await mockLog("bulksmsbd.net"))[0].body.message;
  const link = m.match(/(http\S+\/u\/\S+)/)?.[1];
  ok(link && m.includes("বন্ধ করতে"), m);
  const page = await (await fetch(link)).text();
  ok(page.includes("বন্ধ করবেন"), "confirmation page");
  ok((await (await fetch(link.slice(0, -2) + "zz")).text()).includes("ঠিক নেই"), "tampered link refused");
});
await t("I4", "STOP by SMS to the Twilio number opts the customer out", async () => {
  const cid = sql(`SELECT id FROM "Customer" WHERE "shopId"='${US.shopId}' LIMIT 1`);
  const phone = sql(`SELECT phone FROM "Customer" WHERE id='${cid}'`);
  const url = BASE + "/api/webhooks/twilio-sms";
  const params = { From: "+" + phone, To: "+15005550006", Body: "STOP" };
  const crypto = await import("node:crypto");
  const sig = crypto.createHmac("sha1", SECRETS.twilio).update(url + Object.keys(params).sort().map((k) => k + params[k]).join("")).digest("base64");
  eq((await fetch(url, { method: "POST", headers: { "X-Twilio-Signature": "bad" }, body: new URLSearchParams(params) })).status, 403);
  eq((await fetch(url, { method: "POST", headers: { "X-Twilio-Signature": sig }, body: new URLSearchParams(params) })).status, 200);
  eq(sql(`SELECT "optedOut" FROM "Customer" WHERE id='${cid}'`), "t");
});

/* ======================= J. Plans and limits ======================= */
section("J. Plans and limits");
await t("J1", "Free plan limits are shown in /me and /billing with BDT prices", async () => {
  const B = await newShop();
  const me = await get("/api/v1/me", { token: B.token });
  eq([me.json.plan.messages.limit, me.json.plan.ai.limit], [200, 50]);
  const b = await get("/api/v1/billing", { token: B.token });
  eq(b.json.plans.map((p) => p.price.amount), [0, 990, 2490]);
  eq([b.json.provider, b.json.onlinePayments], ["sslcommerz", true]);
  const u = await get("/api/v1/billing", { token: US.token });
  eq([u.json.plans[1].price.currency, u.json.provider], ["USD", "stripe"]);
});
await t("J2", "A paid plan that has run out falls back to Free", async () => {
  const B = await newShop();
  sql(`UPDATE "Shop" SET plan='growth', "planUntil"=now()-interval '1 day' WHERE id='${B.shopId}'`);
  eq((await get("/api/v1/me", { token: B.token })).json.plan.key, "free");
});
await t("J3", "When the monthly limit is used up, templates and SMS stop with 429", async () => {
  sql(`UPDATE "Shop" SET "limitOverride"=0 WHERE id='${S.shopId}'`);
  const r = await post(`/api/v1/inbox/${vipId()}`, { text: "limit test", channel: "sms" }, { token: S.token });
  eq([r.status, r.json.code], [429, "limit_reached"]);
  sql(`UPDATE "Shop" SET "limitOverride"=NULL WHERE id='${S.shopId}'`);
});

/* ======================= K. Payments ======================= */
section("K. Payments");
let P;
await t("K1", "Bangladesh: checkout opens SSLCommerz for the right amount", async () => {
  P = await newShop();
  await mock("/__reset", {});
  const r = await post("/api/v1/billing/checkout", { plan: "starter", months: 3 }, { token: P.token });
  eq(r.status, 200, JSON.stringify(r.json)); ok(r.json.url.startsWith("https://sandbox.sslcommerz.com/"));
  const s = (await mockLog("sandbox.sslcommerz.com"))[0].body;
  eq([s.total_amount, s.currency, s.success_url], ["2970", "BDT", BASE + "/api/billing/sslcommerz?kind=success"]);
  P.tran = s.tran_id;
});
await t("K2", "SSLCommerz success: validated with SSLCommerz, plan on for 3 months, receipt emailed", async () => {
  const res = await fetch(`${BASE}/api/billing/sslcommerz?kind=success`, { method: "POST", body: new URLSearchParams({ tran_id: P.tran, val_id: "VAL-" + P.tran, status: "VALID", amount: "2970" }), redirect: "manual" });
  eq(res.status, 303); ok(res.headers.get("location").endsWith("/billing?status=paid"), res.headers.get("location"));
  const me = await get("/api/v1/me", { token: P.token });
  eq(me.json.plan.key, "starter");
  const days = (new Date(me.json.plan.until) - Date.now()) / 86400000;
  ok(days > 85 && days < 95, `until ${me.json.plan.until}`);
  await until(async () => (await mail()).find((m) => m.to.join().includes(P.email) && /receipt|রসিদ/i.test(m.subject)));
});
await t("K3", "The IPN arriving too does not add months twice", async () => {
  const until1 = (await get("/api/v1/me", { token: P.token })).json.plan.until;
  await fetch(`${BASE}/api/billing/sslcommerz?kind=ipn`, { method: "POST", body: new URLSearchParams({ tran_id: P.tran, val_id: "VAL-" + P.tran, status: "VALID" }) });
  eq((await get("/api/v1/me", { token: P.token })).json.plan.until, until1);
});
await t("K4", "A forged success (validation fails) does not give a plan", async () => {
  const B = await newShop();
  await post("/api/v1/billing/checkout", { plan: "growth", months: 1 }, { token: B.token });
  const tran = sql(`SELECT "tranId" FROM "Payment" WHERE "shopId"='${B.shopId}'`);
  const res = await fetch(`${BASE}/api/billing/sslcommerz?kind=success`, { method: "POST", body: new URLSearchParams({ tran_id: tran, val_id: "VAL-fake", status: "VALID" }), redirect: "manual" });
  ok(res.headers.get("location").endsWith("status=error"));
  eq((await get("/api/v1/me", { token: B.token })).json.plan.key, "free");
});
await t("K5", "Cancelled and failed payments are recorded as such", async () => {
  const B = await newShop();
  await post("/api/v1/billing/checkout", { plan: "starter", months: 1 }, { token: B.token });
  const tran = sql(`SELECT "tranId" FROM "Payment" WHERE "shopId"='${B.shopId}'`);
  const res = await fetch(`${BASE}/api/billing/sslcommerz?kind=cancel`, { method: "POST", body: new URLSearchParams({ tran_id: tran }), redirect: "manual" });
  ok(res.headers.get("location").endsWith("status=cancelled"));
  eq(sql(`SELECT status FROM "Payment" WHERE "tranId"='${tran}'`), "cancelled");
});
await t("K6", "International: Stripe Checkout in USD, return page confirms, plan on", async () => {
  await mock("/__reset", {});
  const r = await post("/api/v1/billing/checkout", { plan: "growth", months: 1 }, { token: US.token });
  eq(r.status, 200, JSON.stringify(r.json)); ok(r.json.url.includes("checkout.stripe.com"));
  const s = (await mockLog("api.stripe.com"))[0].body;
  eq([s["line_items[0][price_data][currency]"], s["line_items[0][price_data][unit_amount]"]], ["usd", "2900"]);
  const sid = r.json.url.split("/").pop();
  const back = await fetch(`${BASE}/api/billing/stripe?kind=success&session_id=${sid}`, { redirect: "manual" });
  ok(back.headers.get("location").endsWith("status=paid"));
  eq((await get("/api/v1/me", { token: US.token })).json.plan.key, "growth");
  US.sid = sid;
});
await t("K7", "Stripe webhook: signature checked, a repeat does not add months twice", async () => {
  const u1 = (await get("/api/v1/me", { token: US.token })).json.plan.until;
  eq((await stripeHook({ type: "checkout.session.completed", data: { object: { id: US.sid } } }, "whsec_wrong")).status, 400);
  eq((await stripeHook({ type: "checkout.session.completed", data: { object: { id: US.sid } } })).status, 200);
  eq((await get("/api/v1/me", { token: US.token })).json.plan.until, u1);
});
await t("K8", "Stripe session not paid: no plan", async () => {
  const B = await newShop({ country: "GB" });
  const r = await post("/api/v1/billing/checkout", { plan: "starter", months: 1 }, { token: B.token });
  const sid = r.json.url.split("/").pop();
  await mock("/__stripe", { id: sid, payment_status: "unpaid" });
  const back = await fetch(`${BASE}/api/billing/stripe?kind=success&session_id=${sid}`, { redirect: "manual" });
  ok(back.headers.get("location").endsWith("status=error"));
  eq((await get("/api/v1/me", { token: B.token })).json.plan.key, "free");
});
await t("K9", "Paid plans unlock voice and higher limits; buying again extends from the end date", async () => {
  const me = await get("/api/v1/me", { token: P.token });
  eq(me.json.plan.messages.limit, 2000);
  const u0 = new Date(me.json.plan.until);
  const r = await post("/api/v1/billing/checkout", { plan: "starter", months: 1 }, { token: P.token });
  const tran = r.json.url.split("/").pop();
  await fetch(`${BASE}/api/billing/sslcommerz?kind=ipn`, { method: "POST", body: new URLSearchParams({ tran_id: tran, val_id: "VAL-" + tran, status: "VALID" }) });
  const u1 = new Date((await get("/api/v1/me", { token: P.token })).json.plan.until);
  const d = (u1 - u0) / 86400000; ok(d > 27 && d < 32, `extended by ${d} days`);
});
await t("K10", "Invoice for a paid payment can be downloaded", async () => {
  const b = await get("/api/v1/billing", { token: P.token });
  const paid = b.json.payments.find((p) => p.status === "paid");
  ok(paid?.invoiceUrl, JSON.stringify(paid));
  const res = await fetch(BASE + paid.invoiceUrl, { headers: { Authorization: `Bearer ${P.token}` } });
  eq(res.status, 200); ok((await res.text()).includes(paid.tranId));
  eq((await fetch(BASE + paid.invoiceUrl, { headers: { Authorization: `Bearer ${US.token}` } })).status, 404);
});

/* ======================= L. Facebook Page posts ======================= */
section("L. Facebook Page posts");
await t("L1", "Post scheduled with no Page connected fails with a clear reason", async () => {
  const B = await newShop();
  const r = await post("/api/v1/posts", { text: "Hello Facebook!", at: new Date(Date.now() + 120000).toISOString() }, { token: B.token });
  eq(r.status, 201);
  sql(`UPDATE "Post" SET "scheduledAt"=now()-interval '1 minute' WHERE id='${r.json.id}'`);
  await cron();
  const p = (await get("/api/v1/posts", { token: B.token })).json.items[0];
  eq(p.status, "failed"); ok(/Facebook/.test(p.error));
});
await t("L2", "Connect a Page: login URL, callback saves every Page, pick the second Page", async () => {
  const s = await get("/api/v1/settings/facebook", { token: S.token });
  eq(s.json.available, true); ok(s.json.connectUrl);
  const c = await fetch(s.json.connectUrl, { redirect: "manual" });
  const loc = c.headers.get("location");
  ok(loc.startsWith("https://www.facebook.com/v21.0/dialog/oauth"), loc);
  const state = new URL(loc).searchParams.get("state");
  const reuse = await fetch(s.json.connectUrl, { redirect: "manual" });
  eq(reuse.status, 400, "handoff link works once");
  const cb = await fetch(`${BASE}/api/facebook/callback?code=CODE123&state=${state}`, { redirect: "manual" });
  ok((await cb.text()).includes("Test Page One"));
  const s2 = await get("/api/v1/settings/facebook", { token: S.token });
  eq([s2.json.connected, s2.json.pages.length], [true, 2]);
  eq((await post("/api/v1/settings/facebook/page", { pageId: "PAGE2" }, { token: S.token })).status, 200);
  eq((await post("/api/v1/settings/facebook/page", { pageId: "NOPE" }, { token: S.token })).status, 404);
});
await t("L3", "Scheduled post is published to the chosen Page at its time; cancel works", async () => {
  await mock("/__reset", {});
  const r = await post("/api/v1/posts", { text: "Winter sale is live!", at: new Date(Date.now() + 120000).toISOString() }, { token: S.token });
  const r2 = await post("/api/v1/posts", { text: "This one is cancelled", at: new Date(Date.now() + 120000).toISOString() }, { token: S.token });
  eq((await del(`/api/v1/posts/${r2.json.id}`, undefined, { token: S.token })).status, 200);
  sql(`UPDATE "Post" SET "scheduledAt"=now()-interval '1 minute' WHERE "shopId"='${S.shopId}' AND status='scheduled'`);
  await cron();
  const items = (await get("/api/v1/posts", { token: S.token })).json.items;
  eq(items.find((p) => p.id === r.json.id).status, "published");
  eq(items.find((p) => p.id === r2.json.id).status, "draft");
  const feed = (await mockLog("graph.facebook.com")).filter((e) => e.path.endsWith("/feed"));
  eq([feed.length, feed[0].path, feed[0].body.access_token], [1, "/v21.0/PAGE2/feed", "PAGE2-TOKEN"]);
});
await t("L4", "Disconnect Facebook", async () => {
  eq((await del("/api/v1/settings/facebook", undefined, { token: S.token })).status, 200);
  eq((await get("/api/v1/settings/facebook", { token: S.token })).json.connected, false);
});

/* ======================= M. Languages and countries ======================= */
section("M. Languages, currencies and countries");
await t("M1", "Errors come back in the language asked for (bn / en)", async () => {
  const bn = await post("/api/v1/customers", { name: "X", phone: "1" }, { token: S.token, lang: "bn" });
  const en = await post("/api/v1/customers", { name: "X", phone: "1" }, { token: S.token, lang: "en" });
  ok(/[ঀ-৿]/.test(bn.json.error), bn.json.error);
  ok(/^[\x00-\x7F]+$/.test(en.json.error), en.json.error);
});
await t("M2", "Dashboard greeting and locale fields", async () => {
  const d = await get("/api/v1/dashboard", { token: US.token, lang: "en" });
  ok(/^Good (morning|afternoon|evening)$/.test(d.json.greeting), d.json.greeting);
  eq([d.json.currency, d.json.timezone], ["USD", "America/New_York"]);
});
await t("M3", "Changing country moves currency and time zone; bad values are refused", async () => {
  const B = await newShop();
  eq((await patch("/api/v1/settings", { country: "IN" }, { token: B.token })).status, 200);
  const s = await get("/api/v1/settings", { token: B.token });
  eq([s.json.profile.currency, s.json.profile.timezone], ["INR", "Asia/Kolkata"]);
  eq((await patch("/api/v1/settings", { timezone: "Mars/Base" }, { token: B.token })).status, 400);
  eq((await patch("/api/v1/settings", { currency: "XX1" }, { token: B.token })).status, 400);
  eq((await patch("/api/v1/settings", { smsApiUrl: "http://insecure" }, { token: B.token })).status, 400);
});
await t("M4", "Web pages render in Bangla and English", async () => {
  const bn = await (await fetch(BASE + "/login", { headers: { "Accept-Language": "bn" } })).text();
  const en = await (await fetch(BASE + "/login", { headers: { Cookie: "dakly_lang=en" } })).text();
  ok(/[ঀ-৿]/.test(bn)); ok(/Log in|Login|Sign in/i.test(en));
  for (const p of ["/privacy", "/delete-account", "/register", "/forgot"]) eq((await fetch(BASE + p)).status, 200, p);
});

/* ======================= N. Support tickets (merchant side) ======================= */
section("N. Support tickets");
await t("N1", "Merchant opens a ticket and sees it in the list", async () => {
  const r = await post("/api/v1/tickets", { subject: "WhatsApp not sending", body: "Messages stay in test mode" }, { token: S.token });
  eq(r.status, 201);
  eq((await get("/api/v1/tickets", { token: S.token })).json.items[0].subject, "WhatsApp not sending");
  eq((await post("/api/v1/tickets", { subject: "x", body: "y" }, { token: S.token })).status, 400);
});

/* ======================= O. Pending, suspended, deleted ======================= */
section("O. Pending, suspended and deleted accounts");
await t("O1", "Pending shop: 403 pending everywhere except /me and /status", async () => {
  const B = await newShop();
  sql(`UPDATE "Shop" SET approved=false WHERE id='${B.shopId}'`);
  const r = await get("/api/v1/customers", { token: B.token });
  eq([r.status, r.json.code], [403, "pending"]);
  eq((await get("/api/v1/status", { token: B.token })).json.status, "pending");
  eq((await get("/api/v1/me", { token: B.token })).status, 200);
});
await t("O2", "Delete account: wrong password refused, right password removes everything", async () => {
  const B = await newShop();
  await post("/api/v1/customers", { name: "Gone Soon", phone: "01600000001" }, { token: B.token });
  eq((await del("/api/v1/me", { password: "nope-nope" }, { token: B.token })).status, 400);
  eq((await del("/api/v1/me", { password: B.password }, { token: B.token })).json.deleted, true);
  eq(sql(`SELECT count(*) FROM "Shop" WHERE id='${B.shopId}'`), "0");
  eq(sql(`SELECT count(*) FROM "Customer" WHERE "shopId"='${B.shopId}'`), "0");
  eq((await post("/api/v1/auth/login", { email: B.email, password: B.password })).status, 401);
});

/* ======================= Q. Account extras ======================= */
section("Q. Account extras, reminders and exports");
await t("Q1", "Change password: needs the current one, signs out other devices, emails a notice", async () => {
  const B = await newShop();
  const other = (await post("/api/v1/auth/login", { email: B.email, password: B.password })).json.token;
  eq((await post("/api/v1/auth/password", { current: "wrong-one", password: "brandnew123" }, { token: B.token })).status, 400);
  const r = await post("/api/v1/auth/password", { current: B.password, password: "brandnew123" }, { token: B.token });
  eq(r.status, 200); ok(r.json.token);
  eq((await get("/api/v1/me", { token: other })).status, 401);
  eq((await get("/api/v1/me", { token: r.json.token })).status, 200);
  await until(async () => (await mail()).find((m) => m.to.join().includes(B.email) && /changed|বদলানো/.test(m.subject)));
});
await t("Q2", "Customer list downloads as CSV for Excel", async () => {
  const res = await fetch(BASE + "/api/v1/customers/export", { headers: { Authorization: `Bearer ${S.token}` } });
  eq(res.status, 200); ok(res.headers.get("content-type").includes("text/csv"));
  const text = await res.text();
  ok(text.includes("Vip Person") && text.includes("+8801811000001"), text.slice(0, 200));
});
await t("Q3", "Plan ending in 2 days and plan ended both email the owner once", async () => {
  const B = await newShop(), C = await newShop();
  sql(`UPDATE "Shop" SET plan='starter', "planUntil"=now()+interval '2 days' WHERE id='${B.shopId}'`);
  sql(`UPDATE "Shop" SET plan='starter', "planUntil"=now()-interval '1 hour' WHERE id='${C.shopId}'`);
  sql(`DELETE FROM "SystemState" WHERE key='housekeeping.last'`);
  const tick = await cron();
  ok(tick.json.housekeeping?.reminders >= 2, JSON.stringify(tick.json));
  await until(async () => (await mail()).find((m) => m.to.join().includes(B.email) && /শেষ হবে|ends on/.test(m.subject)));
  await until(async () => (await mail()).find((m) => m.to.join().includes(C.email) && /মেয়াদ শেষ|has ended/.test(m.subject)));
  sql(`DELETE FROM "SystemState" WHERE key='housekeeping.last'`);
  await cron();
  await sleep(500);
  eq((await mail()).filter((m) => m.to.join().includes(B.email) && /শেষ হবে|ends on/.test(m.subject)).length, 1, "only once");
});
await t("Q4", "Abandoned checkouts older than a day are closed", async () => {
  const B = await newShop();
  await post("/api/v1/billing/checkout", { plan: "starter", months: 1 }, { token: B.token });
  sql(`UPDATE "Payment" SET "createdAt"=now()-interval '2 days' WHERE "shopId"='${B.shopId}'`);
  sql(`DELETE FROM "SystemState" WHERE key='housekeeping.last'`);
  await cron();
  eq(sql(`SELECT status FROM "Payment" WHERE "shopId"='${B.shopId}'`), "failed");
});
await t("Q5", "New sign-ups notify the admins", async () => {
  ok((await mail()).some((m) => m.to.join().includes("owner@dakly.test") && /New Dakly merchant/.test(m.subject)));
});

/* ======================= P. Security ======================= */
section("P. Security");
await t("P1", "Scheduler endpoint needs the cron secret", async () => {
  eq((await get("/api/cron")).status, 403);
  eq((await get("/api/cron?key=wrong")).status, 403);
});
await t("P2", "Security headers are set", async () => {
  const h = (await fetch(BASE + "/login")).headers;
  eq(h.get("x-frame-options"), "DENY"); eq(h.get("x-content-type-options"), "nosniff");
  ok(h.get("content-security-policy"), "CSP header");
  eq(h.get("x-powered-by"), null);
});
await t("P3", "Sign-up is rate limited per IP", async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await post("/api/v1/auth/register", { name: "Spam Bot", shop: "Spam", email: `spam-${uniq()}@dakly.test`, password: "password123" }, { headers: { "X-Forwarded-For": "203.0.113.77" } });
  eq(last.status, 429);
});
await t("P4", "API is rate limited per account", async () => {
  const B = await newShop();
  let codes = [];
  for (let i = 0; i < 140; i++) codes.push((await get("/api/v1/status", { token: B.token })).status);
  ok(codes.includes(429), "got 429");
});
await t("P5", "Webhook for an unknown Twilio message id is ignored safely", async () => {
  const r = await twilioHook("?m=does-not-exist", { Digits: "1" });
  eq(r.status, 200);
});
await t("P6", "Voice audio is only served for real voice messages", async () => {
  eq((await fetch(`${BASE}/api/voice/audio/nope`)).status, 404);
});

/* ======================= R. Health and self-check ======================= */
section("R. Health and self-check");
await t("R1", "/api/health reports database and scheduler", async () => {
  const r = await get("/api/health");
  eq(r.status, 200); eq(r.json.ok, true); eq(r.json.db, true);
  ok(typeof r.json.schedulerLastRunSecondsAgo === "number");
});
await t("R2", "Startup self-check ran against every provider and found them working", async () => {
  const sc = JSON.parse(sql(`SELECT value FROM "SystemState" WHERE key='selfcheck'`));
  const groups = sc.live.map((c) => c.group);
  for (const g of ["Core", "OpenAI", "WhatsApp", "Twilio", "SMS gateway", "Facebook", "Stripe", "SSLCommerz", "Email"]) ok(groups.includes(g), "missing " + g);
  const bad = sc.live.filter((c) => c.level !== "ok");
  eq(bad, [], "all live checks ok");
  eq(sc.env.filter((c) => c.level === "error"), []);
});

fs.mkdirSync("test/results", { recursive: true });
fs.writeFileSync("test/results/api.json", JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
