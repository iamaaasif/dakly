/**
 * In-memory rate limits (one app container). Each key gets `limit` hits per `windowSec`.
 * Behind several app containers, put the limits in a shared store (Redis) instead.
 */
const hits = new Map<string, number[]>();
let sweep = Date.now();

export function rateLimit(key: string, limit: number, windowSec: number): { ok: boolean; retryAfter: number } {
  const now = Date.now(), from = now - windowSec * 1000;
  const list = (hits.get(key) ?? []).filter((t) => t > from);
  if (list.length >= limit) { hits.set(key, list); return { ok: false, retryAfter: Math.ceil((list[0] + windowSec * 1000 - now) / 1000) }; }
  list.push(now); hits.set(key, list);
  if (now - sweep > 60_000) { sweep = now; for (const [k, v] of hits) if (!v.length || v[v.length - 1] < now - 3600_000) hits.delete(k); }
  return { ok: true, retryAfter: 0 };
}

/** Client IP from the reverse proxy (Caddy/nginx set X-Forwarded-For), else "local". */
export const clientIp = (h: Headers) => (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "local";

/** Limits, per window: tune here. */
export const LIMITS = {
  register: [10, 3600], // per IP per hour
  forgotIp: [10, 3600], // per IP per hour
  forgotEmail: [3, 900], // per address per 15 min
  api: [Number(process.env.API_RATE_LIMIT_PER_MIN) || 120, 60], // per account per minute (API_RATE_LIMIT_PER_MIN raises it for app test runs)
  ai: [20, 60], // AI calls per shop per minute
  import: [10, 300], // file imports per shop per 5 min
  webhook: [600, 60], // per IP per minute
} as const satisfies Record<string, readonly [number, number]>;
