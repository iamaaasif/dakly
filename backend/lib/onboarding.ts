import "server-only";
import type { Shop } from "@prisma/client";
import { db } from "./db";
import { channelConfig } from "./config";

/** First-run checklist shown on the home screen (web and app) until every required step is done. */
export async function onboarding(shop: Shop) {
  const [customers, knowledge, campaigns] = await Promise.all([
    db.customer.count({ where: { shopId: shop.id } }),
    db.knowledgeItem.count({ where: { shopId: shop.id, active: true } }),
    db.campaign.count({ where: { shopId: shop.id } }),
  ]);
  const cfg = channelConfig(shop);
  const steps = [
    { key: "customers", done: customers > 0, href: "/customers/new", required: true },
    { key: "knowledge", done: knowledge > 0 || !!shop.brandVoice, href: "/knowledge", required: true },
    { key: "channel", done: !!(cfg.wa || cfg.sms), href: "/settings", required: true },
    { key: "campaign", done: campaigns > 0, href: "/campaigns/new", required: true },
    { key: "facebook", done: !!cfg.fb, href: "/settings", required: false },
    { key: "store", done: !!shop.storeType, href: "/settings#store", required: false },
  ];
  const req = steps.filter((s) => s.required);
  return { done: req.every((s) => s.done), progress: req.filter((s) => s.done).length, total: req.length, steps };
}

/** Labels (Bangla source; English in en.ts). */
export const ONBOARDING_LABELS: Record<string, string> = {
  customers: "Customer যোগ করুন (Excel, Store বা হাতে)",
  knowledge: "AI-কে পণ্য, দাম আর নিয়ম শেখান",
  channel: "WhatsApp বা SMS চালু আছে কিনা দেখুন",
  campaign: "প্রথম Campaign পাঠান",
  facebook: "Facebook Page Connect করুন (ইচ্ছা হলে)",
  store: "Online Store Connect করুন (ইচ্ছা হলে)",
};
