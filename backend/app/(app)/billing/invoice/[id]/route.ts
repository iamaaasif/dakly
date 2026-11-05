import { db } from "@/lib/db";
import { currentUserId, perms } from "@/lib/auth";
import { PLANS, type PlanKey } from "@/lib/plans";
import { supportEmail, appUrl } from "@/lib/config";

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Printable invoice for a paid (or admin-recorded) payment. The shop owner or billing staff only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUserId();
  if (!uid) return new Response("Not found", { status: 404 });
  const [me, p] = await Promise.all([
    db.user.findUnique({ where: { id: uid }, include: { shop: true } }),
    db.payment.findUnique({ where: { id: (await params).id }, include: { shop: { include: { owner: true } } } }),
  ]);
  const allowed = me && p && (p.shopId === me.shop?.id || perms(me).billing) && ["paid", "manual"].includes(p.status);
  if (!allowed) return new Response("Not found", { status: 404 });
  const bn = (me.uiLang ?? p.shop.language) === "bn";
  const L = bn
    ? { inv: "রসিদ (Invoice)", no: "নম্বর", date: "তারিখ", to: "যাকে", item: "বিবরণ", amt: "টাকা", total: "মোট", paid: "পরিশোধিত", via: "মাধ্যম", print: "Print / PDF" }
    : { inv: "Invoice", no: "Number", date: "Date", to: "Billed to", item: "Description", amt: "Amount", total: "Total", paid: "Paid", via: "Paid with", print: "Print / PDF" };
  const money = `${new Intl.NumberFormat("en-IN").format(p.amount)} ${p.currency}`;
  const d = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: p.shop.timezone }).format(p.paidAt ?? p.createdAt);
  const biz = esc(process.env.BUSINESS_NAME || "Dakly");
  const addr = esc(process.env.BUSINESS_ADDRESS || "");
  const tax = process.env.BUSINESS_TAX_ID ? `<div>${esc(process.env.BUSINESS_TAX_ID)}</div>` : "";
  const plan = PLANS[p.plan as PlanKey]?.name ?? p.plan;
  const html = `<!doctype html><html lang="${bn ? "bn" : "en"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${L.inv} ${esc(p.tranId)}</title>
<style>body{font-family:system-ui,-apple-system,"Noto Sans Bengali",sans-serif;color:#13261d;background:#f3f5f2;margin:0;padding:16px}.box{max-width:720px;margin:auto;background:#fff;border:1px solid #d5dcd4;border-radius:14px;padding:28px}h1{margin:0;color:#c8402a}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{padding:10px;border-bottom:1px solid #e3e8e2;text-align:left}th:last-child,td:last-child{text-align:right}.row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:18px}.muted{color:#5b6b62;font-size:14px}button{margin-top:18px;padding:10px 16px;border-radius:10px;border:0;background:#c8402a;color:#fff;font-weight:600}@media print{button{display:none}body{background:#fff}.box{border:0}}</style>
<div class="box"><div class="row" style="margin:0"><div><h1>${biz}</h1><div class="muted">${addr}</div>${tax}<div class="muted">${esc(supportEmail())} · ${esc(appUrl())}</div></div>
<div style="text-align:right"><b>${L.inv}</b><div class="muted">${L.no}: ${esc(p.tranId)}</div><div class="muted">${L.date}: ${d}</div></div></div>
<div class="row"><div><div class="muted">${L.to}</div><b>${esc(p.shop.name)}</b><div>${esc(p.shop.owner.name)}</div><div class="muted">${esc(p.shop.owner.email)}</div></div>
<div style="text-align:right"><div class="muted">${L.via}</div><b>${esc(p.provider === "manual" ? "Manual" : p.provider === "stripe" ? "Card (Stripe)" : `SSLCommerz${p.method ? " · " + p.method : ""}`)}</b></div></div>
<table><tr><th>${L.item}</th><th>${L.amt}</th></tr><tr><td>Dakly ${esc(plan)} × ${p.months}</td><td>${money}</td></tr><tr><th>${L.total}</th><th>${money}</th></tr></table>
<p><b style="color:#2f7d4f">${L.paid}</b></p><button onclick="print()">${L.print}</button></div></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
