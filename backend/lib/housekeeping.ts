import "server-only";
import { db } from "./db";
import { setState } from "./audit";
import { planEndingEmail, limitWarningEmail } from "./emails";
import { messageLimit } from "./plans";
import { usedThisMonth } from "./send";
import { monthStart } from "./usage";

/** Runs at most once an hour from the scheduler: plan reminders, limit warnings, old data cleanup. */
export async function dailyHousekeeping(force = false) {
  const last = await db.systemState.findUnique({ where: { key: "housekeeping.last" } });
  if (!force && last && Date.now() - new Date(last.value).getTime() < 3600000) return null;
  await setState("housekeeping.last", new Date().toISOString());
  const now = Date.now(), day = 86400000;
  const once = async (key: string) => {
    try { await db.systemState.create({ data: { key, value: new Date().toISOString() } }); return true; } catch { return false; }
  };
  let reminders = 0;

  // Plan ends in 3 days or less, and plan just ended
  const ending = await db.shop.findMany({ where: { plan: { not: "free" }, planUntil: { gte: new Date(now - 2 * day), lte: new Date(now + 3 * day) } }, include: { owner: true } });
  for (const s of ending) {
    const ended = s.planUntil!.getTime() < now;
    if (await once(`remind:${ended ? "ended" : "ending"}:${s.id}:${s.planUntil!.toISOString().slice(0, 10)}`)) {
      await planEndingEmail({ ...s.owner, shop: s }, s.plan, s.planUntil!, ended);
      reminders++;
    }
  }

  // 80% of this month's messages used
  const month = new Date().toISOString().slice(0, 7);
  const active = await db.campaign.findMany({ where: { createdAt: { gte: monthStart() } }, distinct: ["shopId"], select: { shopId: true } });
  for (const { shopId } of active) {
    const s = await db.shop.findUnique({ where: { id: shopId }, include: { owner: true } });
    if (!s) continue;
    const limit = messageLimit(s), used = await usedThisMonth(s.id);
    if (limit > 0 && used >= limit * 0.8 && (await once(`remind:limit:${s.id}:${month}`))) { await limitWarningEmail({ ...s.owner, shop: s }, used, limit); reminders++; }
  }

  // Cleanup
  const [tokens, attempts, resets, errors, payments] = await Promise.all([
    db.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now - day) } } }),
    db.passwordReset.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * day) } } }),
    db.errorLog.deleteMany({ where: { createdAt: { lt: new Date(now - 30 * day) } } }),
    db.payment.updateMany({ where: { status: "pending", createdAt: { lt: new Date(now - day) } }, data: { status: "failed", note: "abandoned (not paid within 24h)" } }),
  ]);
  await db.systemState.deleteMany({ where: { key: { startsWith: "handoff:" }, updatedAt: { lt: new Date(now - day) } } });
  return { reminders, cleaned: tokens.count + attempts.count + resets.count + errors.count, abandonedPayments: payments.count };
}
