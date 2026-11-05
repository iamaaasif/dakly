import { apiAuth, ok, out } from "@/lib/api";
import { listKnowledge, saveKnowledge } from "@/lib/services";

/** ?q=&type=product|policy|faq|voice|note. price is whole units of currency. */
export async function GET(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const p = new URL(req.url).searchParams;
  return ok({ currency: a.shop.currency, brandVoice: a.shop.brandVoice, items: await listKnowledge(a.shop.id, p.get("q") ?? undefined, p.get("type") ?? undefined) });
}
/** { type, title, body?, price?, active? } */
export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return out(await saveKnowledge(a.shop, await req.json().catch(() => ({}))), 201);
}
