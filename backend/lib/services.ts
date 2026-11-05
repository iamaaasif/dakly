import "server-only";
import bcrypt from "bcryptjs";
import type { Shop } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { normalizePhone, toAsciiDigits, countryDefaults, isLang, DEFAULT_COUNTRY, COUNTRIES, translator } from "./i18n";
import { writeCampaignMessage, writeFacebookPost, aiEnabled } from "./ai";
import { withAi, AiLimitError } from "./usage";
import { queueCampaign, processQueue, audience, usedThisMonth } from "./send";
import { messageLimit, activePlan, FREE_CUSTOMER_CAP, voiceAllowed } from "./plans";
import { signupOpen } from "./config";
import { kbSchema, KB_TYPES } from "./knowledge";
import { audit } from "./audit";
import { tr } from "./i18n/server";
import crypto from "node:crypto";
import { welcomeEmail, newMerchantForAdmins, resetEmail, passwordChangedEmail } from "./emails";
import { appUrl } from "./config";
import { signOutEverywhere } from "./auth";
import { rateLimit, LIMITS } from "./ratelimit";

type R<T> = ({ error: string; code?: string } & Partial<Record<keyof T, never>>) | (T & { error?: undefined });
const money = (v: unknown) => { const n = Number(toAsciiDigits(String(v ?? "")).replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };

/* ---------- auth ---------- */
/** New shop with country defaults (currency, time zone, language). Bangladesh when not given. */
function shopLocale(name: string, countryIn?: string, languageIn?: string) {
  const country = countryIn && /^[A-Z]{2}$/.test(countryIn) ? countryIn : DEFAULT_COUNTRY;
  const d = countryDefaults(country);
  return {
    name, approved: process.env.SIGNUP_APPROVAL !== "manual", country,
    currency: COUNTRIES[country] ? d.currency : "USD", timezone: COUNTRIES[country] ? d.tz : "UTC",
    language: isLang(languageIn) ? languageIn : d.lang,
  };
}
export const registerSchema = z.object({
  name: z.string().trim().min(2, "আপনার নাম লিখুন"),
  shop: z.string().trim().min(2, "দোকানের নাম লিখুন"),
  email: z.string().trim().toLowerCase().email("সঠিক Email দিন"),
  password: z.string().min(8, "Password কমপক্ষে ৮ অক্ষর"),
  country: z.string().trim().toUpperCase().length(2).optional().catch(undefined),
  language: z.string().optional(),
});
export async function registerUser(input: unknown): Promise<R<{ userId: string }>> {
  if (!signupOpen()) return { error: await tr("নতুন Account খোলা এখন বন্ধ আছে") };
  const p = registerSchema.safeParse(input);
  if (!p.success) return { error: await tr(p.error.issues[0].message) };
  if (await db.user.findUnique({ where: { email: p.data.email } })) return { error: await tr("এই Email দিয়ে আগেই Account আছে। Login করুন।") };
  const user = await db.user.create({ data: { email: p.data.email, name: p.data.name, passwordHash: await bcrypt.hash(p.data.password, 10), shop: { create: shopLocale(p.data.shop, p.data.country, p.data.language) } }, include: { shop: true } });
  const pending = !user.shop!.approved;
  // Emails go out in the background so a slow mail server never slows sign-up
  void welcomeEmail(user, pending).then(() => newMerchantForAdmins(user.shop!.name, user.email, user.shop!.country, pending)).catch(() => undefined);
  await audit(null, "merchant.signup", user.shop!.name, `${user.email} ${user.shop!.country}${pending ? " (pending)" : ""}`);
  return { userId: user.id };
}

export async function verifyLogin(emailRaw: string, password: string, ip: string): Promise<R<{ userId: string }>> {
  const email = emailRaw.trim().toLowerCase();
  const since = new Date(Date.now() - 15 * 60000);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { key: `e:${email}`, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { key: `i:${ip}`, createdAt: { gte: since } } }),
  ]);
  if (byEmail >= 8 || byIp >= 30) return { error: await tr("অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।"), code: "rate_limited" };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await db.loginAttempt.createMany({ data: [{ key: `e:${email}` }, { key: `i:${ip}` }] });
    await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400000) } } });
    return { error: await tr("Email বা Password মেলেনি") };
  }
  await db.loginAttempt.deleteMany({ where: { key: `e:${email}` } });
  return { userId: user.id };
}

/* ---------- passwords ---------- */
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Creates a reset link and emails it. Silent for unknown addresses (does not reveal accounts). */
export async function requestPasswordReset(emailRaw: string, hours = 1) {
  const email = emailRaw.trim().toLowerCase();
  if (!rateLimit(`forgot:${email}`, ...LIMITS.forgotEmail).ok) return;
  const user = await db.user.findUnique({ where: { email }, include: { shop: true } });
  if (!user || user.disabled) return;
  const token = crypto.randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + hours * 3600000) } });
  await resetEmail(user, `${appUrl()}/reset?token=${token}`, hours);
}

/** Uses a reset link: sets the password, signs out every device, and returns the user to sign in. */
export async function resetPassword(token: string, password: string): Promise<R<{ userId: string }>> {
  if (password.length < 8) return { error: await tr("Password কমপক্ষে ৮ অক্ষর") };
  const r = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { shop: true } } } });
  if (!r || r.usedAt || r.expiresAt < new Date()) return { error: await tr("Link-টা আর কাজ করছে না। আবার নতুন Link চান।") };
  await db.$transaction([
    db.user.update({ where: { id: r.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
    db.passwordReset.updateMany({ where: { userId: r.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await signOutEverywhere(r.userId);
  await db.loginAttempt.deleteMany({ where: { key: `e:${r.user.email}` } });
  void passwordChangedEmail(r.user);
  await audit(null, "user.password-reset", r.user.email);
  return { userId: r.userId };
}

/** Change password while signed in. Other devices are signed out. */
export async function changePassword(userId: string, current: string, password: string): Promise<R<{ userId: string }>> {
  if (password.length < 8) return { error: await tr("Password কমপক্ষে ৮ অক্ষর") };
  const u = await db.user.findUnique({ where: { id: userId }, include: { shop: true } });
  if (!u || !(await bcrypt.compare(current, u.passwordHash))) return { error: await tr("এখনকার Password মেলেনি") };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await signOutEverywhere(userId);
  void passwordChangedEmail(u);
  return { userId };
}

/* ---------- customers ---------- */
export async function customerCapReached(shop: Shop, adding = 1) {
  if (activePlan(shop) !== "free") return false;
  return (await db.customer.count({ where: { shopId: shop.id } })) + adding > FREE_CUSTOMER_CAP;
}

export async function addCustomer(shop: Shop, input: { name?: unknown; phone?: unknown; amount?: unknown; items?: unknown; area?: unknown; source?: unknown }): Promise<R<{ id: string; name: string }>> {
  const name = String(input.name ?? "").trim();
  const phone = normalizePhone(String(input.phone ?? ""), shop.country);
  if (name.length < 2) return { error: await tr("নাম লিখুন") };
  if (!phone) return { error: await tr("সঠিক মোবাইল নম্বর দিন") };
  const existing = await db.customer.findUnique({ where: { shopId_phone: { shopId: shop.id, phone } } });
  if (!existing && (await customerCapReached(shop))) return { error: await tr("Free Plan-এ {n} জন পর্যন্ত Customer রাখা যায়। Plan Upgrade করুন।", { n: FREE_CUSTOMER_CAP }) };
  const source = ["manual", "voice", "excel"].includes(String(input.source)) ? String(input.source) : "manual";
  const c = existing
    ? await db.customer.update({ where: { id: existing.id }, data: { name } })
    : await db.customer.create({ data: { shopId: shop.id, name, phone, area: String(input.area ?? "").trim() || null, source } });
  const amount = money(input.amount);
  if (amount) await db.order.create({ data: { customerId: c.id, amount, items: String(input.items ?? "").trim() || null } });
  return { id: c.id, name };
}

export async function addOrder(shop: Shop, customerId: string, input: { amount?: unknown; items?: unknown }): Promise<R<{ id: string }>> {
  const c = await db.customer.findFirst({ where: { id: customerId, shopId: shop.id } });
  if (!c) return { error: await tr("Customer পাওয়া যায়নি"), code: "not_found" };
  const amount = money(input.amount);
  if (!amount) return { error: await tr("টাকার পরিমাণ লিখুন") };
  const o = await db.order.create({ data: { customerId, amount, items: String(input.items ?? "").trim() || null } });
  return { id: o.id };
}

/* ---------- AI writing ---------- */
export async function writeMessage(shop: Shop, input: { segment: string; offer: string; channel: "text" | "voice" }): Promise<R<{ text: string; ai: boolean }>> {
  try {
    if (!aiEnabled()) return { text: await writeCampaignMessage(shop, input), ai: false };
    return { text: await withAi(shop, "message", () => writeCampaignMessage(shop, input)), ai: true };
  } catch (e) {
    return e instanceof AiLimitError ? { error: await tr(e.message), code: "limit_reached" } : { error: await tr("AI লিখতে পারেনি: {e}", { e: (e as Error).message }), code: "ai_error" };
  }
}

export async function writePost(shop: Shop, input: { prompt: string; tone: string }): Promise<R<{ text: string; ai: boolean }>> {
  try {
    if (!aiEnabled()) return { text: await writeFacebookPost(shop, input), ai: false };
    return { text: await withAi(shop, "post", () => writeFacebookPost(shop, input)), ai: true };
  } catch (e) {
    return e instanceof AiLimitError ? { error: await tr(e.message), code: "limit_reached" } : { error: await tr("AI লিখতে পারেনি: {e}", { e: (e as Error).message }), code: "ai_error" };
  }
}

/* ---------- campaigns ---------- */
export const campaignSchema = z.object({
  name: z.string().default(""),
  segment: z.enum(["vip", "regular", "new", "inactive", "all"]),
  message: z.string().min(5, "Message লিখুন").max(1000),
  channels: z.array(z.enum(["wa", "sms", "voice"])).min(1, "অন্তত একটা Channel বাছুন"),
  when: z.enum(["now", "later"]).default("now"),
  sendAt: z.string().optional(),
});
export async function createCampaign(shop: Shop, input: unknown, after?: (fn: () => Promise<void>) => void): Promise<R<{ id: string }>> {
  const p = campaignSchema.safeParse(input);
  if (!p.success) return { error: await tr(p.error.issues[0].message) };
  const d = p.data;
  if (d.channels.includes("voice") && !voiceAllowed(shop)) return { error: await tr("AI Voice Call শুধু Growth Plan-এ পাওয়া যায়") };
  const sendAt = d.when === "later" && d.sendAt ? new Date(d.sendAt) : null;
  if (d.when === "later" && (!sendAt || Number.isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() - 60000)) return { error: await tr("ভবিষ্যতের একটা সময় বাছুন") };
  const left = messageLimit(shop) - (await usedThisMonth(shop.id));
  const n = (await audience(shop.id, d.segment)).length;
  if (!n) return { error: await tr("এই দলে কোনো Customer নেই") };
  if (n > left) return { error: await tr("এই মাসে আর {a}টি Message পাঠাতে পারবেন, কিন্তু এই দলে {b} জন আছেন। ছোট দল বাছুন বা Plan Upgrade করুন।", { a: Math.max(0, left), b: n }) };
  const c = await db.campaign.create({
    data: { shopId: shop.id, name: d.name.trim() || translator(isLang(shop.language) ? shop.language : "bn")("নতুন Campaign"), segment: d.segment, message: d.message.trim(), channels: d.channels, status: sendAt ? "scheduled" : "draft", sendAt },
  });
  if (!sendAt) {
    await queueCampaign(c.id);
    const drain = async () => { while ((await processQueue()) > 0) { /* keep draining */ } };
    if (after) after(drain); else void drain();
  }
  return { id: c.id };
}

/* ---------- posts ---------- */
export async function schedulePost(shop: Shop, input: { prompt?: string; text?: string; at?: string }): Promise<R<{ id: string }>> {
  const at = new Date(String(input.at ?? ""));
  if (Number.isNaN(at.getTime())) return { error: await tr("সময় বাছুন") };
  if (at.getTime() < Date.now() - 60000) return { error: await tr("ভবিষ্যতের সময় বাছুন") };
  const text = String(input.text ?? "").trim();
  if (text.length < 5) return { error: await tr("Post লিখুন") };
  const p = await db.post.create({ data: { shopId: shop.id, prompt: String(input.prompt ?? ""), text, status: "scheduled", scheduledAt: at } });
  return { id: p.id };
}

/* ---------- shop profile (country, currency, time zone, languages) ---------- */
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  timezone: z.string().trim().optional(),
  language: z.string().optional(),
  brandVoice: z.string().max(1500).nullable().optional(),
  waCallNumber: z.string().max(40).nullable().optional(),
  waCallInSms: z.boolean().optional(),
});
export async function updateProfile(shop: Shop, input: unknown): Promise<R<{ shop: Shop }>> {
  const p = profileSchema.safeParse(input);
  if (!p.success) return { error: await tr("তথ্য ঠিক নেই: {f}", { f: String(p.error.issues[0].path[0] ?? "") }) };
  const d = p.data;
  if (d.timezone) { try { new Intl.DateTimeFormat("en", { timeZone: d.timezone }); } catch { return { error: await tr("Time zone ঠিক নেই") }; } }
  if (d.currency) { try { new Intl.NumberFormat("en", { style: "currency", currency: d.currency }); } catch { return { error: await tr("মুদ্রা ঠিক নেই") }; } }
  if (d.language !== undefined && !isLang(d.language)) return { error: await tr("ভাষা ঠিক নেই") };
  const data: Record<string, string | boolean | null> = {};
  for (const k of ["name", "country", "currency", "timezone", "language"] as const) if (d[k]) data[k] = d[k]!;
  if (d.brandVoice !== undefined) data.brandVoice = d.brandVoice?.trim() || null;
  if (d.waCallNumber !== undefined) {
    const raw = d.waCallNumber?.trim() || "";
    const n = raw ? normalizePhone(raw, d.country || shop.country) : null;
    if (raw && !n) return { error: await tr("WhatsApp নম্বর ঠিক নেই") };
    data.waCallNumber = n;
  }
  if (d.waCallInSms !== undefined) data.waCallInSms = d.waCallInSms;
  // Changing country alone moves currency and time zone to that country's defaults
  if (d.country && d.country !== shop.country && COUNTRIES[d.country]) {
    if (!d.currency || d.currency === shop.currency) data.currency = COUNTRIES[d.country].currency;
    if (!d.timezone || d.timezone === shop.timezone) data.timezone = COUNTRIES[d.country].tz;
  }
  return { shop: await db.shop.update({ where: { id: shop.id }, data }) };
}

/* ---------- knowledge base ---------- */
export async function saveKnowledge(shop: Shop, input: unknown, id?: string): Promise<R<{ id: string }>> {
  const p = kbSchema.safeParse(input);
  if (!p.success) return { error: await tr(p.error.issues[0].message) };
  if (id) {
    const done = await db.knowledgeItem.updateMany({ where: { id, shopId: shop.id }, data: p.data });
    if (!done.count) return { error: await tr("পাওয়া যায়নি") };
    return { id };
  }
  if ((await db.knowledgeItem.count({ where: { shopId: shop.id } })) >= 1000) return { error: await tr("সর্বোচ্চ ১০০০টি তথ্য রাখা যায়") };
  const k = await db.knowledgeItem.create({ data: { ...p.data, shopId: shop.id } });
  return { id: k.id };
}
export async function deleteKnowledge(shop: Shop, id: string) {
  return (await db.knowledgeItem.deleteMany({ where: { id, shopId: shop.id } })).count > 0;
}
export async function listKnowledge(shopId: string, q?: string, type?: string) {
  return db.knowledgeItem.findMany({
    where: { shopId, ...(type && (KB_TYPES as readonly string[]).includes(type) ? { type } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
  });
}

/* ---------- account deletion ---------- */
/**
 * Permanently deletes the merchant's account: the shop and everything in it (customers, orders,
 * campaigns, messages, posts, knowledge, payments history) and the login. Staff accounts cannot be deleted here.
 */
export async function deleteAccount(userId: string, password: string): Promise<R<{ deleted: true }>> {
  const u = await db.user.findUnique({ where: { id: userId }, include: { shop: true } });
  if (!u) return { error: await tr("Account পাওয়া যায়নি") };
  if (u.role !== "merchant") return { error: await tr("Staff Account এখান থেকে মোছা যায় না") };
  if (!(await bcrypt.compare(password, u.passwordHash))) return { error: await tr("Password মেলেনি") };
  await db.$transaction(async (tx) => {
    if (u.shop) await tx.shop.delete({ where: { id: u.shop.id } });
    await tx.ticketMessage.deleteMany({ where: { authorId: u.id } });
    await tx.passwordReset.deleteMany({ where: { userId: u.id } });
    await tx.user.delete({ where: { id: u.id } });
  });
  await audit(null, "account.deleted", u.shop?.id ?? u.id, `${u.email} deleted their account`);
  return { deleted: true };
}
