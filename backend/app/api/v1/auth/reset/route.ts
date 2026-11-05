import { z } from "zod";
import { body, ok, out } from "@/lib/api";
import { issueToken } from "@/lib/auth";
import { resetPassword } from "@/lib/services";

/** { token, password } from the emailed reset link -> { token } (signed in). Every older token stops working. */
export async function POST(req: Request) {
  const b = await body(req, z.object({ token: z.string().min(10), password: z.string() }));
  if ("res" in b) return b.res;
  const r = await resetPassword(b.data.token, b.data.password);
  if (r.error) return out(r);
  return ok({ token: await issueToken(r.userId!), expiresInDays: 60 });
}
