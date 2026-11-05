import { apiAuth, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { logChat } from "@/lib/inbox";

/** Log a call the owner made from their phone. { how: "phone" | "whatsapp", note?: string, durationSec?: number } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { id } = await params;
  if (!(await db.customer.findFirst({ where: { id, shopId: a.shop.id } }))) return fail("Customer পাওয়া যায়নি", 404);
  const b = await req.json().catch(() => ({}));
  const how = b.how === "whatsapp" ? "whatsapp" : "phone";
  const dur = Number(b.durationSec) > 0 ? ` · ${Math.round(Number(b.durationSec) / 60)} min` : "";
  const row = await logChat(a.shop.id, id, { channel: how === "phone" ? "call" : "wa", kind: "call", body: `📞 ${how === "phone" ? "Phone call" : "WhatsApp call"}${dur}${b.note ? `\n${String(b.note).slice(0, 500)}` : ""}`, authorId: a.user.id });
  return ok({ id: row.id }, 201);
}
