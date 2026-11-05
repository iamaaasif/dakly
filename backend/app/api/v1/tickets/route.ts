import { z } from "zod";
import { db } from "@/lib/db";
import { apiAuth, body, ok } from "@/lib/api";

export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return ok({ items: await db.ticket.findMany({ where: { shopId: a.shop.id }, orderBy: { updatedAt: "desc" }, include: { messages: { orderBy: { createdAt: "asc" }, select: { body: true, fromStaff: true, createdAt: true } } } }) });
}

export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const b = await body(req, z.object({ subject: z.string().min(3), body: z.string().min(5) }));
  if ("res" in b) return b.res;
  const t = await db.ticket.create({ data: { shopId: a.shop.id, subject: b.data.subject, messages: { create: { authorId: a.user.id, body: b.data.body } } } });
  return ok({ id: t.id }, 201);
}
