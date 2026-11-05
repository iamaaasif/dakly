import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { db } from "./db";

const COOKIE = "dakly_session";
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
};

const sign = (userId: string, v: number, ttl: string, extra: Record<string, unknown> = {}) =>
  new SignJWT({ sub: userId, v, ...extra }).setProtectedHeader({ alg: "HS256" }).setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime(ttl).sign(key());

const versionOf = async (userId: string) => (await db.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } }))?.tokenVersion ?? 0;

export async function createSession(userId: string) {
  const token = await sign(userId, await versionOf(userId), "30d");
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL || "").startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Signs out this browser: the cookie is removed and its token can never be used again. */
export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await revokeToken(t);
  jar.delete(COOKIE);
}

/** Bearer token for the mobile app (same signing key, 60 days). */
export async function issueToken(userId: string) {
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
  return sign(userId, await versionOf(userId), "60d", { typ: "api" });
}

/** Revokes one token (logout). Bad or expired tokens are ignored. */
export async function revokeToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.jti && payload.exp) await db.revokedToken.upsert({ where: { jti: payload.jti }, update: {}, create: { jti: payload.jti, expiresAt: new Date(payload.exp * 1000) } });
  } catch { /* nothing to revoke */ }
}

/** Signs a user out on every device (password change or reset, login disabled). */
export const signOutEverywhere = (userId: string) => db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });

/** The raw token of this request: Bearer header (app) or session cookie (web). */
export async function requestToken() {
  const auth = (await headers()).get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : (await cookies()).get(COOKIE)?.value ?? null;
}

export const currentUserId = cache(async (): Promise<string | null> => {
  const token = await requestToken();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.sub !== "string") return null;
    const [u, revoked] = await Promise.all([
      db.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true } }),
      payload.jti ? db.revokedToken.findUnique({ where: { jti: payload.jti } }) : null,
    ]);
    if (!u || revoked || u.tokenVersion !== (typeof payload.v === "number" ? payload.v : 0)) return null;
    return payload.sub;
  } catch {
    return null;
  }
});

/** Returns the signed-in user's shop or redirects to login. */
export async function requireShop() {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const user = await db.user.findUnique({ where: { id: uid }, include: { shop: true } });
  if (!user) redirect("/login");
  if (!user.shop) redirect(isStaff(user) ? "/admin" : "/login");
  if (user.disabled) redirect("/login");
  if (user.shop.suspended) redirect("/suspended");
  if (!user.shop.approved) redirect("/pending");
  return { user, shop: user.shop };
}

/** Staff roles. admin: everything. support: merchants (view), tickets, announcements. billing: merchants (view), plans, payments. */
export const ROLES = { admin: "Admin", support: "Support", billing: "Billing" } as const;
export function perms(u: { role: string; email: string }) {
  const r = isAdmin(u) ? "admin" : u.role;
  return {
    role: r,
    merchants: ["admin", "support", "billing"].includes(r),
    manageMerchants: r === "admin",
    billing: ["admin", "billing"].includes(r),
    support: ["admin", "support"].includes(r),
    announcements: ["admin", "support"].includes(r),
    staff: r === "admin",
    system: r === "admin",
  };
}
export const isStaff = (u: { role: string; email: string }) => isAdmin(u) || ["support", "billing"].includes(u.role);

export const isAdmin = (u: { role: string; email: string }) =>
  u.role === "admin" || (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(u.email.toLowerCase());

export async function requireAdmin() {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user || user.disabled || !isStaff(user)) redirect("/");
  return { ...user, perms: perms(user) };
}

export async function currentUser() {
  const uid = await currentUserId();
  return uid ? db.user.findUnique({ where: { id: uid }, include: { shop: true } }) : null;
}

/** Same as requireShop but for route handlers: returns null instead of redirecting. */
export async function shopOrNull() {
  const uid = await currentUserId();
  if (!uid) return null;
  const user = await db.user.findUnique({ where: { id: uid }, include: { shop: true } });
  return user?.shop && !user.disabled && !user.shop.suspended && user.shop.approved ? user.shop : null;
}
