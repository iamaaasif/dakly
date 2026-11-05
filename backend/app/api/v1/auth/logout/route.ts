import { ok } from "@/lib/api";
import { requestToken, revokeToken } from "@/lib/auth";

/** Signs this token out on the server. The app should delete its copy too. */
export async function POST() {
  const t = await requestToken();
  if (t) await revokeToken(t);
  return ok({ ok: true });
}
