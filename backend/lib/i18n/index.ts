/**
 * Dakly i18n. Bangla is the source language: UI strings are written in Bangla and wrapped in t("…").
 * Other languages map the Bangla source to their text (see en.ts). To add a language:
 *   1. copy en.ts to xx.ts and translate the values,
 *   2. add it to LANGS and DICTS below.
 * Missing keys fall back to English, then to the Bangla source.
 */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { en } from "./en";

export const LANGS = {
  bn: { name: "বাংলা", locale: "bn-BD", ai: "Bangla (natural Bangladeshi Bangla, keep common English words like Offer, Order, Delivery in English)" },
  en: { name: "English", locale: "en-GB", ai: "English (simple, friendly)" },
} as const;
export type Lang = keyof typeof LANGS;
export const LANG_KEYS = Object.keys(LANGS) as Lang[];
export const isLang = (x: unknown): x is Lang => typeof x === "string" && x in LANGS;
const DICTS: Partial<Record<Lang, Record<string, string>>> = { en };

/** Countries we set sensible defaults for. Any country works; these are just pre-filled. BD is the default. */
export const COUNTRIES: Record<string, { name: string; currency: string; tz: string; lang: Lang }> = {
  BD: { name: "Bangladesh", currency: "BDT", tz: "Asia/Dhaka", lang: "bn" },
  IN: { name: "India", currency: "INR", tz: "Asia/Kolkata", lang: "en" },
  PK: { name: "Pakistan", currency: "PKR", tz: "Asia/Karachi", lang: "en" },
  NP: { name: "Nepal", currency: "NPR", tz: "Asia/Kathmandu", lang: "en" },
  LK: { name: "Sri Lanka", currency: "LKR", tz: "Asia/Colombo", lang: "en" },
  MY: { name: "Malaysia", currency: "MYR", tz: "Asia/Kuala_Lumpur", lang: "en" },
  SG: { name: "Singapore", currency: "SGD", tz: "Asia/Singapore", lang: "en" },
  ID: { name: "Indonesia", currency: "IDR", tz: "Asia/Jakarta", lang: "en" },
  PH: { name: "Philippines", currency: "PHP", tz: "Asia/Manila", lang: "en" },
  AE: { name: "United Arab Emirates", currency: "AED", tz: "Asia/Dubai", lang: "en" },
  SA: { name: "Saudi Arabia", currency: "SAR", tz: "Asia/Riyadh", lang: "en" },
  QA: { name: "Qatar", currency: "QAR", tz: "Asia/Qatar", lang: "en" },
  NG: { name: "Nigeria", currency: "NGN", tz: "Africa/Lagos", lang: "en" },
  KE: { name: "Kenya", currency: "KES", tz: "Africa/Nairobi", lang: "en" },
  GB: { name: "United Kingdom", currency: "GBP", tz: "Europe/London", lang: "en" },
  DE: { name: "Germany", currency: "EUR", tz: "Europe/Berlin", lang: "en" },
  US: { name: "United States", currency: "USD", tz: "America/New_York", lang: "en" },
  CA: { name: "Canada", currency: "CAD", tz: "America/Toronto", lang: "en" },
  AU: { name: "Australia", currency: "AUD", tz: "Australia/Sydney", lang: "en" },
};
export const DEFAULT_COUNTRY = "BD";
export const countryDefaults = (c: string) => COUNTRIES[c] ?? COUNTRIES[DEFAULT_COUNTRY];
export const CURRENCIES = [...new Set(Object.values(COUNTRIES).map((c) => c.currency))];

export type Vars = Record<string, string | number>;
export type T = (src: string, vars?: Vars) => string;

export function translator(lang: Lang): T {
  const d = DICTS[lang], fb = DICTS.en;
  const loc = LANGS[lang].locale;
  return (src, vars) => {
    let s = lang === "bn" ? src : d?.[src] ?? fb?.[src] ?? src;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(typeof v === "number" ? new Intl.NumberFormat(loc).format(v) : v);
    return s;
  };
}

export type FmtOpts = { lang: Lang; currency: string; tz: string; country: string };

/** Number, money, date and phone formatting for one shop + UI language. */
export function makeFmt(o: FmtOpts) {
  const loc = LANGS[o.lang].locale;
  const t = translator(o.lang);
  const nf = new Intl.NumberFormat(loc);
  const digits = (s: string | number) => (o.lang === "bn" ? String(s).replace(/\d/g, (x) => "০১২৩৪৫৬৭৮৯"[Number(x)]) : String(s));
  const n = (x: number) => nf.format(Math.round(x * 10) / 10);
  const money = (x: number) => {
    if (o.currency === "BDT") return "৳" + digits(Math.round(x).toLocaleString("en-IN"));
    try { return digits(new Intl.NumberFormat(o.lang === "bn" ? "en-IN" : loc, { style: "currency", currency: o.currency, maximumFractionDigits: 0 }).format(x)); }
    catch { return digits(Math.round(x)) + " " + o.currency; }
  };
  const symbol = (() => {
    if (o.currency === "BDT") return "৳";
    try { return new Intl.NumberFormat("en", { style: "currency", currency: o.currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? o.currency; }
    catch { return o.currency; }
  })();
  const dtf = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(o.lang === "bn" ? "en-GB" : loc, { timeZone: o.tz, ...opts });
  const dt = (d: Date) => digits(dtf({ day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d));
  const date = (d: Date) => digits(dtf({ day: "numeric", month: "short", year: "numeric" }).format(d));
  const dayNum = (d: Date) => digits(dtf({ day: "numeric" }).format(d));
  const dayMonth = (d: Date) => digits(dtf({ day: "numeric", month: "numeric" }).format(d));
  const phone = (p: string) => {
    const x = parsePhoneNumberFromString("+" + p);
    if (!x) return digits(p);
    return digits(x.country === o.country ? x.formatNational() : x.formatInternational());
  };
  const ago = (d: Date | null | undefined) => {
    if (!d) return t("কখনো না");
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return t("আজ");
    if (days === 1) return t("গতকাল");
    if (days < 7) return t("{n} দিন আগে", { n: digits(days) });
    if (days < 30) return t("{n} সপ্তাহ আগে", { n: digits(Math.floor(days / 7)) });
    return t("{n} দিন আগে", { n: digits(days) });
  };
  const hour = (h: number) => {
    const h12 = h % 12 || 12;
    if (o.lang === "bn") return `${h < 4 ? "রাত" : h < 12 ? "সকাল" : h < 16 ? "দুপুর" : h < 18 ? "বিকেল" : h < 20 ? "সন্ধ্যা" : "রাত"} ${digits(h12)}টা`;
    return `${h12} ${h < 12 ? "AM" : "PM"}`;
  };
  return { ...o, n, money, symbol, digits, dt, date, dayNum, dayMonth, phone, ago, hour };
}
export type Fmt = ReturnType<typeof makeFmt>;
export type Loc = { lang: Lang; t: T; f: Fmt };
export const makeLoc = (o: FmtOpts): Loc => ({ lang: o.lang, t: translator(o.lang), f: makeFmt(o) });

/** Shop -> formatting options. uiLang lets a user read the panel in another language than the shop's customer language. */
export const shopFmt = (s: { country?: string | null; currency?: string | null; timezone?: string | null; language?: string | null } | null | undefined, uiLang?: string | null): FmtOpts => {
  const d = countryDefaults(s?.country || DEFAULT_COUNTRY);
  return {
    lang: isLang(uiLang) ? uiLang : isLang(s?.language) ? s!.language as Lang : d.lang,
    currency: s?.currency || d.currency, tz: s?.timezone || d.tz, country: s?.country || DEFAULT_COUNTRY,
  };
};

const ASCII: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };
export const toAsciiDigits = (s: string) => s.replace(/[০-৯٠-٩०-९]/g, (d) => ASCII[d]);

/**
 * Normalises a phone number to E.164 digits without "+", e.g. 8801712345678 or 14155550123.
 * Local numbers are read in the shop's country. Returns null if it is not a valid number.
 */
export function normalizePhone(raw: string, country = DEFAULT_COUNTRY): string | null {
  let s = toAsciiDigits(String(raw)).trim();
  if (s.startsWith("00")) s = "+" + s.slice(2);
  const p = parsePhoneNumberFromString(s, country as CountryCode);
  if (p?.isValid()) return p.number.slice(1);
  // Digits typed with the country code but no "+"
  const digitsOnly = s.replace(/[^\d]/g, "");
  const q = parsePhoneNumberFromString("+" + digitsOnly);
  if (q?.isValid() && digitsOnly.length > 9) return q.number.slice(1);
  return null;
}

/** Time-zone helpers: local calendar day and hour for a shop. */
export const localDay = (tz: string, d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const localHour = (tz: string, d = new Date()) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d)) % 24;
/** Offset of tz from UTC in ms at instant d (positive east of UTC). */
export function tzOffset(tz: string, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Opt-out words in many languages. Matched against the whole reply. */
export const STOP_WORDS = [
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit", "opt out", "optout", "remove me",
  "বন্ধ", "বন্ধ করুন", "বন্ধ কর", "আর না", "না পাঠান", "আর পাঠাবেন না",
  "बंद", "बंद करो", "रोकें", " बस", "band karo",
  "روکیں", "بند کرو", "بند",
  "إيقاف", "الغاء", "إلغاء", "توقف",
  "berhenti", "henti", "stop sms",
  "alto", "baja", "parar", "detener", "stopp", "arrêt", "arreter", "désabonner",
];
const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[\s.!।?؟]+$/u, "").replace(/^\s+/, "").replace(/\s+/g, " ");
const STOPS = new Set(STOP_WORDS.map(norm));
export const isStopMessage = (text: string) => STOPS.has(norm(text));
