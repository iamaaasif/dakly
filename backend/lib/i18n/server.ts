import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { currentUser } from "../auth";
import { isLang, makeLoc, shopFmt, type Lang, type Loc, DEFAULT_COUNTRY } from "./index";

export const LANG_COOKIE = "dakly_lang";

/** Language from the request alone: cookie, then Accept-Language, then Bangla (first market). */
export async function requestLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  return headerLang((await headers()).get("accept-language")) ?? "bn";
}

function headerLang(al: string | null): Lang | null {
  for (const part of (al ?? "").split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return null;
}

/**
 * Locale for the current request. Signed-in merchants: their own panel language, then the
 * language cookie, then the shop language. Everyone else: requestLang().
 */
export const getLoc = cache(async (): Promise<Loc & { opts: ReturnType<typeof shopFmt> }> => {
  const u = await currentUser().catch(() => null);
  const h = await headers();
  const cookie = (await cookies()).get(LANG_COOKIE)?.value;
  // API clients (the Android app) send Accept-Language with the user's app language
  const apiLang = h.get("authorization")?.startsWith("Bearer ") ? headerLang(h.get("accept-language")) : null;
  const lang = apiLang ?? (u?.uiLang && isLang(u.uiLang) ? u.uiLang : isLang(cookie) ? cookie : u?.shop ? null : await requestLang());
  const opts = shopFmt(u?.shop ?? { country: DEFAULT_COUNTRY }, lang);
  return { ...makeLoc(opts), opts };
});

/** Locale for a shop outside a request (scheduler, webhooks): the shop's own language. */
export const shopLoc = (shop: Parameters<typeof shopFmt>[0]) => makeLoc(shopFmt(shop));

/** Translates a Bangla source string for the current request. */
export const tr = async (s: string, vars?: Parameters<Loc["t"]>[1]) => (await getLoc()).t(s, vars);
