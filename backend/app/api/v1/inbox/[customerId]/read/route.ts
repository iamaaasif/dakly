import { apiAuth, ok } from "@/lib/api";
import { markRead } from "@/lib/inbox";

export async function POST(_: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  await markRead(a.shop, (await params).customerId);
  return ok({ ok: true });
}
