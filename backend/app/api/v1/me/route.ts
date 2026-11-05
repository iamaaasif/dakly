import { z } from "zod";
import { apiAuth, ok, out, body, locale } from "@/lib/api";
import { activePlan, messageLimit, aiLimit, PLANS, priceFor } from "@/lib/plans";
import { usedThisMonth } from "@/lib/send";
import { aiUsedThisMonth } from "@/lib/usage";
import { channelConfig } from "@/lib/config";
import { deleteAccount } from "@/lib/services";
import { db } from "@/lib/db";
import { isLang } from "@/lib/i18n";
import { onboarding, ONBOARDING_LABELS } from "@/lib/onboarding";
import { getLoc } from "@/lib/i18n/server";

export async function GET() {
  const a = await apiAuth({ allowInactive: true });
  if ("res" in a) return a.res;
  const { user, shop } = a;
  const cfg = channelConfig(shop);
  const plan = activePlan(shop);
  return ok({
    user: { id: user.id, name: user.name, email: user.email, uiLang: user.uiLang },
    shop: { id: shop.id, name: shop.name, status: shop.suspended ? "suspended" : shop.approved ? "active" : "pending", ...locale(shop), brandVoice: shop.brandVoice },
    plan: { key: plan, name: PLANS[plan].name, until: shop.planUntil, price: priceFor(plan, shop.currency), messages: { used: await usedThisMonth(shop.id), limit: messageLimit(shop) }, ai: { used: await aiUsedThisMonth(shop.id), limit: aiLimit(shop) } },
    channels: { whatsapp: !!cfg.wa, sms: cfg.sms?.kind ?? null, voice: !!cfg.voice, facebookPage: cfg.fb?.name ?? null, store: shop.storeType },
    onboarding: await (async () => { const o = await onboarding(shop); const { t } = await getLoc(); return { ...o, steps: o.steps.map((s) => ({ ...s, label: t(ONBOARDING_LABELS[s.key]) })) }; })(),
  });
}

/** { name?, uiLang? } */
export async function PATCH(req: Request) {
  const a = await apiAuth({ allowInactive: true });
  if ("res" in a) return a.res;
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(120).optional(), uiLang: z.string().nullable().optional() }));
  if ("res" in b) return b.res;
  await db.user.update({ where: { id: a.user.id }, data: { ...(b.data.name ? { name: b.data.name } : {}), ...(b.data.uiLang !== undefined ? { uiLang: isLang(b.data.uiLang) ? b.data.uiLang : null } : {}) } });
  return ok({ ok: true });
}

/** Permanently deletes the account and all shop data. { password } */
export async function DELETE(req: Request) {
  const a = await apiAuth({ allowInactive: true });
  if ("res" in a) return a.res;
  const b = await req.json().catch(() => ({}));
  return out(await deleteAccount(a.user.id, String(b.password ?? "")));
}
