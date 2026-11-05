import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shopOrNull } from "@/lib/auth";
import { normalizePhone, toAsciiDigits } from "@/lib/i18n";
import { activePlan, FREE_CUSTOMER_CAP } from "@/lib/plans";
import { tr } from "@/lib/i18n/server";

const MATCH: Record<string, RegExp> = {
  name: /(^|\s)(name|customer|নাম|কাস্টমার)/i,
  phone: /(phone|mobile|number|contact|cell|ফোন|মোবাইল|নম্বর|নাম্বার)/i,
  total: /(total|amount|spent|spend|purchase|buy|টাকা|মোট|দাম)/i,
  last: /(last|date|তারিখ|শেষ)/i,
  count: /(orders?|count|qty|সংখ্যা|বার)/i,
  email: /(e-?mail|ইমেইল)/i,
  area: /(area|address|city|district|location|এলাকা|ঠিকানা|জেলা)/i,
};

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("text" in v && v.text) return String(v.text);
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("hyperlink" in v) return String((v as { text?: string }).text ?? "");
  }
  return String(v);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const a = toAsciiDigits(s).trim();
  const dmy = a.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (dmy) { const y = Number(dmy[3].length === 2 ? "20" + dmy[3] : dmy[3]); const d = new Date(Date.UTC(y, Number(dmy[2]) - 1, Number(dmy[1]))); return Number.isNaN(d.getTime()) ? null : d; }
  if (/^\d{5}$/.test(a)) return new Date(Date.UTC(1899, 11, 30) + Number(a) * 86400000); // Excel serial
  const d = new Date(a);
  return Number.isNaN(d.getTime()) ? null : d;
}
const num = (s: string) => { const n = Number(toAsciiDigits(s).replace(/[^\d.]/g, "")); return Number.isFinite(n) ? Math.round(n) : 0; };

export async function POST(req: Request) {
  const shop = await shopOrNull();
  if (!shop) return NextResponse.json({ error: await tr("Login করুন") }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: await tr("ফাইল পাওয়া যায়নি") }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: await tr("ফাইল ৫ MB-এর বেশি") }, { status: 400 });

  let table: string[][];
  try {
    if (file.name.toLowerCase().endsWith(".csv")) table = parseCsv(await file.text());
    else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      table = [];
      ws.eachRow({ includeEmpty: false }, (r) => {
        const vals: string[] = [];
        for (let i = 1; i <= ws.columnCount; i++) vals.push(cellText(r.getCell(i).value).trim());
        table.push(vals);
      });
    }
  } catch {
    return NextResponse.json({ error: await tr("ফাইলটা পড়া গেল না। .xlsx বা .csv দিন।") }, { status: 400 });
  }
  if (table.length < 2) return NextResponse.json({ error: await tr("ফাইলে কোনো Customer নেই") }, { status: 400 });

  const header = table[0];
  const mapping: Record<string, string | null> = {};
  const idx: Record<string, number> = {};
  const used = new Set<number>();
  for (const field of ["phone", "email", "name", "total", "last", "count", "area"]) {
    const i = header.findIndex((h, j) => !used.has(j) && MATCH[field].test(h));
    mapping[field] = i >= 0 ? header[i] : null;
    if (i >= 0) { idx[field] = i; used.add(i); }
  }
  const get = (r: string[], f: string) => (idx[f] === undefined ? "" : (r[idx[f]] ?? "").trim());
  const body = table.slice(1);
  const recs = body.map((r) => ({
    name: get(r, "name"), phoneRaw: get(r, "phone"), phone: normalizePhone(get(r, "phone"), shop.country),
    total: num(get(r, "total")), last: parseDate(get(r, "last")), count: num(get(r, "count")),
    email: get(r, "email") || null, area: get(r, "area") || null,
  }));
  const valid = recs.filter((r) => r.phone && r.name);

  if (new URL(req.url).searchParams.get("dry")) {
    return NextResponse.json({
      rows: recs.length, invalid: recs.length - valid.length, mapping,
      sample: valid.slice(0, 5).map((r) => ({ name: r.name, phone: r.phoneRaw, total: r.total ? String(r.total) : "", last: r.last ? r.last.toISOString().slice(0, 10) : "" })),
    });
  }
  if (!mapping.name || !mapping.phone) return NextResponse.json({ error: await tr("নাম আর মোবাইল নম্বরের কলাম লাগবে") }, { status: 400 });

  let created = 0, updated = 0, skipped = 0;
  let room = activePlan(shop) === "free" ? FREE_CUSTOMER_CAP - (await db.customer.count({ where: { shopId: shop.id } })) : Infinity;
  for (const r of valid) {
    const existing = await db.customer.findUnique({ where: { shopId_phone: { shopId: shop.id, phone: r.phone! } } });
    if (!existing && room <= 0) { skipped++; continue; }
    if (!existing) room--;
    const c = existing
      ? await db.customer.update({ where: { id: existing.id }, data: { name: r.name, email: r.email ?? existing.email, area: r.area ?? existing.area } })
      : await db.customer.create({ data: { shopId: shop.id, name: r.name, phone: r.phone!, email: r.email, area: r.area, source: "excel" } });
    existing ? updated++ : created++;
    // Past purchases from the sheet become one summary order so segments work right away
    if (r.total > 0 && !existing) {
      await db.order.create({ data: { customerId: c.id, amount: r.total, items: shop.language === "bn" ? `Excel থেকে (${r.count > 1 ? r.count + "টি Order" : "আগের কেনাকাটা"})` : `From Excel (${r.count > 1 ? r.count + " orders" : "past purchases"})`, orderedAt: r.last ?? new Date() } });
    }
  }
  return NextResponse.json({ created, updated, skipped });
}
