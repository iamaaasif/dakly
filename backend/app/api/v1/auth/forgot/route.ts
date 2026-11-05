import { ok, tooMany } from "@/lib/api";
import { requestPasswordReset } from "@/lib/services";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";
import { getLoc } from "@/lib/i18n/server";

/** { email } -> always 200 (does not reveal whether the email exists). Sends a reset link by email. */
export async function POST(req: Request) {
  const rl = rateLimit(`forgot-ip:${clientIp(req.headers)}`, ...LIMITS.forgotIp);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const b = await req.json().catch(() => ({}));
  await requestPasswordReset(String(b.email ?? ""));
  return ok({ ok: true, message: (await getLoc()).t("এই Email-এ Account থাকলে Password নতুন করার Link পাঠানো হয়েছে। Inbox (আর Spam) দেখুন।") });
}
