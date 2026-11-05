import { db } from "@/lib/db";
import { apiAuth, fail, ok } from "@/lib/api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const c = await db.campaign.findFirst({
    where: { id: (await params).id, shopId: a.shop.id },
    include: { messages: { select: { id: true, channel: true, status: true, error: true, updatedAt: true, customer: { select: { id: true, name: true, phone: true } } } } },
  });
  if (!c) return fail("Not found", 404);
  const count = (...s: string[]) => c.messages.filter((m) => s.includes(m.status)).length;
  return ok({ ...c, summary: { sent: count("sent", "delivered", "read", "interested"), delivered: count("delivered", "read", "interested"), read: count("read", "interested"), interested: count("interested"), failed: count("failed"), test: count("test"), skipped: count("skipped") } });
}
