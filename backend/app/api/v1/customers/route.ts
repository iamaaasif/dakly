import { apiAuth, ok, out, locale } from "@/lib/api";
import { loadCustomers, SEGMENT_KEYS, type Segment } from "@/lib/segments";
import { addCustomer } from "@/lib/services";
import { toAsciiDigits } from "@/lib/i18n";

/** ?q=&segment=vip|regular|new|inactive&page=1&pageSize=50&sort=total|recent|name */
export async function GET(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const p = new URL(req.url).searchParams;
  const seg = p.get("segment") as Segment | null;
  const q = toAsciiDigits(p.get("q") || "").toLowerCase();
  const sort = p.get("sort") || "total";
  const page = Math.max(1, Number(p.get("page") || 1)), size = Math.min(200, Math.max(1, Number(p.get("pageSize") || 50)));
  const all = (await loadCustomers(a.shop.id))
    .filter((c) => !seg || !SEGMENT_KEYS.includes(seg) || c.segment === seg)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, "") || "~"))
    .sort((x, y) => sort === "name" ? x.name.localeCompare(y.name) : sort === "recent" ? (y.stats.last?.getTime() ?? 0) - (x.stats.last?.getTime() ?? 0) : y.stats.total - x.stats.total);
  return ok({ ...locale(a.shop), total: all.length, page, pageSize: size, hasMore: page * size < all.length, items: all.slice((page - 1) * size, page * size) });
}

/** { name, phone, items?, amount?, area?, source? } Phone may be local (shop country) or international. */
export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return out(await addCustomer(a.shop, await req.json().catch(() => ({}))), 201);
}
