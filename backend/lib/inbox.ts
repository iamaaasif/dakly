import "server-only";
import type { Shop } from "@prisma/client";
import { db } from "./db";
import { channelConfig } from "./config";
import { sendWhatsApp, sendWhatsAppText, markWhatsAppRead } from "./channels/whatsapp";
import { sendSms } from "./channels/sms";
import { messageLimit } from "./plans";
import { usedThisMonth } from "./send";
import { logError } from "./audit";
import { normalizePhone } from "./i18n";

export const WINDOW_MS = 24 * 3600000;
export const windowOpen = (c: { lastInboundAt: Date | null }) => !!c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < WINDOW_MS;

/** Conversations, newest first. Cursor = ISO time of the last message of the previous page. */
export async function conversations(shopId: string, opts: { q?: string; before?: string; limit?: number; unread?: boolean } = {}) {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
  const before = opts.before ? new Date(opts.before) : null;
  const last = await db.chatMessage.groupBy({
    by: ["customerId"], where: { shopId }, _max: { createdAt: true },
    ...(before ? { having: { createdAt: { _max: { lt: before } } } } : {}),
    orderBy: { _max: { createdAt: "desc" } }, take: 500,
  });
  const ids = last.map((l) => l.customerId);
  const [customers, unread, lastMsgs] = await Promise.all([
    db.customer.findMany({ where: { id: { in: ids }, ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" } }, { phone: { contains: opts.q.replace(/\D/g, "") || "~" } }] } : {}) } }),
    db.chatMessage.groupBy({ by: ["customerId"], where: { shopId, customerId: { in: ids }, direction: "in", readAt: null }, _count: { _all: true } }),
    db.chatMessage.findMany({ where: { shopId, customerId: { in: ids } }, orderBy: { createdAt: "desc" }, distinct: ["customerId"] }),
  ]);
  const cById = new Map(customers.map((c) => [c.id, c]));
  const uById = new Map(unread.map((u) => [u.customerId, u._count._all]));
  const mById = new Map(lastMsgs.map((m) => [m.customerId, m]));
  const rows = ids
    .filter((id) => cById.has(id) && (!opts.unread || (uById.get(id) ?? 0) > 0))
    .slice(0, limit)
    .map((id) => {
      const c = cById.get(id)!, m = mById.get(id)!;
      return {
        customer: { id: c.id, name: c.name, phone: c.phone, optedOut: c.optedOut },
        last: { body: m.body, direction: m.direction, channel: m.channel, kind: m.kind, status: m.status, at: m.createdAt },
        unread: uById.get(id) ?? 0, windowOpen: windowOpen(c),
        windowEndsAt: c.lastInboundAt ? new Date(c.lastInboundAt.getTime() + WINDOW_MS) : null,
      };
    });
  return { conversations: rows, nextCursor: rows.length === limit ? rows[rows.length - 1].last.at.toISOString() : null };
}

export async function unreadCount(shopId: string) {
  return db.chatMessage.count({ where: { shopId, direction: "in", readAt: null } });
}

export async function thread(shopId: string, customerId: string, opts: { before?: string; limit?: number } = {}) {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const rows = await db.chatMessage.findMany({
    where: { shopId, customerId, ...(opts.before ? { createdAt: { lt: new Date(opts.before) } } : {}) },
    orderBy: { createdAt: "desc" }, take: limit,
  });
  return { messages: rows.reverse(), nextCursor: rows.length === limit ? rows[rows.length - 1]?.createdAt.toISOString() ?? null : null };
}

/** Marks a conversation read, and sends the WhatsApp read receipt for the newest customer message. */
export async function markRead(shop: Shop, customerId: string) {
  const newest = await db.chatMessage.findFirst({ where: { shopId: shop.id, customerId, direction: "in", readAt: null }, orderBy: { createdAt: "desc" } });
  await db.chatMessage.updateMany({ where: { shopId: shop.id, customerId, direction: "in", readAt: null }, data: { readAt: new Date() } });
  const wa = channelConfig(shop).wa;
  if (newest?.providerId && wa) await markWhatsAppRead(wa, newest.providerId);
}

export type SendResult = { error: string; code: string } | { id: string; status: string; kind: string };

/**
 * Sends a one-to-one message. WhatsApp inside the 24h window: free text. Outside it: the shop's
 * approved template (counts toward the monthly limit). channel "sms" sends an SMS instead.
 */
export async function sendChat(shop: Shop, customerId: string, text: string, opts: { channel?: "wa" | "sms"; authorId?: string } = {}): Promise<SendResult> {
  const c = await db.customer.findFirst({ where: { id: customerId, shopId: shop.id } });
  if (!c) return { error: "Customer পাওয়া যায়নি", code: "not_found" };
  const body = text.trim();
  if (!body) return { error: "Message লিখুন", code: "invalid" };
  const cfg = channelConfig(shop);
  const channel = opts.channel ?? "wa";
  const open = windowOpen(c);
  if (c.optedOut && !open) return { error: "এই Customer Message বন্ধ করতে বলেছেন (STOP)। উনি নিজে Message দিলে উত্তর দিতে পারবেন।", code: "opted_out" };
  const kind = channel === "sms" ? "text" : open ? "text" : "template";
  if (kind === "template" || channel === "sms") {
    const limit = messageLimit(shop);
    if ((await usedThisMonth(shop.id)) >= limit) return { error: "এই মাসের Message সীমা শেষ", code: "limit_reached" };
  }
  const row = await db.chatMessage.create({ data: { shopId: shop.id, customerId, direction: "out", channel, kind, body, status: "sending", authorId: opts.authorId } });
  try {
    let providerId = "", status = "sent";
    if (channel === "sms") { if (cfg.sms) providerId = await sendSms(cfg.sms, c.phone, body); else status = "test"; }
    else if (!cfg.wa) status = "test";
    else providerId = open ? await sendWhatsAppText(cfg.wa, c.phone, body) : await sendWhatsApp(cfg.wa, c.phone, c.name.split(" ")[0], body);
    await db.chatMessage.update({ where: { id: row.id }, data: { status, providerId: providerId || null } });
    return { id: row.id, status, kind };
  } catch (e) {
    await db.chatMessage.update({ where: { id: row.id }, data: { status: "failed", error: String((e as Error).message).slice(0, 300) } });
    await logError(channel === "sms" ? "sms" : "whatsapp", e, shop.id);
    return { error: String((e as Error).message).slice(0, 300), code: "provider_error" };
  }
}

/** Records something in the conversation without sending (a phone call the owner made, a note). */
export async function logChat(shopId: string, customerId: string, data: { channel: string; kind: string; body: string; direction?: string; status?: string; providerId?: string | null; authorId?: string | null }) {
  return db.chatMessage.create({ data: { shopId, customerId, direction: data.direction ?? "out", channel: data.channel, kind: data.kind, body: data.body, status: data.status ?? "sent", providerId: data.providerId ?? null, authorId: data.authorId ?? null } });
}

/**
 * Stores an incoming WhatsApp message. The shop is the one whose WhatsApp number received it.
 * On the shared Dakly number, it goes to the shop that last messaged this customer.
 */
export async function receiveWhatsApp(phoneNumberId: string, from: string, name: string | null, text: string, waId: string, kind = "text") {
  const phone = normalizePhone("+" + from) ?? from;
  const own = await db.shop.findMany({ where: { waPhoneNumberId: phoneNumberId } });
  let shop: Shop | null = own[0] ?? null;
  let customer = shop ? await db.customer.findUnique({ where: { shopId_phone: { shopId: shop.id, phone } } }) : null;
  if (!shop) {
    const recent = await db.chatMessage.findFirst({ where: { customer: { phone }, direction: "out", channel: "wa", shop: { waPhoneNumberId: null } }, orderBy: { createdAt: "desc" }, include: { shop: true, customer: true } });
    if (!recent) return null;
    shop = recent.shop; customer = recent.customer;
  }
  if (!customer) customer = await db.customer.create({ data: { shopId: shop.id, phone, name: name || "+" + phone, source: "whatsapp" } });
  if (await db.chatMessage.findFirst({ where: { providerId: waId } })) return null; // webhook retry
  await db.customer.update({ where: { id: customer.id }, data: { lastInboundAt: new Date() } });
  return db.chatMessage.create({ data: { shopId: shop.id, customerId: customer.id, direction: "in", channel: "wa", kind, body: text, status: "received", providerId: waId } });
}
