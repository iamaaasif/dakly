import "server-only";
import type { Shop } from "@prisma/client";
import { decrypt } from "./crypto";
import { isPlaceholder } from "./envcheck";

/** Reads an env var. Example values from .env.example ("dummy", "replace-with…", all zeros) count as not set, so that feature stays in test mode. */
export const env = (k: string) => {
  const v = (process.env[k] || "").trim();
  if (!v || isPlaceholder(v)) return null;
  return v;
};

export type TwilioVoice = { kind: "twilio"; sid: string; token: string; from: string };
/** Self-hosted Asterisk with a SIP trunk (IPCallBD in Bangladesh), driven over ARI. */
export type SipVoice = { kind: "sip"; ariUrl: string; user: string; pass: string; countries: string[]; numberFormat: "intl" | "local" | "e164"; maxCalls: number };
/** Voice providers for a shop. Calls go to `sip` for its countries and to `twilio` for the rest. */
export type VoiceConfig = { twilio: TwilioVoice | null; sip: SipVoice | null; own: boolean };

/** Platform Asterisk settings from the environment, or null when they are not set. */
export function sipVoice(): SipVoice | null {
  const url = env("ASTERISK_ARI_URL"), pass = env("ASTERISK_ARI_PASSWORD");
  if (!url || !pass) return null;
  const fmt = (process.env.SIP_NUMBER_FORMAT || "intl").trim().toLowerCase();
  return {
    kind: "sip",
    ariUrl: url.replace(/\/$/, ""),
    user: env("ASTERISK_ARI_USER") || "dakly",
    pass,
    countries: (process.env.SIP_COUNTRIES || "BD").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
    numberFormat: fmt === "local" || fmt === "e164" ? fmt : "intl",
    maxCalls: Math.max(1, Number(process.env.SIP_MAX_CALLS) || 5),
  };
}

export type ChannelConfig = {
  wa: { phoneNumberId: string; token: string; template: string; lang: string; own: boolean } | null;
  sms: ({ kind: "gateway"; url: string; key: string; sender: string } | { kind: "twilio"; sid: string; token: string; from: string }) & { own: boolean } | null;
  voice: VoiceConfig | null;
  fb: { pageId: string; token: string; name: string | null } | null;
};

/**
 * Channel credentials for a shop. A shop's own credentials (Settings page) win;
 * otherwise the platform credentials from the environment are used.
 */
export function channelConfig(shop: Shop): ChannelConfig {
  const waOwn = shop.waPhoneNumberId && shop.waAccessToken && shop.waTemplateName;
  const wa = waOwn
    ? { phoneNumberId: shop.waPhoneNumberId!, token: decrypt(shop.waAccessToken)!, template: shop.waTemplateName!, lang: shop.waTemplateLang || "bn", own: true }
    : env("WA_PHONE_NUMBER_ID") && env("WA_ACCESS_TOKEN") && env("WA_TEMPLATE_NAME")
      ? { phoneNumberId: env("WA_PHONE_NUMBER_ID")!, token: env("WA_ACCESS_TOKEN")!, template: env("WA_TEMPLATE_NAME")!, lang: env("WA_TEMPLATE_LANG") || "bn", own: false }
      : null;

  // SMS: the shop's own HTTP gateway, else the platform gateway for its country (SMS_API_* serves
  // SMS_GATEWAY_COUNTRIES, default BD), else Twilio SMS (works worldwide).
  const smsOwn = shop.smsApiUrl && shop.smsApiKey;
  const gwCountries = (process.env.SMS_GATEWAY_COUNTRIES || "BD").split(",").map((c) => c.trim().toUpperCase());
  const twSid = shop.twilioSid && shop.twilioToken ? shop.twilioSid : env("TWILIO_ACCOUNT_SID");
  const twToken = shop.twilioSid && shop.twilioToken ? decrypt(shop.twilioToken) : env("TWILIO_AUTH_TOKEN");
  const twSmsFrom = (shop.twilioSid && shop.twilioFrom) || env("TWILIO_SMS_FROM") || env("TWILIO_FROM");
  const sms: ChannelConfig["sms"] = smsOwn
    ? { kind: "gateway", url: shop.smsApiUrl!, key: decrypt(shop.smsApiKey)!, sender: shop.smsSenderId || "", own: true }
    : env("SMS_API_URL") && env("SMS_API_KEY") && gwCountries.includes(shop.country)
      ? { kind: "gateway", url: env("SMS_API_URL")!, key: env("SMS_API_KEY")!, sender: env("SMS_SENDER_ID") || "", own: false }
      : twSid && twToken && twSmsFrom
        ? { kind: "twilio", sid: twSid, token: twToken, from: twSmsFrom, own: !!shop.twilioSid }
        : null;

  // Voice: a shop's own Twilio wins. Otherwise the platform Asterisk/SIP trunk calls its countries
  // (SIP_COUNTRIES, default BD) and platform Twilio calls everywhere else.
  const voiceOwn = shop.twilioSid && shop.twilioToken && shop.twilioFrom;
  const twilioVoice: TwilioVoice | null = voiceOwn
    ? { kind: "twilio", sid: shop.twilioSid!, token: decrypt(shop.twilioToken)!, from: shop.twilioFrom! }
    : env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM")
      ? { kind: "twilio", sid: env("TWILIO_ACCOUNT_SID")!, token: env("TWILIO_AUTH_TOKEN")!, from: env("TWILIO_FROM")! }
      : null;
  const sip = voiceOwn ? null : sipVoice();
  // Voice needs OpenAI for speech; Twilio also needs a public URL for its callbacks
  const tw = twilioVoice && env("APP_URL") ? twilioVoice : null;
  const voice = env("OPENAI_API_KEY") && (tw || sip) ? { twilio: tw, sip, own: !!voiceOwn } : null;

  const fb = shop.fbPageId && shop.fbPageToken ? { pageId: shop.fbPageId, token: decrypt(shop.fbPageToken)!, name: shop.fbPageName } : null;

  return { wa, sms, voice, fb };
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const signupOpen = () => process.env.ALLOW_SIGNUP !== "false";
export const fbAppReady = () => !!(env("FB_APP_ID") && env("FB_APP_SECRET"));
export const openaiKey = () => env("OPENAI_API_KEY") || "";

export const supportEmail = () => process.env.SUPPORT_EMAIL || "support@dakly.com.bd";
