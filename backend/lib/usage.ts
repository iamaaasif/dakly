import "server-only";
import type { Shop } from "@prisma/client";
import { db } from "./db";
import { aiLimit } from "./plans";

export const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };

export const aiUsedThisMonth = (shopId: string) => db.aiUsage.count({ where: { shopId, createdAt: { gte: monthStart() } } });

export class AiLimitError extends Error {}

/** Runs an AI call for a shop: checks the plan's monthly AI limit and records the use. */
export async function withAi<T>(shop: Shop, kind: string, fn: () => Promise<T>): Promise<T> {
  if ((await aiUsedThisMonth(shop.id)) >= aiLimit(shop))
    throw new AiLimitError("এই মাসের AI ব্যবহারের সীমা শেষ। Plan Upgrade করুন অথবা নিজে লিখুন।");
  const out = await fn();
  await db.aiUsage.create({ data: { shopId: shop.id, kind } });
  return out;
}
