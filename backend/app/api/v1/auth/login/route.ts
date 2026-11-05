import { z } from "zod";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/auth";
import { verifyLogin } from "@/lib/services";
import { body, fail, ok, locale } from "@/lib/api";
import { clientIp } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const b = await body(req, z.object({ email: z.string(), password: z.string() }));
  if ("res" in b) return b.res;
  const r = await verifyLogin(b.data.email, b.data.password, clientIp(req.headers));
  if (r.error) return r.code === "rate_limited" ? fail(r.error, 429, "rate_limited") : fail(r.error, 401, "bad_credentials");
  const user = await db.user.findUnique({ where: { id: r.userId! }, include: { shop: true } });
  if (!user?.shop || user.disabled) return fail("এই Account দিয়ে App-এ Login করা যাবে না", 403);
  return ok({
    token: await issueToken(user.id), expiresInDays: 60,
    user: { id: user.id, name: user.name, email: user.email },
    shop: { id: user.shop.id, name: user.shop.name, status: user.shop.suspended ? "suspended" : user.shop.approved ? "active" : "pending", ...locale(user.shop) },
  });
}
