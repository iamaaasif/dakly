// Recorded walkthroughs of the web panels: one video per session plus a screenshot per step.
// Needs a running stack and test/walkthrough-seed.mjs accounts.
//   node test/walkthrough-web.mjs <outDir> '<bn seed json>' '<en seed json>'
// Writes <outDir>/<session>/NN-step.png, <outDir>/<session>.webm and <outDir>/steps.json.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { BASE } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const [outDir, bnSeed, enSeed] = process.argv.slice(2);
const bn = JSON.parse(bnSeed), en = JSON.parse(enSeed);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = [];

async function session(name, { lang, viewport, device, loginAs }, steps) {
  const dir = path.join(outDir, name);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const base = device ? devices[device] : { viewport };
  const ctx = await browser.newContext({ ...base, locale: lang === "bn" ? "bn-BD" : "en-GB", recordVideo: { dir, size: base.viewport ?? viewport } });
  await ctx.addCookies([{ name: "dakly_lang", value: lang, url: BASE }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  let n = 0;
  const log = { session: name, steps: [] };
  const shot = async (label) => {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(700);
    n++;
    const file = `${String(n).padStart(2, "0")}-${label}.png`;
    await page.screenshot({ path: path.join(dir, file) });
    log.steps.push({ step: n, label, url: page.url().replace(BASE, ""), file: `${name}/${file}`, errors: errors.splice(0) });
    console.log(`  ${name} ${n} ${label}`);
  };
  const go = async (p) => { const r = await page.goto(BASE + p, { waitUntil: "networkidle" }); if (r.status() >= 400) throw new Error(`${p} -> ${r.status()}`); };
  const slowType = (sel, text) => page.locator(sel).first().pressSequentially(text, { delay: 25 });

  // log in through the form, like a person would
  await go("/login");
  await shot("login");
  await slowType("#email", loginAs.email);
  await slowType("#password", loginAs.password);
  await shot("login-filled");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.click("form button.primary")]);
  try {
    await steps({ page, go, shot, lang });
    log.ok = true;
  } catch (e) {
    log.ok = false; log.error = String(e.message ?? e).slice(0, 400);
    await shot("failure").catch(() => {});
    console.log(`  ${name} FAILED: ${log.error}`);
  }
  const video = page.video();
  await ctx.close();
  if (video) fs.renameSync(await video.path(), path.join(outDir, `${name}.webm`));
  report.push(log);
}

const merchant = async ({ page, go, shot, lang }) => {
  await page.waitForSelector(".greet, .hero, [data-testid=onboarding]");
  await shot("home");
  await page.mouse.wheel(0, 700); await page.waitForTimeout(500);
  await shot("home-scrolled");

  await go("/customers");
  await shot("customers");
  await page.locator("a.row", { hasText: "Ayesha" }).first().click();
  await page.waitForURL(/\/customers\/[^/]+$/);
  await shot("customer-detail");

  await go("/inbox");
  await shot("inbox");
  await page.locator("a.row", { hasText: "Ayesha" }).first().click();
  await page.waitForSelector("#chat-text");
  await shot("chat");
  await page.locator(".card.form", { has: page.locator("#chat-text") }).locator(".row-btns .btn.ghost").first().click();
  await page.waitForFunction(() => (document.querySelector("#chat-text")?.value ?? "").length > 10, null, { timeout: 30000 });
  await shot("chat-ai-reply");

  await go("/campaigns/new");
  await shot("campaign-1-audience");
  const inactive = page.locator(".pk", { hasText: /Inactive|কেনেননি|নিষ্ক্রিয়/ }).first();
  await ((await inactive.count()) ? inactive : page.locator(".pk").first()).click();
  await page.click(".nav-btns .btn.primary");
  await shot("campaign-2-channel");
  await page.click(".nav-btns .btn.primary");
  await page.locator("#offer").pressSequentially(lang === "bn" ? "ঈদের নতুন কালেকশনে ১৫% ছাড়, এই সপ্তাহে" : "15% off the new Eid collection this week", { delay: 20 });
  await page.locator(".row-btns .btn.ghost", { hasText: /AI/ }).first().click();
  await page.waitForFunction(() => (document.querySelector("#message")?.value ?? "").length > 10, null, { timeout: 30000 });
  await shot("campaign-3-ai-message");
  await page.click(".nav-btns .btn.primary");
  await shot("campaign-4-review");
  await Promise.all([page.waitForURL(/\/campaigns\/[^/n][^/]*$/, { timeout: 30000 }), page.click(".nav-btns .btn.primary")]);
  await page.waitForTimeout(2500); await page.reload({ waitUntil: "networkidle" });
  await shot("campaign-sent");

  await go("/posts");
  await page.locator("#pp").pressSequentially("Eid three-piece collection, 2450 taka", { delay: 20 });
  await page.locator(".card.form .btn.primary").first().click();
  await page.waitForFunction(() => [...document.querySelectorAll("textarea")].some((t) => t.id !== "pp" && t.value.length > 20), null, { timeout: 30000 });
  await shot("post-ai");

  for (const [p, label] of [["/knowledge", "knowledge"], ["/reports", "reports"], ["/alerts", "alerts"], ["/billing", "billing"], ["/support", "support"], ["/settings", "settings"]]) { await go(p); await shot(label); }
};

await session("web-phone-bangla", { lang: "bn", device: "Pixel 7", loginAs: bn }, merchant);
await session("web-desktop-english", { lang: "en", viewport: { width: 1366, height: 860 }, loginAs: en }, merchant);
await session("web-admin", { lang: "en", viewport: { width: 1366, height: 860 }, loginAs: { email: "owner@dakly.test", password: "adminpass123" } }, async ({ page, go, shot }) => {
  for (const [p, label] of [["/admin", "overview"], ["/admin/merchants", "merchants"], ["/admin/payments", "payments"], ["/admin/usage", "usage-and-cost"], ["/admin/tickets", "support-tickets"], ["/admin/announcements", "announcements"], ["/admin/staff", "staff"], ["/admin/audit", "audit-log"], ["/admin/system", "system"]]) { await go(p); await shot(label); }
  await go("/admin/merchants");
  await page.locator("a", { hasText: "Rahima Fashion" }).first().click();
  await page.waitForURL(/\/admin\/merchants\/.+/);
  await shot("merchant-detail");
});

await browser.close();
fs.writeFileSync(path.join(outDir, "steps.json"), JSON.stringify(report, null, 2));
const bad = report.filter((r) => !r.ok);
const errs = report.flatMap((r) => r.steps.filter((s) => s.errors.length).map((s) => `${r.session} #${s.step} ${s.label}: ${s.errors.join(" | ")}`));
console.log(`\nsessions ok: ${report.length - bad.length}/${report.length}; steps: ${report.reduce((a, r) => a + r.steps.length, 0)}; steps with browser errors: ${errs.length}`);
errs.forEach((e) => console.log("  " + e));
process.exit(bad.length ? 1 : 0);
