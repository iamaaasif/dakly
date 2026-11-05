import { notFound } from "next/navigation";
import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLoc } from "@/lib/i18n/server";
import { personalize } from "@/lib/send";

const ST: Record<string, string> = { queued: "অপেক্ষায়", sending: "যাচ্ছে", sent: "পাঠানো", delivered: "পৌঁছেছে", read: "পড়েছেন", interested: "আগ্রহী", failed: "ব্যর্থ", test: "Test", skipped: "বাদ" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { shop } = await requireShop();
  const c = await db.campaign.findFirst({ where: { id, shopId: shop.id }, include: { messages: { include: { customer: true }, orderBy: { updatedAt: "desc" } } } });
  if (!c) notFound();
  const { t, f } = await getLoc();
  const bn = f.n;
  const count = (...s: string[]) => c.messages.filter((m) => s.includes(m.status)).length;
  const test = count("test");
  return (
    <>
      <div className="greet"><h2>{c.name}</h2><p>{c.status === "scheduled" && c.sendAt ? t("{d}-এ যাবে", { d: f.dt(c.sendAt) }) : c.sentAt ? t("{d}-এ পাঠানো হয়েছে", { d: f.dt(c.sentAt) }) : c.status === "sending" ? t("পাঠানো হচ্ছে… Page Refresh করে দেখুন") : ""}</p></div>
      {test > 0 && <div className="err">{t("{n}টি Message Test mode-এ ছিল, কারণ Channel Connect করা নেই।", { n: test })} <Link href="/settings" style={{ fontWeight: 600 }}>{t("Settings-এ Connect করুন")} →</Link></div>}
      <div className="funnel num">
        <div><b>{bn(count("sent", "delivered", "read", "interested"))}</b><span>{t("পাঠানো")}</span></div>
        <div><b>{bn(count("delivered", "read", "interested"))}</b><span>{t("পৌঁছেছে")}</span></div>
        <div><b>{bn(count("read", "interested"))}</b><span>{c.channels.some((x) => x === "voice" || x === "call" || x === "wacall") ? t("আগ্রহী") : t("পড়েছেন")}</span></div>
      </div>
      <div className="grid2">
        <div className="list">
          {c.messages.map((m) => (
            <Link key={m.id} className="row" href={`/customers/${m.customerId}`}>
              <div className="av">{m.customer.name.slice(0, 1)}</div>
              <div style={{ minWidth: 0 }}><div className="nm">{m.customer.name}</div><div className="meta num">{f.phone(m.customer.phone)} · {m.channel.toUpperCase()}{m.error ? ` · ${t(m.error)}` : ""}</div></div>
              <span className={`badge b-${m.status}`}>{t(ST[m.status] ?? m.status)}</span>
            </Link>
          ))}
          {!c.messages.length && <div className="empty">{t("Schedule করা সময়ে Customer তালিকা তৈরি হবে।")}</div>}
        </div>
        <div className="wa"><div className="wa-h">{t("যা পাঠানো হয়েছে")}</div><div className="bubble">{personalize(c.message, c.messages[0]?.customer.name ?? "{name}", null, t("আমাদের নতুন Collection"))}</div></div>
      </div>
    </>
  );
}
