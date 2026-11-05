import { apiAuth, ok } from "@/lib/api";
import { conversations, unreadCount } from "@/lib/inbox";

/** ?q=&unread=1&before=<nextCursor>&limit=30 */
export async function GET(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const p = new URL(req.url).searchParams;
  const r = await conversations(a.shop.id, { q: p.get("q") ?? undefined, unread: p.get("unread") === "1", before: p.get("before") ?? undefined, limit: Number(p.get("limit") || 30) });
  return ok({ ...r, unreadTotal: await unreadCount(a.shop.id) });
}
