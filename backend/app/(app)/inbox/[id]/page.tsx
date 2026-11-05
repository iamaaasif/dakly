import { notFound } from "next/navigation";
import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { thread, markRead, windowOpen, WINDOW_MS } from "@/lib/inbox";
import { getLoc } from "@/lib/i18n/server";
import { channelConfig } from "@/lib/config";
import { aiEnabled } from "@/lib/ai";
import { ChatBox, ContactButtons } from "@/components/Chat";

export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { shop } = await requireShop();
  const c = await db.customer.findFirst({ where: { id, shopId: shop.id } });
  if (!c) notFound();
  const { t, f } = await getLoc();
  await markRead(shop, c.id);
  const { messages } = await thread(shop.id, c.id, { limit: 100 });
  const open = windowOpen(c);
  const cfg = channelConfig(shop);
  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="av" style={{ width: 44, height: 44 }}>{c.name.slice(0, 1)}</div>
        <div style={{ minWidth: 160, flex: 1 }}>
          <h2 style={{ fontSize: 20 }}><Link href={`/customers/${c.id}`}>{c.name}</Link></h2>
          <p className="muted num">{f.phone(c.phone)}</p>
        </div>
        <ContactButtons phone={c.phone} customerId={c.id} />
      </div>
      <p className="muted">{open ? t("চ্যাট খোলা: {d} পর্যন্ত যেকোনো Message পাঠাতে পারবেন।", { d: f.dt(new Date(c.lastInboundAt!.getTime() + WINDOW_MS)) }) : t("Customer গত ২৪ ঘণ্টায় Message দেননি, তাই WhatsApp-এর নিয়মে Template দিয়ে যাবে (মাসের Message সীমায় গোনা হবে)।")}</p>
      <div className="thread" style={{ maxWidth: 760 }}>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.direction === "in" ? "them" : "me"}`}>
            {m.body}
            <small>{m.channel === "sms" ? "SMS · " : m.kind === "campaign" ? "Campaign · " : m.kind === "template" ? "Template · " : m.kind === "call" ? "" : ""}{f.dt(m.createdAt)}{m.direction === "out" && m.kind !== "call" ? ` · ${t(m.status)}` : ""}{m.error ? ` · ${m.error}` : ""}</small>
          </div>
        ))}
        {!messages.length && <div className="empty">{t("এখনো কোনো Message নেই।")}</div>}
      </div>
      <ChatBox customerId={c.id} open={open} optedOut={c.optedOut} ai={aiEnabled()} smsReady={!!cfg.sms} />
    </>
  );
}
