// Browser tests for the merchant panel and the admin back office (Playwright + Chromium).
// Needs a running test stack (test/run.sh) and Playwright: npm i -D playwright && npx playwright install chromium
import fs from "node:fs";
import { createRequire } from "node:module";
import { t, section, eq, ok, post, get, mock, mail, sql, newShop, uniq, until, results, BASE, sleep } from "./lib.mjs";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(process.env.PLAYWRIGHT_PATH || "/opt/node-tools/node_modules/playwright"); }

const browser = await playwright.chromium.launch();
const problems = [];
async function newPage(lang = "bn") {
  const ctx = await browser.newContext({ locale: lang === "bn" ? "bn-BD" : "en-GB", viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "dakly_lang", value: lang, url: BASE }]);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource.*(404|net::ERR_NAME)/.test(m.text())) problems.push(`${page.url()}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${page.url()}: ${e.message.slice(0, 200)}`));
  return page;
}
/** Clicks a server-action button and waits until the action has finished. */
const act = async (p, locator) => {
  await Promise.all([p.waitForResponse((r) => r.request().method() === "POST" && r.url().startsWith(BASE), { timeout: 15000 }), locator.click()]);
  await p.waitForLoadState("networkidle");
};
const visit = async (page, path) => {
  const r = await page.goto(BASE + path, { waitUntil: "networkidle" });
  ok(r.status() < 400, `${path} -> ${r.status()}`);
  ok(!(await page.content()).includes("Application error"), `${path} shows an application error`);
  return r;
};

/* ======================= W. Merchant panel ======================= */
section("W. Merchant web panel");
const email = `web-${uniq()}@dakly.test`, password = "webpass123";
let page;
await t("W1", "Sign up in the browser lands on Home with the get-started checklist", async () => {
  page = await newPage("bn");
  await visit(page, "/register");
  await page.fill("#name", "Web Owner"); await page.fill("#shop", "Web Shop"); await page.fill("#email", email); await page.fill("#password", password);
  await page.click("form button.primary");
  await page.waitForURL(BASE + "/", { timeout: 15000 });
  await page.waitForSelector("[data-testid=onboarding]");
  const txt = await page.textContent("[data-testid=onboarding]");
  ok(/[01০১]\/[4৪]/.test(txt), txt);
});
await t("W2", "Every merchant page opens without errors", async () => {
  for (const p of ["/", "/customers", "/customers/new", "/customers/new?mode=excel", "/campaigns", "/campaigns/new", "/inbox", "/posts", "/knowledge", "/reports", "/alerts", "/billing", "/support", "/settings"]) await visit(page, p);
});
await t("W3", "Add a customer by hand", async () => {
  await visit(page, "/customers/new?mode=manual");
  const form = page.locator("form").filter({ has: page.locator("input[name=phone]") }).first();
  await form.locator("input[name=name]").fill("Browser Customer");
  await form.locator("input[name=phone]").fill("01712-000777");
  if (await form.locator("input[name=amount]").count()) await form.locator("input[name=amount]").fill("1800");
  await form.locator("button.primary").click();
  await page.waitForSelector(".okmsg", { timeout: 10000 });
  await visit(page, "/customers");
  ok((await page.content()).includes("Browser Customer"));
});
await t("W4", "Excel upload from the browser", async () => {
  await visit(page, "/customers/new?mode=excel");
  fs.writeFileSync("/tmp/dakly-web.csv", "name,phone,total\nSheet One,01711555001,2000\nSheet Two,01711555002,600\n");
  await page.setInputFiles("#xl", "/tmp/dakly-web.csv");
  await page.waitForTimeout(1500);
  const btn = page.locator("button.primary").last();
  await btn.click();
  await until(async () => (await page.content()).match(/২|2/) && sql(`SELECT count(*) FROM "Customer" c JOIN "Shop" s ON s.id=c."shopId" JOIN "User" u ON u.id=s."ownerId" WHERE u.email='${email}'`) === "3", 10000);
});
await t("W5", "Teach the AI a product in the knowledge base", async () => {
  await visit(page, "/knowledge");
  await page.selectOption("#kb-type", "product");
  await page.fill("#kb-title", "Browser Jamdani");
  await page.fill("#kb-price", "4500");
  await page.locator("form").filter({ has: page.locator("#kb-title") }).locator("button.primary").click();
  await page.waitForSelector(".okmsg", { timeout: 10000 });
  ok((await page.content()).includes("Browser Jamdani"));
});
await t("W6", "Campaign wizard: pick segment, channel, AI writes, send now", async () => {
  await mock("/__reset", {});
  await visit(page, "/campaigns/new");
  const next = () => page.locator(".nav-btns button.primary").click();
  const segs = page.locator(".pick .pk");
  for (let i = 0; i < (await segs.count()); i++) { if (!/^[0০]$/.test((await segs.nth(i).locator(".n").textContent()).trim())) { await segs.nth(i).click(); break; } }
  await next();
  if (!(await page.locator(".pick .pk.on").count())) await page.locator(".pick .pk").first().click();
  await next();
  await page.fill("#offer", "Winter shawl 15% off");
  await page.locator("button:has-text('AI')").first().click();
  await page.waitForFunction(() => (document.querySelector("#message")?.value || "").includes("mock-ai"), null, { timeout: 10000 });
  await next();
  await next();
  await page.waitForURL(/\/campaigns\/\w+/, { timeout: 15000 });
  await until(async () => (await mock("/__log?host=graph.facebook.com")).length >= 1, 15000);
});
await t("W7", "Settings: save shop name and change password (other sessions signed out)", async () => {
  await visit(page, "/settings");
  await page.fill("#name", "Web Shop Renamed");
  await page.locator("form").filter({ has: page.locator("#name") }).locator("button.primary").first().click();
  await page.waitForSelector(".okmsg", { timeout: 10000 });
  const api = (await post("/api/v1/auth/login", { email, password })).json.token;
  await page.fill("#pw-current", password); await page.fill("#pw-new", "webpass456"); await page.fill("#pw-confirm", "webpass456");
  await page.locator("#password button").click();
  await page.waitForSelector("#password .okmsg", { timeout: 10000 });
  eq((await get("/api/v1/me", { token: api })).status, 401, "API token from before is signed out");
  await visit(page, "/settings");
  ok(page.url().endsWith("/settings"), "this browser stays signed in");
});
await t("W8", "Billing: buying a plan sends the browser to SSLCommerz", async () => {
  await visit(page, "/billing");
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("sslcommerz.com"), { timeout: 15000 }),
    page.locator("form button.primary").first().click(),
  ]);
  ok(req.url().startsWith("https://sandbox.sslcommerz.com/EasyCheckOut/"), req.url());
});
await t("W9", "Support ticket from the panel", async () => {
  await visit(page, "/support");
  await page.fill("#t-subject", "Browser ticket"); await page.fill("#t-body", "Help from the browser please");
  await page.locator("form").filter({ has: page.locator("#t-subject") }).locator("button").first().click();
  await page.waitForURL(/\/support\/\w+/, { timeout: 10000 });
});
await t("W10", "Logout, forgot password by email, reset from the link", async () => {
  await visit(page, "/settings");
  await page.locator("form button:has-text('Logout')").click();
  await page.waitForURL(/\/login/);
  await visit(page, "/forgot");
  await page.fill("#email", email);
  await page.locator("form button").first().click();
  const m = await until(async () => (await mail()).filter((x) => x.to.join().includes(email) && /reset\?token=/.test(x.text)).pop());
  await page.goto(m.text.match(/(http\S+reset\?token=[\w-]+)/)[1]);
  await page.fill("#password", "webpass789");
  await page.locator("form button").first().click();
  await page.waitForURL(BASE + "/", { timeout: 10000 });
});
await t("W11", "English panel renders English", async () => {
  const p = await newPage("en");
  await visit(p, "/login");
  await p.fill("#email", email); await p.fill("#password", "webpass789");
  await p.click("form button.primary");
  await p.waitForURL(BASE + "/");
  await sql(`UPDATE "User" SET "uiLang"='en' WHERE email='${email}'`);
  await visit(p, "/settings");
  ok((await p.content()).includes("Change password"), "English labels");
  await p.context().close();
});

/* ======================= X. Admin back office ======================= */
section("X. Admin back office");
let admin, M;
await t("X1", "Admin (ADMIN_EMAILS) signs in and every admin page opens", async () => {
  const exists = sql(`SELECT count(*) FROM "User" WHERE email='owner@dakly.test'`);
  if (exists === "0") await post("/api/v1/auth/register", { name: "Asif Admin", shop: "Dakly HQ", email: "owner@dakly.test", password: "adminpass123" }, { headers: { "X-Forwarded-For": "192.0.2.10" } });
  admin = await newPage("bn");
  await visit(admin, "/login");
  await admin.fill("#email", "owner@dakly.test"); await admin.fill("#password", "adminpass123");
  await admin.click("form button.primary");
  await admin.waitForURL(/\/admin$/, { timeout: 10000 });
  for (const p of ["/admin", "/admin/merchants", "/admin/merchants?f=pending", "/admin/payments", "/admin/usage", "/admin/tickets", "/admin/announcements", "/admin/staff", "/admin/audit", "/admin/system"]) await visit(admin, p);
});
await t("X2", "System page shows the self-check; re-run it and send a test email", async () => {
  await visit(admin, "/admin/system");
  ok(await admin.locator("[data-testid=selfcheck]").count());
  await admin.locator("form button:has-text('এখনই যাচাই')").click();
  await admin.waitForLoadState("networkidle");
  await admin.locator("form button:has-text('Test Email')").click();
  await admin.waitForURL(/mail=ok/, { timeout: 15000 });
  await until(async () => (await mail()).find((m) => m.to.join().includes("owner@dakly.test") && m.subject === "Dakly test email"));
});
await t("X3", "Approve a pending merchant: they get an email and can use the app", async () => {
  M = await newShop();
  sql(`UPDATE "Shop" SET approved=false WHERE id='${M.shopId}'`);
  eq((await get("/api/v1/customers", { token: M.token })).json.code, "pending");
  await visit(admin, `/admin/merchants/${M.shopId}`);
  await act(admin, admin.locator("form button:has-text('অনুমোদন')"));
  eq((await get("/api/v1/customers", { token: M.token })).status, 200);
  await until(async () => (await mail()).find((m) => m.to.join().includes(M.email) && /চালু/.test(m.subject)));
});
await t("X4", "Give a plan with a recorded bKash payment, and set a message limit", async () => {
  await visit(admin, `/admin/merchants/${M.shopId}`);
  const f = admin.locator("form").filter({ has: admin.locator("select[name=plan]") }).first();
  await f.locator("select[name=plan]").selectOption("growth");
  await f.locator("[name=months]").fill("2");
  if (await f.locator("[name=record]").count()) await f.locator("[name=record]").check();
  if (await f.locator("[name=amount]").count()) await f.locator("[name=amount]").fill("4980");
  await f.locator("button").click();
  await admin.waitForSelector(".okmsg", { timeout: 10000 });
  const me = (await get("/api/v1/me", { token: M.token })).json;
  eq(me.plan.key, "growth");
  eq(sql(`SELECT provider||':'||status||':'||amount FROM "Payment" WHERE "shopId"='${M.shopId}'`), "manual:manual:4980");
  const lf = admin.locator("form").filter({ has: admin.locator("[name=limit]") }).first();
  await lf.locator("[name=limit]").fill("5000"); await act(admin, lf.locator("button"));
  eq((await get("/api/v1/me", { token: M.token })).json.plan.messages.limit, 5000);
});
await t("X5", "Suspend: the merchant is blocked with the reason and queued messages stop; unsuspend restores", async () => {
  await visit(admin, `/admin/merchants/${M.shopId}`);
  await admin.fill("input[name=reason]", "Spam complaints");
  await act(admin, admin.locator("form button:has-text('স্থগিত করুন')"));
  const r = await get("/api/v1/customers", { token: M.token });
  eq(r.json.code, "suspended");
  eq((await get("/api/v1/status", { token: M.token })).json.reason, "Spam complaints");
  await visit(admin, `/admin/merchants/${M.shopId}`);
  await act(admin, admin.locator("form button:has-text('আবার চালু')"));
  eq((await get("/api/v1/customers", { token: M.token })).status, 200);
});
await t("X6", "Turn a merchant's login off (signs them out everywhere) and back on", async () => {
  await visit(admin, `/admin/merchants/${M.shopId}`);
  await act(admin, admin.locator("form button:has-text('Login বন্ধ')"));
  eq((await get("/api/v1/me", { token: M.token })).status, 401);
  eq((await post("/api/v1/auth/login", { email: M.email, password: M.password })).status, 403);
  await visit(admin, `/admin/merchants/${M.shopId}`);
  await act(admin, admin.locator("form button:has-text('Login চালু')"));
  M.token = (await post("/api/v1/auth/login", { email: M.email, password: M.password })).json.token;
  ok(M.token);
});
await t("X7", "Send a password reset link from the back office", async () => {
  await visit(admin, `/admin/merchants/${M.shopId}`);
  await act(admin, admin.locator("form button:has-text('Reset Link')"));
  await until(async () => (await mail()).find((m) => m.to.join().includes(M.email) && /reset\?token=/.test(m.text) && /২৪|24/.test(m.text)));
});
await t("X8", "Answer a ticket: merchant sees the reply and gets an email", async () => {
  const tk = await post("/api/v1/tickets", { subject: "Admin reply test", body: "Please help me" }, { token: M.token });
  await visit(admin, `/admin/tickets/${tk.json.id}`);
  await admin.fill("textarea[name=body]", "Fixed it for you");
  await admin.locator("form").filter({ has: admin.locator("textarea[name=body]") }).locator("button").first().click();
  await admin.waitForSelector(".okmsg", { timeout: 10000 });
  const items = (await get("/api/v1/tickets", { token: M.token })).json.items;
  ok(items.find((x) => x.id === tk.json.id).messages.some((m) => m.fromStaff && m.body === "Fixed it for you"));
  await until(async () => (await mail()).find((m) => m.to.join().includes(M.email) && /Admin reply test/.test(m.subject)));
});
await t("X9", "Announcement appears on merchants' home", async () => {
  await visit(admin, "/admin/announcements");
  await admin.fill("input[name=title]", "Eid maintenance");
  await admin.fill("textarea[name=body]", "Dakly will be down 2-3am");
  await admin.locator("form").filter({ has: admin.locator("input[name=title]") }).locator("button").first().click();
  await admin.waitForSelector(".okmsg", { timeout: 10000 });
  await visit(page, "/");
  ok((await page.content()).includes("Eid maintenance"), "shown on merchant home");
});
await t("X10", "Add a Support staff member: invite email; Support cannot open System", async () => {
  const se = `support-${uniq()}@dakly.test`;
  await visit(admin, "/admin/staff");
  const f = admin.locator("form").filter({ has: admin.locator("select[name=role]") }).first();
  await f.locator("input[name=name]").fill("Help Desk"); await f.locator("input[name=email]").fill(se); await f.locator("select[name=role]").selectOption("support");
  await f.locator("button").click();
  await admin.waitForSelector(".okmsg", { timeout: 10000 });
  const m = await until(async () => (await mail()).find((x) => x.to.join().includes(se) && /reset\?token=/.test(x.text)));
  const sp = await newPage("bn");
  await sp.goto(m.text.match(/(http\S+reset\?token=[\w-]+)/)[1]);
  await sp.fill("#password", "supportpass1"); await sp.locator("form button").first().click();
  await sp.waitForLoadState("networkidle");
  await visit(sp, "/admin/tickets");
  await sp.goto(BASE + "/admin/system");
  ok(!sp.url().endsWith("/admin/system"), "support is sent away from System");
  await sp.context().close();
});
await t("X11", "Audit log records the admin actions", async () => {
  await visit(admin, "/admin/audit");
  const html = await admin.content();
  for (const a of ["merchant.approve", "merchant.plan", "merchant.suspend", "staff.add"]) ok(html.includes(a), "missing " + a);
});
await t("X12", "Delete a shop from the back office (typed confirmation)", async () => {
  const D = await newShop();
  const name = sql(`SELECT name FROM "Shop" WHERE id='${D.shopId}'`);
  await visit(admin, `/admin/merchants/${D.shopId}`);
  await admin.locator("summary:has-text('মুছুন')").click();
  await admin.fill("input[name=confirm]", name);
  await admin.locator("form button:has-text('সব Data মুছে ফেলুন')").click();
  await admin.waitForURL(/\/admin\/merchants$/, { timeout: 10000 });
  eq(sql(`SELECT count(*) FROM "Shop" WHERE id='${D.shopId}'`), "0");
});
await t("X13", "A merchant cannot open the back office", async () => {
  await page.goto(BASE + "/admin");
  ok(!page.url().includes("/admin"), page.url());
});
await t("X14", "No browser errors or blocked resources (CSP) on any page", async () => {
  eq(problems, []);
});

await browser.close();
fs.mkdirSync("test/results", { recursive: true });
fs.writeFileSync("test/results/web.json", JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
