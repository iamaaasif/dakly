import "server-only";
import type { Shop } from "@prisma/client";
import { db } from "./db";
import { decrypt } from "./crypto";
import { normalizePhone } from "./i18n";
import { logError } from "./audit";
import { activePlan, FREE_CUSTOMER_CAP } from "./plans";

type StoreOrder = { externalId: string; name: string; phone: string; email: string | null; area: string | null; amount: number; items: string; at: Date };

async function wooOrders(base: string, key: string, secret: string, since: Date | null): Promise<StoreOrder[]> {
  const out: StoreOrder[] = [];
  const auth = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
  for (let page = 1; page <= 50; page++) {
    const p = new URLSearchParams({ per_page: "100", page: String(page), orderby: "date", order: "asc" });
    if (since) p.set("modified_after", since.toISOString());
    const res = await fetch(`${base.replace(/\/$/, "")}/wp-json/wc/v3/orders?${p}`, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const list = (await res.json()) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const o of list) {
      if (["cancelled", "refunded", "failed", "trash"].includes(o.status)) continue;
      const b = o.billing ?? {};
      out.push({
        externalId: `woo:${o.id}`, name: `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim(), phone: b.phone ?? "",
        email: b.email || null, area: b.city || b.state || null, amount: Math.round(Number(o.total) || 0),
        items: (o.line_items ?? []).map((l: { name: string; quantity: number }) => `${l.name} × ${l.quantity}`).join(", "),
        at: new Date(o.date_created_gmt ? o.date_created_gmt + "Z" : o.date_created),
      });
    }
    if (list.length < 100) break;
  }
  return out;
}

async function shopifyOrders(domain: string, token: string, since: Date | null): Promise<StoreOrder[]> {
  const out: StoreOrder[] = [];
  const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const version = process.env.SHOPIFY_API_VERSION || "2026-07";
  const p = new URLSearchParams({ status: "any", limit: "250" });
  if (since) p.set("updated_at_min", since.toISOString());
  let url: string | null = `https://${host}/admin/api/${version}/orders.json?${p}`;
  for (let i = 0; url && i < 50; i++) {
    const res: Response = await fetch(url, { headers: { "X-Shopify-Access-Token": token } });
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    for (const o of data.orders ?? []) {
      if (o.cancelled_at) continue;
      const c = o.customer ?? {}, a = o.billing_address ?? o.shipping_address ?? {};
      out.push({
        externalId: `shopify:${o.id}`, name: `${c.first_name ?? a.first_name ?? ""} ${c.last_name ?? a.last_name ?? ""}`.trim(),
        phone: o.phone || c.phone || a.phone || "", email: o.email || c.email || null, area: a.city || null,
        amount: Math.round(Number(o.total_price) || 0),
        items: (o.line_items ?? []).map((l: { title: string; quantity: number }) => `${l.title} × ${l.quantity}`).join(", "),
        at: new Date(o.created_at),
      });
    }
    const link = res.headers.get("link") || "";
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return out;
}

/** Pulls orders from the shop's online store and adds new customers and orders. */
export async function syncStore(shop: Shop) {
  if (!shop.storeType || !shop.storeUrl || !shop.storeKey) throw new Error("Store connect করা নেই");
  const key = decrypt(shop.storeKey)!, secret = decrypt(shop.storeSecret) ?? "";
  const started = new Date();
  try {
    const orders = shop.storeType === "shopify"
      ? await shopifyOrders(shop.storeUrl, key, shop.storeSyncedAt)
      : await wooOrders(shop.storeUrl, key, secret, shop.storeSyncedAt);
    let customers = 0, added = 0;
    for (const o of orders) {
      const phone = normalizePhone(o.phone, shop.country);
      if (!phone || !o.amount) continue;
      let c = await db.customer.findUnique({ where: { shopId_phone: { shopId: shop.id, phone } } });
      if (!c && activePlan(shop) === "free" && (await db.customer.count({ where: { shopId: shop.id } })) >= FREE_CUSTOMER_CAP) continue;
      if (!c) {
        c = await db.customer.create({ data: { shopId: shop.id, phone, name: o.name || "Customer", email: o.email, area: o.area, source: shop.storeType } });
        customers++;
      }
      const exists = await db.order.findUnique({ where: { customerId_externalId: { customerId: c.id, externalId: o.externalId } } });
      if (!exists) { await db.order.create({ data: { customerId: c.id, amount: o.amount, items: o.items || null, orderedAt: o.at, externalId: o.externalId } }); added++; }
    }
    await db.shop.update({ where: { id: shop.id }, data: { storeSyncedAt: started, storeError: null } });
    return { customers, orders: added };
  } catch (e) {
    await db.shop.update({ where: { id: shop.id }, data: { storeError: String((e as Error).message).slice(0, 300) } });
    throw e;
  }
}

/** Syncs every connected store at most once every 3 hours. */
export async function syncDueStores() {
  const cutoff = new Date(Date.now() - 3 * 3600000);
  const shops = await db.shop.findMany({ where: { storeType: { not: null }, OR: [{ storeSyncedAt: null }, { storeSyncedAt: { lt: cutoff } }] }, take: 20 });
  let n = 0;
  for (const s of shops) { try { await syncStore(s); n++; } catch (e) { await logError("store", e, s.id); } }
  return n;
}
