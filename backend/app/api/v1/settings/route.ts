import { apiAuth, ok, fail, locale } from "@/lib/api";
import { channelConfig } from "@/lib/config";
import { updateProfile } from "@/lib/services";
import { waCallLink } from "@/lib/wacall";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { COUNTRIES, LANGS, CURRENCIES } from "@/lib/i18n";

const PLAIN = ["waPhoneNumberId", "waTemplateName", "waTemplateLang", "smsApiUrl", "smsSenderId", "twilioSid", "twilioFrom"] as const;
const SECRET = ["waAccessToken", "smsApiKey", "twilioToken"] as const;

export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const s = a.shop, cfg = channelConfig(s);
  const st = (c: { own: boolean } | null) => (c ? (c.own ? "own" : "platform") : "off");
  return ok({
    profile: { name: s.name, ...locale(s), brandVoice: s.brandVoice },
    whatsappCall: { number: s.waCallNumber, inSms: s.waCallInSms, link: s.waCallNumber ? waCallLink(s.waCallNumber) : null },
    channels: {
      state: { wa: st(cfg.wa), sms: st(cfg.sms), voice: st(cfg.voice) }, smsProvider: cfg.sms?.kind ?? null,
      values: Object.fromEntries(PLAIN.map((k) => [k, s[k] ?? ""])),
      saved: Object.fromEntries(SECRET.map((k) => [k, !!s[k]])),
    },
    store: { type: s.storeType, url: s.storeUrl, syncedAt: s.storeSyncedAt, error: s.storeError },
    facebook: { connected: !!cfg.fb, pageId: s.fbPageId, pageName: s.fbPageName },
    options: { countries: Object.entries(COUNTRIES).map(([code, c]) => ({ code, ...c })), languages: Object.entries(LANGS).map(([code, l]) => ({ code, name: l.name })), currencies: CURRENCIES },
  });
}

/**
 * Any of: name, country, currency, timezone, language, brandVoice, waCallNumber, waCallInSms,
 * waPhoneNumberId, waAccessToken, waTemplateName, waTemplateLang, smsApiUrl, smsApiKey, smsSenderId,
 * twilioSid, twilioToken, twilioFrom, clearChannels: true. Secrets: send a value to set, omit to keep.
 */
export async function PATCH(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const pr = await updateProfile(a.shop, { name: b.name, country: b.country, currency: b.currency, timezone: b.timezone, language: b.language, brandVoice: b.brandVoice,
    waCallNumber: typeof b.waCallNumber === "string" || b.waCallNumber === null ? b.waCallNumber : undefined, waCallInSms: typeof b.waCallInSms === "boolean" ? b.waCallInSms : undefined });
  if (pr.error) return fail(pr.error);
  const data: Record<string, string | null> = {};
  for (const k of PLAIN) if (typeof b[k] === "string") data[k] = (b[k] as string).trim() || null;
  for (const k of SECRET) if (typeof b[k] === "string" && (b[k] as string).trim()) data[k] = encrypt((b[k] as string).trim());
  if (b.clearChannels === true) for (const k of [...PLAIN, ...SECRET]) data[k] = null;
  if (data.smsApiUrl && !/^https:\/\//.test(data.smsApiUrl)) return fail("SMS API URL https:// দিয়ে শুরু হতে হবে");
  if (data.twilioFrom && !/^\+\d{8,15}$/.test(data.twilioFrom)) return fail("Twilio নম্বর +1… ফরম্যাটে দিন");
  if (Object.keys(data).length) await db.shop.update({ where: { id: a.shop.id }, data });
  return ok({ ok: true });
}
