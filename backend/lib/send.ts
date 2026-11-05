import "server-only";
import { db } from "./db";
import { loadCustomers, type Segment } from "./segments";
import { channelConfig } from "./config";
import { messageLimit, voiceAllowed } from "./plans";
import { recommendationsFor } from "./recommend";
import { sendWhatsApp } from "./channels/whatsapp";
import { sendSms } from "./channels/sms";
import { placeCall, RetryLater } from "./channels/voice";
import { publishToPage } from "./facebook";
import { syncDueStores } from "./stores";
import { logError, setState } from "./audit";
import { dailyTips, shopDay } from "./ai-insights";
import { localHour } from "./i18n";
import { smsFooter } from "./optout";
import { waCallSmsLine } from "./wacall";
import { dailyHousekeeping } from "./housekeeping";

export const personalize = (text: string, name: string, product?: string | null, fallbackProduct = "আমাদের নতুন Collection") =>
  text.replace(/\{নাম\}|\{name\}/g, name.split(" ")[0] || name).replace(/\{পণ্য\}|\{product\}/g, product || fallbackProduct);

/** Messages this shop has really sent this calendar month (test-mode messages do not count). */
export async function usedThisMonth(shopId: string) {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const sent = ["sent", "delivered", "read", "interested"];
  const [campaign, chat] = await Promise.all([
    db.campaignMessage.count({ where: { campaign: { shopId }, createdAt: { gte: start }, status: { in: sent } } }),
    // One-to-one: templates and SMS count; free replies inside the 24h WhatsApp window do not
    db.chatMessage.count({ where: { shopId, direction: "out", createdAt: { gte: start }, status: { in: sent }, OR: [{ kind: "template" }, { channel: "sms", kind: "text" }] } }),
  ]);
  return campaign + chat;
}

export async function audience(shopId: string, segment: string) {
  const rows = await loadCustomers(shopId);
  return rows.filter((r) => !r.optedOut && (segment === "all" || r.segment === (segment as Segment)));
}

/**
 * Creates one queued message per customer. When a customer can be reached on
 * several chosen channels, Dakly picks one: WhatsApp first, then SMS, then voice.
 */
export async function queueCampaign(campaignId: string) {
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const targets = await audience(c.shopId, c.segment);
  const channel = ["wa", "sms", "voice"].find((ch) => c.channels.includes(ch));
  if (!channel) throw new Error("No channel selected");
  await db.campaignMessage.createMany({ data: targets.map((t) => ({ campaignId, customerId: t.id, channel })) });
  await db.campaign.update({ where: { id: campaignId }, data: { status: "sending" } });
  return targets.length;
}

/** Sends up to `limit` queued messages. Safe to call repeatedly and in parallel. */
export async function processQueue(limit = 60) {
  const batch = await db.campaignMessage.findMany({
    where: { status: "queued", campaign: { status: "sending" } },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: { customer: true, campaign: { include: { shop: true } } },
  });
  const quota = new Map<string, number>();
  const recos = new Map<string, Map<string, string>>();
  for (const m of batch) {
    const claimed = await db.campaignMessage.updateMany({ where: { id: m.id, status: "queued" }, data: { status: "sending" } });
    if (!claimed.count) continue;
    const shop = m.campaign.shop;
    const cfg = channelConfig(shop);
    if (!recos.has(shop.id) && /\{পণ্য\}|\{product\}/.test(m.campaign.message)) recos.set(shop.id, await recommendationsFor(shop.id));
    const text = personalize(m.campaign.message, m.customer.name, recos.get(shop.id)?.get(m.customerId), shop.language === "bn" ? undefined : "our new collection");
    try {
      if (shop.suspended) {
        await db.campaignMessage.update({ where: { id: m.id }, data: { status: "skipped", error: "Account স্থগিত" } });
        continue;
      }
      if (m.customer.optedOut) {
        await db.campaignMessage.update({ where: { id: m.id }, data: { status: "skipped", error: "Customer বন্ধ করতে বলেছেন (STOP)" } });
        continue;
      }
      const limitN = messageLimit(shop);
      const used = quota.get(shop.id) ?? (await usedThisMonth(shop.id));
      if (used >= limitN) {
        await db.campaignMessage.update({ where: { id: m.id }, data: { status: "skipped", error: "এই মাসের Message সীমা শেষ" } });
        continue;
      }
      let providerId = "";
      let status = "sent";
      const waLine = shop.waCallInSms && shop.waCallNumber ? waCallSmsLine(shop.waCallNumber, shop.language) : "";
      let channel = m.channel;
      if (m.channel === "wa") {
        if (cfg.wa) providerId = await sendWhatsApp(cfg.wa, m.customer.phone, m.customer.name.split(" ")[0], text);
        else if (m.campaign.channels.includes("sms") && cfg.sms) { providerId = await sendSms(cfg.sms, m.customer.phone, text + waLine + smsFooter(m.customerId, shop.language)); channel = "sms"; }
        else status = "test";
      } else if (m.channel === "sms") {
        if (cfg.sms) providerId = await sendSms(cfg.sms, m.customer.phone, text + waLine + smsFooter(m.customerId, shop.language));
        else status = "test";
      } else if (m.channel === "voice") {
        if (cfg.voice && !voiceAllowed(shop)) throw new Error("AI Voice Call শুধু Growth Plan-এ");
        if (cfg.voice) providerId = await placeCall(cfg.voice, m.customer.phone, m.id);
        else status = "test";
      }
      if (status !== "test") quota.set(shop.id, used + 1);
      await db.campaignMessage.update({ where: { id: m.id }, data: { status, channel, providerId: providerId || null } });
      // Show it in the customer's conversation too (kind "campaign" is not counted twice)
      await db.chatMessage.create({ data: { shopId: shop.id, customerId: m.customerId, direction: "out", channel: channel === "voice" ? "call" : channel, kind: channel === "voice" ? "call" : "campaign", body: text, status, providerId: channel === "voice" ? null : providerId || null } });
    } catch (e) {
      if (e instanceof RetryLater) {
        // The phone line is full; the call goes out on a later round
        await db.campaignMessage.update({ where: { id: m.id }, data: { status: "queued" } });
        continue;
      }
      await db.campaignMessage.update({ where: { id: m.id }, data: { status: "failed", error: String((e as Error).message).slice(0, 500) } });
      await logError(m.channel === "wa" ? "whatsapp" : m.channel, e, shop.id);
    }
  }
  const open = await db.campaign.findMany({ where: { status: "sending" }, select: { id: true } });
  for (const c of open) {
    const left = await db.campaignMessage.count({ where: { campaignId: c.id, status: { in: ["queued", "sending"] } } });
    if (!left) await db.campaign.update({ where: { id: c.id }, data: { status: "sent", sentAt: new Date() } });
  }
  return batch.length;
}

/** Runs everything that is due: scheduled campaigns, queued messages, scheduled posts, store syncs. */
export async function tick() {
  const now = new Date();
  const due = await db.campaign.findMany({ where: { status: "scheduled", sendAt: { lte: now } }, select: { id: true } });
  let campaigns = 0;
  for (const c of due) {
    // Claim first so two schedulers never queue the same campaign twice
    const ok = await db.campaign.updateMany({ where: { id: c.id, status: "scheduled" }, data: { status: "queuing" } });
    if (ok.count) { await queueCampaign(c.id); campaigns++; }
  }
  let messages = 0, n = 0;
  do { n = await processQueue(); messages += n; } while (n > 0 && messages < 600);

  const posts = await db.post.findMany({ where: { status: "scheduled", scheduledAt: { lte: now } }, include: { shop: true } });
  for (const p of posts) {
    const ok = await db.post.updateMany({ where: { id: p.id, status: "scheduled" }, data: { status: "publishing" } });
    if (!ok.count) continue;
    const fb = channelConfig(p.shop).fb;
    if (!fb) {
      await db.post.update({ where: { id: p.id }, data: { status: "failed", error: "Facebook Page connect করা নেই (Settings দেখুন)" } });
      continue;
    }
    try {
      const id = await publishToPage(fb, p.text);
      await db.post.update({ where: { id: p.id }, data: { status: "published", publishedAt: new Date(), fbPostId: id, error: null } });
    } catch (e) {
      await db.post.update({ where: { id: p.id }, data: { status: "failed", error: String((e as Error).message).slice(0, 500) } });
      await logError("facebook", e, p.shopId);
    }
  }
  const stores = await syncDueStores();

  // Prepare today's AI suggestions after 7am in each shop's own time zone, a few shops per minute
  let tips = 0;
  const zones = await db.shop.groupBy({ by: ["timezone"], where: { suspended: false, approved: true } });
  for (const { timezone } of zones) {
    if (tips >= 5) break;
    let tz = timezone; try { localHour(tz); } catch { tz = "Asia/Dhaka"; }
    if (localHour(tz) < 7) continue;
    const day = shopDay({ timezone: tz });
    const shops = await db.shop.findMany({
      where: { timezone, suspended: false, approved: true, suggestions: { none: { day } }, customers: { some: {} } }, take: 5 - tips,
    });
    for (const sh of shops) { try { await dailyTips(sh); tips++; } catch (e) { await logError("ai", e, sh.id); } }
  }
  const housekeeping = await dailyHousekeeping().catch(async (e) => { await logError("scheduler", e); return null; });
  await setState("scheduler.lastTick", new Date().toISOString());
  return { campaigns, messages, posts: posts.length, stores, tips, housekeeping };
}
