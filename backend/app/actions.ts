"use server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { createSession, destroySession, requireShop, isStaff } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import { syncStore } from "@/lib/stores";
import * as svc from "@/lib/services";
import { dailyTips } from "@/lib/ai-insights";
import { startPayment } from "@/lib/billing";
import { sendMail } from "@/lib/mail";
import { appUrl } from "@/lib/config";
import { PLAN_KEYS, type PlanKey } from "@/lib/plans";
import { logError } from "@/lib/audit";
import { tr, LANG_COOKIE } from "@/lib/i18n/server";
import { isLang } from "@/lib/i18n";
import { cookies } from "next/headers";
import { currentUserId } from "@/lib/auth";
import * as inbox from "@/lib/inbox";
import { suggestReply } from "@/lib/ai";
import { withAi, AiLimitError } from "@/lib/usage";
import { rateLimit, LIMITS, clientIp } from "@/lib/ratelimit";

export type FormState = { error?: string; ok?: string } | undefined;
const ipOf = async () => clientIp(await headers());

/* ---------- auth ---------- */
export async function register(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`register:${await ipOf()}`, ...LIMITS.register).ok) return { error: await tr("অনেক বেশি অনুরোধ। একটু পরে আবার চেষ্টা করুন।") };
  const r = await svc.registerUser(Object.fromEntries(fd));
  if (r.error) return { error: r.error };
  await createSession(r.userId!);
  redirect("/");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const r = await svc.verifyLogin(String(fd.get("email") || ""), String(fd.get("password") || ""), await ipOf());
  if (r.error) return { error: r.error };
  const u = await db.user.findUnique({ where: { id: r.userId! } });
  if (u?.disabled) return { error: await tr("এই Account বন্ধ করা হয়েছে") };
  await createSession(r.userId!);
  const next = String(fd.get("next") || "");
  redirect(u && isStaff(u) ? "/admin" : next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function forgotPassword(_: FormState, fd: FormData): Promise<FormState> {
  if (rateLimit(`forgot-ip:${await ipOf()}`, ...LIMITS.forgotIp).ok) await svc.requestPasswordReset(String(fd.get("email") || ""));
  return { ok: await tr("এই Email-এ Account থাকলে Password নতুন করার Link পাঠানো হয়েছে। Inbox (আর Spam) দেখুন।") };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const r = await svc.resetPassword(String(fd.get("token") || ""), String(fd.get("password") || ""));
  if (r.error) return { error: r.error };
  await createSession(r.userId!);
  redirect("/");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  if (String(fd.get("password")) !== String(fd.get("confirm"))) return { error: await tr("দুটো নতুন Password মেলেনি") };
  const r = await svc.changePassword(uid, String(fd.get("current") || ""), String(fd.get("password") || ""));
  if (r.error) return { error: r.error };
  await createSession(uid);
  return { ok: await tr("Password বদলানো হয়েছে। অন্য সব Device থেকে Logout করা হয়েছে।") };
}

/* ---------- customers ---------- */
export async function addCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const r = await svc.addCustomer(shop, Object.fromEntries(fd));
  if (r.error) return { error: r.error };
  revalidatePath("/customers");
  return { ok: await tr("{name} যোগ হয়েছে", { name: r.name ?? "" }) };
}

export async function addOrder(customerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const r = await svc.addOrder(shop, customerId, Object.fromEntries(fd));
  if (r.error) return { error: r.error };
  revalidatePath(`/customers/${customerId}`);
  return { ok: await tr("Order যোগ হয়েছে") };
}

export async function deleteCustomer(customerId: string) {
  const { shop } = await requireShop();
  await db.customer.deleteMany({ where: { id: customerId, shopId: shop.id } });
  redirect("/customers");
}

/* ---------- campaigns ---------- */
export async function aiMessage(input: { segment: string; offer: string; channel: "text" | "voice" }) {
  const { shop } = await requireShop();
  return svc.writeMessage(shop, input);
}

export async function createCampaign(input: unknown) {
  const { shop } = await requireShop();
  const r = await svc.createCampaign(shop, input, after);
  revalidatePath("/");
  return r;
}

/* ---------- posts ---------- */
export async function aiPost(input: { prompt: string; tone: string }) {
  const { shop } = await requireShop();
  return svc.writePost(shop, input);
}

export async function schedulePost(input: { prompt: string; text: string; at: string }) {
  const { shop } = await requireShop();
  const r = await svc.schedulePost(shop, input);
  revalidatePath("/posts");
  return r.error ? { error: r.error } : { ok: true };
}

export async function cancelPost(id: string) {
  const { shop } = await requireShop();
  await db.post.updateMany({ where: { id, shopId: shop.id, status: "scheduled" }, data: { status: "draft" } });
  revalidatePath("/posts");
}

/* ---------- insights ---------- */
export async function dismissInsight(key: string) {
  const { shop } = await requireShop();
  const until = new Date(Date.now() + 3 * 86400000);
  await db.dismissedInsight.upsert({ where: { shopId_key: { shopId: shop.id, key } }, update: { until }, create: { shopId: shop.id, key, until } });
  revalidatePath("/");
  revalidatePath("/alerts");
}

export async function refreshTips() {
  const { shop } = await requireShop();
  await dailyTips(shop, { refresh: true });
  revalidatePath("/");
  revalidatePath("/alerts");
}

/* ---------- billing ---------- */
export async function buyPlan(fd: FormData) {
  const { shop, user } = await requireShop();
  const plan = String(fd.get("plan")) as PlanKey;
  const months = Math.min(12, Math.max(1, Number(fd.get("months") || 1)));
  if (!PLAN_KEYS.includes(plan) || plan === "free") redirect("/billing");
  const r = await startPayment(shop, user, plan, months);
  if (r.error) redirect(`/billing?status=error&msg=${encodeURIComponent(r.error)}`);
  redirect(r.url!);
}

/* ---------- support ---------- */
export async function openTicket(_: FormState, fd: FormData): Promise<FormState> {
  const { shop, user } = await requireShop();
  const subject = String(fd.get("subject") || "").trim();
  const body = String(fd.get("body") || "").trim();
  if (subject.length < 3 || body.length < 5) return { error: await tr("বিষয় আর বিস্তারিত লিখুন") };
  const t = await db.ticket.create({ data: { shopId: shop.id, subject, messages: { create: { authorId: user.id, body } } } });
  redirect(`/support/${t.id}`);
}

export async function replyTicket(ticketId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { shop, user } = await requireShop();
  const t = await db.ticket.findFirst({ where: { id: ticketId, shopId: shop.id } });
  if (!t) return { error: await tr("Ticket পাওয়া যায়নি") };
  const body = String(fd.get("body") || "").trim();
  if (body.length < 2) return { error: await tr("কিছু লিখুন") };
  await db.ticketMessage.create({ data: { ticketId, authorId: user.id, body } });
  await db.ticket.update({ where: { id: ticketId }, data: { status: "open" } });
  revalidatePath(`/support/${ticketId}`);
  return { ok: await tr("পাঠানো হয়েছে") };
}

/* ---------- settings ---------- */
const SECRET = ["waAccessToken", "smsApiKey", "twilioToken"] as const;
export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const keys = ["name", "waPhoneNumberId", "waAccessToken", "waTemplateName", "waTemplateLang", "smsApiUrl", "smsApiKey", "smsSenderId", "twilioSid", "twilioToken", "twilioFrom"] as const;
  const data: Record<string, string | null> = {};
  for (const k of keys) {
    if (!fd.has(k)) continue;
    const v = String(fd.get(k) ?? "").trim();
    // Secret fields show as blank; an empty submit keeps the stored value
    if ((SECRET as readonly string[]).includes(k)) { if (v) data[k] = encrypt(v); continue; }
    data[k] = v || null;
  }
  if (!data.name) delete data.name;
  if (fd.get("clear") === "1") for (const k of keys) if (k !== "name") data[k] = null;
  if (data.smsApiUrl && !/^https:\/\//.test(data.smsApiUrl)) return { error: await tr("SMS API URL https:// দিয়ে শুরু হতে হবে") };
  if (data.twilioFrom && !/^\+\d{8,15}$/.test(data.twilioFrom)) return { error: await tr("Twilio নম্বর +1… ফরম্যাটে দিন") };
  if (fd.has("country")) {
    const pr = await svc.updateProfile(shop, { country: fd.get("country"), currency: fd.get("currency"), timezone: fd.get("timezone"), language: fd.get("language") });
    if (pr.error) return { error: pr.error };
  }
  await db.shop.update({ where: { id: shop.id }, data });
  revalidatePath("/settings");
  return { ok: await tr("Save হয়েছে") };
}

/* ---------- facebook ---------- */
export async function choosePage(fd: FormData) {
  const { shop } = await requireShop();
  const pages = JSON.parse(decrypt(shop.fbPagesJson) || "[]") as { id: string; name: string; token: string }[];
  const p = pages.find((x) => x.id === fd.get("page"));
  if (p) await db.shop.update({ where: { id: shop.id }, data: { fbPageId: p.id, fbPageName: p.name, fbPageToken: encrypt(p.token) } });
  revalidatePath("/settings");
}
export async function disconnectFacebook() {
  const { shop } = await requireShop();
  await db.shop.update({ where: { id: shop.id }, data: { fbPageId: null, fbPageName: null, fbPageToken: null, fbPagesJson: null } });
  revalidatePath("/settings");
}

/* ---------- online store ---------- */
export async function connectStore(_: FormState, fd: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const type = String(fd.get("storeType"));
  const url = String(fd.get("storeUrl") || "").trim().replace(/\/$/, "");
  const key = String(fd.get("storeKey") || "").trim();
  const secret = String(fd.get("storeSecret") || "").trim();
  if (!["shopify", "woocommerce"].includes(type)) return { error: await tr("Store-এর ধরন বাছুন") };
  if (type === "woocommerce" && (!/^https:\/\//.test(url) || !key || !secret)) return { error: await tr("https:// দিয়ে Store URL, Consumer Key আর Secret দিন") };
  if (type === "shopify" && (!/\.myshopify\.com/.test(url) || !key)) return { error: await tr("your-store.myshopify.com আর Admin API Access Token দিন") };
  const updated = await db.shop.update({
    where: { id: shop.id },
    data: { storeType: type, storeUrl: url, storeKey: encrypt(key), storeSecret: encrypt(secret || null), storeSyncedAt: null, storeError: null },
  });
  try {
    const r = await syncStore(updated);
    revalidatePath("/customers");
    return { ok: await tr("Connect হয়েছে। {a} জন নতুন Customer, {b}টি Order এসেছে। এখন থেকে প্রতি ৩ ঘণ্টায় নিজে থেকে Sync হবে।", { a: r.customers, b: r.orders }) };
  } catch (e) {
    await db.shop.update({ where: { id: shop.id }, data: { storeType: null, storeUrl: null, storeKey: null, storeSecret: null, storeError: null } });
    return { error: await tr("Connect হয়নি: {e}. URL আর Key ঠিক আছে কিনা দেখুন।", { e: (e as Error).message }) };
  }
}
export async function syncStoreNow(): Promise<FormState> {
  const { shop } = await requireShop();
  try {
    const r = await syncStore(shop);
    revalidatePath("/customers");
    return { ok: await tr("{a} জন নতুন Customer, {b}টি নতুন Order", { a: r.customers, b: r.orders }) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
export async function disconnectStore() {
  const { shop } = await requireShop();
  await db.shop.update({ where: { id: shop.id }, data: { storeType: null, storeUrl: null, storeKey: null, storeSecret: null, storeSyncedAt: null, storeError: null } });
  revalidatePath("/settings");
}

/* ---------- opt-out ---------- */
export async function setOptOut(customerId: string, optedOut: boolean) {
  const { shop } = await requireShop();
  await db.customer.updateMany({ where: { id: customerId, shopId: shop.id }, data: { optedOut } });
  revalidatePath(`/customers/${customerId}`);
}

/* ---------- language ---------- */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  const uid = await currentUserId();
  if (uid) await db.user.update({ where: { id: uid }, data: { uiLang: lang } });
  revalidatePath("/", "layout");
}

/* ---------- AI knowledge base ---------- */
export async function saveKnowledge(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const r = await svc.saveKnowledge(shop, { type: fd.get("type") || "note", title: fd.get("title"), body: fd.get("body") || "", price: fd.get("price") || null, active: fd.get("active") !== "0" }, id ?? undefined);
  if (r.error) return { error: r.error };
  revalidatePath("/knowledge");
  return { ok: await tr("Save হয়েছে। AI এখন থেকে এটা মাথায় রাখবে।") };
}
export async function deleteKnowledge(id: string) {
  const { shop } = await requireShop();
  await svc.deleteKnowledge(shop, id);
  revalidatePath("/knowledge");
}
export async function toggleKnowledge(id: string, active: boolean) {
  const { shop } = await requireShop();
  await db.knowledgeItem.updateMany({ where: { id, shopId: shop.id }, data: { active } });
  revalidatePath("/knowledge");
}
export async function saveBrandVoice(_: FormState, fd: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const r = await svc.updateProfile(shop, { brandVoice: String(fd.get("brandVoice") ?? "") });
  if (r.error) return { error: r.error };
  revalidatePath("/knowledge");
  return { ok: await tr("Save হয়েছে") };
}

/* ---------- inbox ---------- */
export async function sendChat(customerId: string, text: string, channel: "wa" | "sms" = "wa") {
  const { shop, user } = await requireShop();
  const r = await inbox.sendChat(shop, customerId, text, { channel, authorId: user.id });
  revalidatePath(`/inbox/${customerId}`);
  return "error" in r ? { error: await tr(r.error) } : { ok: true, status: r.status, kind: r.kind };
}
export async function suggestChatReply(customerId: string): Promise<{ text?: string; error?: string }> {
  const { shop } = await requireShop();
  try { return { text: await withAi(shop, "reply", () => suggestReply(shop, customerId)) }; }
  catch (e) { return { error: await tr(e instanceof AiLimitError ? e.message : "AI উত্তর লিখতে পারেনি") }; }
}
export async function logCall(customerId: string, how: "phone" | "whatsapp") {
  const { shop, user } = await requireShop();
  const c = await db.customer.findFirst({ where: { id: customerId, shopId: shop.id } });
  if (!c) return;
  await inbox.logChat(shop.id, customerId, { channel: how === "phone" ? "call" : "wa", kind: "call", body: how === "phone" ? "📞 Phone call" : "📞 WhatsApp call", authorId: user.id });
}

/* ---------- account deletion ---------- */
export async function deleteMyAccount(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireShop();
  if (String(fd.get("confirm") || "").trim().toUpperCase() !== "DELETE") return { error: await tr('নিশ্চিত করতে DELETE লিখুন') };
  const r = await svc.deleteAccount(user.id, String(fd.get("password") || ""));
  if (r.error) return { error: r.error };
  await destroySession();
  redirect("/delete-account?done=1");
}
