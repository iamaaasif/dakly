import { apiAuth, ok } from "@/lib/api";
import { issueToken } from "@/lib/auth";

/** Swap a valid token for a fresh 60-day one. Call it on app start. */
export async function POST() {
  const a = await apiAuth({ allowInactive: true });
  if ("res" in a) return a.res;
  return ok({ token: await issueToken(a.user.id), expiresInDays: 60 });
}
