import crypto from "node:crypto";
import { db } from "@/lib/db";
import { channelConfig, env } from "@/lib/config";
import { isStopMessage } from "@/lib/i18n";
import { receiveWhatsApp } from "@/lib/inbox";
import { logError } from "@/lib/audit";

/** Meta webhook verification */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && env("WA_VERIFY_TOKEN") && p.get("hub.verify_token") === env("WA_VERIFY_TOKEN"))
    return new Response(p.get("hub.challenge") ?? "");
  return new Response("Forbidden", { status: 403 });
}

const RANK: Record<string, number> = { queued: 0, sending: 0, test: 0, sent: 1, delivered: 2, read: 3, interested: 4, failed: 5 };

/** Delivery/read receipts, incoming messages (inbox) and STOP replies (any language) for WhatsApp */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = env("WA_APP_SECRET");
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") || "";
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new Response("Bad signature", { status: 403 });
  } else if (process.env.NODE_ENV === "production") {
    return new Response("WA_APP_SECRET not set", { status: 503 });
  }
  let body: { entry?: Array<{ changes?: Array<{ value?: Record<string, any> }> }> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = JSON.parse(raw || "{}"); } catch { return new Response("Bad JSON", { status: 400 }); }

  for (const entry of body.entry ?? [])
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      for (const s of v.statuses ?? []) {
        const chat = await db.chatMessage.findFirst({ where: { providerId: s.id, direction: "out" } });
        if (chat && ((RANK[s.status] ?? 0) > (RANK[chat.status] ?? 0) || s.status === "failed"))
          await db.chatMessage.update({ where: { id: chat.id }, data: { status: s.status, error: s.errors?.[0]?.title ?? null } });
        const m = await db.campaignMessage.findFirst({ where: { providerId: s.id } });
        if (!m) continue;
        const next = s.status === "failed" ? "failed" : s.status;
        if ((RANK[next] ?? 0) > (RANK[m.status] ?? 0) || next === "failed")
          await db.campaignMessage.update({ where: { id: m.id }, data: { status: next, error: s.errors?.[0]?.title ?? null } });
      }
      for (const msg of v.messages ?? []) {
        const text = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "";
        const kind = msg.type === "text" || msg.type === "button" || msg.type === "interactive" ? "text" : String(msg.type ?? "text");
        const label = text || (msg.image?.caption ? `📷 ${msg.image.caption}` : `[${kind}]`);
        const name = v.contacts?.find((c: { wa_id?: string }) => c.wa_id === msg.from)?.profile?.name ?? null;
        let got: Awaited<ReturnType<typeof receiveWhatsApp>> = null;
        try { got = await receiveWhatsApp(String(v.metadata?.phone_number_id ?? ""), String(msg.from), name, label, String(msg.id), kind); }
        catch (e) { await logError("whatsapp", e); }
        if (!isStopMessage(text)) continue;
        if (got) await db.customer.update({ where: { id: got.customerId }, data: { optedOut: true } });
        // Opt the sender out of every shop that messages them from this WhatsApp number
        const customers = await db.customer.findMany({ where: { phone: String(msg.from) }, include: { shop: true } });
        for (const c of customers)
          if ((c.shop.waPhoneNumberId ?? channelConfig(c.shop).wa?.phoneNumberId) === v.metadata?.phone_number_id)
            await db.customer.update({ where: { id: c.id }, data: { optedOut: true } });
      }
    }
  return new Response("ok");
}
