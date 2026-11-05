"use server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, signOutEverywhere } from "@/lib/auth";
import { resetEmail } from "@/lib/emails";
import { audit } from "@/lib/audit";
import { extendPlan } from "@/lib/billing";
import { PLAN_KEYS, PLANS, priceFor, type PlanKey } from "@/lib/plans";
import { sendMail } from "@/lib/mail";
import { appUrl } from "@/lib/config";
import { tick } from "@/lib/send";

type Perm = "manageMerchants" | "billing" | "support" | "announcements" | "staff" | "system";
async function staff(perm: Perm) {
  const me = await requireAdmin();
  if (!me.perms[perm]) throw new Error("আপনার এই কাজের অনুমতি নেই");
  return me;
}
export type AState = { error?: string; ok?: string } | undefined;

/* merchants */
export async function approveShop(shopId: string) {
  const me = await staff("manageMerchants");
  const s = await db.shop.update({ where: { id: shopId }, data: { approved: true }, include: { owner: true } });
  await audit(me, "merchant.approve", s.name);
  try { await sendMail(s.owner.email, "আপনার Dakly Account চালু হয়েছে", `আসসালামু আলাইকুম ${s.owner.name},\n\n${s.name}-এর Dakly Account চালু হয়েছে। Login করুন: ${appUrl()}/login\n\nDakly টিম`); } catch { /* logged by sendMail caller */ }
  revalidatePath(`/admin/merchants/${shopId}`);
}

export async function suspendShop(shopId: string, fd: FormData) {
  const me = await staff("manageMerchants");
  const reason = String(fd.get("reason") || "").trim() || null;
  const s = await db.shop.update({ where: { id: shopId }, data: { suspended: true, suspendedReason: reason } });
  // Stop anything still waiting to go out
  await db.campaign.updateMany({ where: { shopId, status: { in: ["scheduled", "sending"] } }, data: { status: "sent" } });
  await db.campaignMessage.updateMany({ where: { campaign: { shopId }, status: "queued" }, data: { status: "skipped", error: "Account স্থগিত" } });
  await audit(me, "merchant.suspend", s.name, reason ?? undefined);
  revalidatePath(`/admin/merchants/${shopId}`);
}

export async function unsuspendShop(shopId: string) {
  const me = await staff("manageMerchants");
  const s = await db.shop.update({ where: { id: shopId }, data: { suspended: false, suspendedReason: null } });
  await audit(me, "merchant.unsuspend", s.name);
  revalidatePath(`/admin/merchants/${shopId}`);
}

export async function setPlan(shopId: string, _: AState, fd: FormData): Promise<AState> {
  const me = await staff("billing");
  const plan = String(fd.get("plan")) as PlanKey;
  if (!PLAN_KEYS.includes(plan)) return { error: "Plan বাছুন" };
  const months = Math.max(0, Math.min(24, Number(fd.get("months") || 0)));
  const record = fd.get("record") === "1";
  const amount = Math.max(0, Number(fd.get("amount") || 0));
  const s = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  if (plan === "free") await db.shop.update({ where: { id: shopId }, data: { plan: "free", planUntil: null } });
  else {
    if (!months) return { error: "কত মাস দেবেন লিখুন" };
    await extendPlan(shopId, plan, months);
    if (record) await db.payment.create({ data: { shopId, plan, months, amount: amount || priceFor(plan, s.currency).amount * months, currency: priceFor(plan, s.currency).currency, provider: "manual", tranId: "MAN" + crypto.randomBytes(5).toString("hex").toUpperCase(), status: "manual", paidAt: new Date(), note: String(fd.get("note") || "") || `by ${me.email}` } });
  }
  await audit(me, "merchant.plan", s.name, `${plan} ${months ? `+${months}m` : ""}${record ? ` paid ৳${amount}` : ""}`);
  revalidatePath(`/admin/merchants/${shopId}`);
  return { ok: "Plan বদলানো হয়েছে" };
}

export async function setLimit(shopId: string, _: AState, fd: FormData): Promise<AState> {
  const me = await staff("billing");
  const raw = String(fd.get("limit") || "").trim();
  const limitOverride = raw === "" ? null : Math.max(0, Number(raw));
  if (limitOverride !== null && !Number.isFinite(limitOverride)) return { error: "সংখ্যা দিন" };
  const s = await db.shop.update({ where: { id: shopId }, data: { limitOverride } });
  await audit(me, "merchant.limit", s.name, limitOverride === null ? "plan default" : String(limitOverride));
  revalidatePath(`/admin/merchants/${shopId}`);
  return { ok: "Save হয়েছে" };
}

export async function toggleUserLogin(userId: string) {
  const me = await staff("manageMerchants");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.id === me.id) return;
  await db.user.update({ where: { id: userId }, data: { disabled: !u.disabled } });
  if (!u.disabled) await signOutEverywhere(userId);
  await audit(me, u.disabled ? "user.enable" : "user.disable", u.email);
  revalidatePath("/admin");
}

export async function sendResetLink(userId: string) {
  const me = await staff("support");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { shop: true } });
  const token = crypto.randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: u.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 24 * 3600000) } });
  await resetEmail(u, `${appUrl()}/reset?token=${token}`, 24);
  await audit(me, "user.reset-link", u.email);
}

/* tickets */
export async function staffReply(ticketId: string, _: AState, fd: FormData): Promise<AState> {
  const me = await staff("support");
  const body = String(fd.get("body") || "").trim();
  const status = String(fd.get("status") || "waiting");
  if (body) await db.ticketMessage.create({ data: { ticketId, authorId: me.id, body, fromStaff: true } });
  const t = await db.ticket.update({ where: { id: ticketId }, data: { status: ["open", "waiting", "closed"].includes(status) ? status : "waiting", assignee: me.id, priority: String(fd.get("priority") || "normal") }, include: { shop: { include: { owner: true } } } });
  if (body) { try { await sendMail(t.shop.owner.email, `Re: ${t.subject}`, `${body}\n\nউত্তর দিতে: ${appUrl()}/support/${t.id}\n\nDakly টিম`); } catch { /* optional */ } }
  await audit(me, "ticket.reply", t.subject, status);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { ok: "Save হয়েছে" };
}

/* announcements */
export async function createAnnouncement(_: AState, fd: FormData): Promise<AState> {
  const me = await staff("announcements");
  const title = String(fd.get("title") || "").trim(), body = String(fd.get("body") || "").trim();
  if (!title || !body) return { error: "শিরোনাম আর লেখা দিন" };
  const endsAt = fd.get("endsAt") ? new Date(String(fd.get("endsAt"))) : null;
  await db.announcement.create({ data: { title, body, tone: fd.get("tone") === "warning" ? "warning" : "info", audience: ["all", "free", "paid"].includes(String(fd.get("audience"))) ? String(fd.get("audience")) : "all", endsAt } });
  await audit(me, "announcement.create", title);
  revalidatePath("/admin/announcements");
  return { ok: "প্রকাশ হয়েছে। সব Merchant-এর হোমে দেখাবে।" };
}
export async function toggleAnnouncement(id: string) {
  const me = await staff("announcements");
  const a = await db.announcement.findUniqueOrThrow({ where: { id } });
  await db.announcement.update({ where: { id }, data: { active: !a.active } });
  await audit(me, a.active ? "announcement.hide" : "announcement.show", a.title);
  revalidatePath("/admin/announcements");
}

/* staff */
export async function addStaff(_: AState, fd: FormData): Promise<AState> {
  const me = await staff("staff");
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const name = String(fd.get("name") || "").trim();
  const role = String(fd.get("role"));
  if (!email.includes("@") || !name || !["admin", "support", "billing"].includes(role)) return { error: "নাম, Email আর Role দিন" };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "merchant") return { error: "এই Email একটা Merchant Account। Staff-এর জন্য আলাদা Email দিন।" };
    await db.user.update({ where: { id: existing.id }, data: { role, disabled: false } });
  } else {
    const temp = crypto.randomBytes(9).toString("base64url");
    const u = await db.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(temp, 10) } });
    const token = crypto.randomBytes(32).toString("base64url");
    await db.passwordReset.create({ data: { userId: u.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 72 * 3600000) } });
    await sendMail(email, "Dakly Back Office-এ আপনাকে যোগ করা হয়েছে", `আসসালামু আলাইকুম ${name},\n\nPassword ঠিক করে Login করুন (৩ দিন কাজ করবে):\n${appUrl()}/reset?token=${token}\n\nতারপর: ${appUrl()}/admin`);
  }
  await audit(me, "staff.add", email, role);
  revalidatePath("/admin/staff");
  return { ok: `${email} যোগ হয়েছে। Password ঠিক করার Link Email-এ গেছে।` };
}
export async function setStaffRole(userId: string, fd: FormData) {
  const me = await staff("staff");
  if (userId === me.id) return;
  const role = String(fd.get("role"));
  const u = await db.user.update({ where: { id: userId }, data: role === "remove" ? { disabled: true } : { role, disabled: false } });
  await audit(me, "staff.role", u.email, role);
  revalidatePath("/admin/staff");
}

export async function deleteShop(shopId: string, fd: FormData) {
  const me = await staff("manageMerchants");
  const s = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { owner: true } });
  if (String(fd.get("confirm") || "").trim() !== s.name) throw new Error("দোকানের নাম হুবহু লিখুন");
  await db.$transaction(async (tx) => {
    await tx.shop.delete({ where: { id: shopId } });
    if (s.owner.role === "merchant") {
      await tx.ticketMessage.deleteMany({ where: { authorId: s.ownerId } });
      await tx.user.delete({ where: { id: s.ownerId } });
    }
  });
  await audit(me, "merchant.delete", s.name, s.owner.email);
  redirect("/admin/merchants");
}

/* system */
export async function runSchedulerNow() {
  const me = await staff("system");
  const r = await tick();
  await audit(me, "system.tick", undefined, JSON.stringify(r));
  revalidatePath("/admin/system");
}
export async function runSelfCheckNow() {
  const me = await staff("system");
  const { runSelfCheck } = await import("@/lib/selfcheck-store");
  await runSelfCheck();
  await audit(me, "system.self-check");
  revalidatePath("/admin/system");
}
export async function sendTestEmail() {
  const me = await staff("system");
  const ok = await sendMail(me.email, "Dakly test email", `This is a test email from ${appUrl()}.\n\nIf you can read it, email works.`);
  await audit(me, "system.test-email", me.email, ok ? "sent" : "failed");
  redirect(`/admin/system?mail=${ok ? "ok" : "fail"}`);
}
export async function clearErrors() {
  const me = await staff("system");
  await db.errorLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 3600000) } } });
  await audit(me, "system.clear-errors");
  redirect("/admin/system");
}
