import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { Shop } from "@prisma/client";
import { db } from "./db";
import { currentUserId } from "./auth";
import { getLoc } from "./i18n/server";
import { rateLimit, LIMITS } from "./ratelimit";

/**
 * JSON helpers for /api/v1. Errors are { error, code }: error is a human message in the
 * caller's language (Accept-Language: bn | en), code is stable for the app to switch on.
 */
const CODES: Record<number, string> = { 400: "invalid", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 429: "limit_reached", 500: "server_error", 503: "unavailable" };
export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = async (error: string, status = 400, code?: string) =>
  NextResponse.json({ error: (await getLoc()).t(error), code: code ?? CODES[status] ?? "error" }, { status });

/** Shop settings every response needs to format amounts and dates on the device. */
export const locale = (s: Shop) => ({ country: s.country, currency: s.currency, timezone: s.timezone, language: s.language });

/**
 * Resolves the signed-in merchant (Bearer token or cookie).
 * allowInactive lets pending/suspended shops through (for /me, /status and account deletion).
 */
export async function apiAuth(opts: { allowInactive?: boolean } = {}) {
  const uid = await currentUserId();
  if (!uid) return { res: await fail("Login করুন", 401) } as const;
  const user = await db.user.findUnique({ where: { id: uid }, include: { shop: true } });
  if (!user?.shop || user.disabled) return { res: await fail("Login করুন", 401) } as const;
  const rl = rateLimit(`api:${user.id}`, ...LIMITS.api);
  if (!rl.ok) return { res: await tooMany(rl.retryAfter) } as const;
  if (!opts.allowInactive) {
    if (user.shop.suspended) return { res: await fail("Account স্থগিত", 403, "suspended") } as const;
    if (!user.shop.approved) return { res: await fail("Account যাচাই হচ্ছে", 403, "pending") } as const;
  }
  return { user, shop: user.shop } as const;
}

/** 429 with Retry-After. */
export async function tooMany(retryAfter: number) {
  const r = await fail("অনেক বেশি অনুরোধ। একটু পরে আবার চেষ্টা করুন।", 429, "rate_limited");
  r.headers.set("Retry-After", String(Math.max(1, retryAfter)));
  return r;
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { res: NextResponse }> {
  try {
    return { data: schema.parse(await req.json()) };
  } catch (e) {
    return { res: await fail(e instanceof ZodError ? e.issues[0]?.message ?? "Invalid body" : "Invalid JSON") };
  }
}

/** Turns a service result ({ error } or data) into a response. */
export const out = async (r: { error?: string; code?: string } & Record<string, unknown>, status = 200) =>
  r.error ? fail(r.error, r.code === "not_found" ? 404 : r.code === "limit_reached" || r.code === "rate_limited" ? 429 : 400, r.code) : ok(r, status);

export const json = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, unknown>;
