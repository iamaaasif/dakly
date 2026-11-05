import { z } from "zod";
import { apiAuth, body, ok, out } from "@/lib/api";
import { issueToken } from "@/lib/auth";
import { changePassword } from "@/lib/services";

/** { current, password } -> { token }. Other devices are signed out; use the returned token. */
export async function POST(req: Request) {
  const a = await apiAuth({ allowInactive: true });
  if ("res" in a) return a.res;
  const b = await body(req, z.object({ current: z.string(), password: z.string() }));
  if ("res" in b) return b.res;
  const r = await changePassword(a.user.id, b.data.current, b.data.password);
  if (r.error) return out(r);
  return ok({ token: await issueToken(a.user.id), expiresInDays: 60 });
}
