import { issueToken } from "@/lib/auth";
import { registerUser } from "@/lib/services";
import { fail, ok, tooMany } from "@/lib/api";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

/** { name, shop, email, password, country?: "BD", language?: "bn"|"en" } */
export async function POST(req: Request) {
  const rl = rateLimit(`register:${clientIp(req.headers)}`, ...LIMITS.register);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const r = await registerUser(await req.json().catch(() => ({})));
  if (r.error) return fail(r.error);
  return ok({ token: await issueToken(r.userId!) }, 201);
}
