import { db } from "@/lib/db";
import { validAsteriskSig } from "@/lib/channels/voice";

const FAILED: Record<string, string> = { BUSY: "Call busy", NOANSWER: "Call no-answer", CONGESTION: "Call failed (network)", CHANUNAVAIL: "Call failed (trunk unavailable)", CANCEL: "Call canceled" };

/**
 * Call progress from Dakly's Asterisk (deploy/asterisk/extensions.conf):
 *   event=answered            the customer picked up
 *   event=digit&digit=1       the key they pressed (empty = none)
 *   event=status&status=BUSY  nobody answered; status is Asterisk's DIALSTATUS
 * Each request carries sig, an HMAC of the message id that only Dakly can make.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("m") || "";
  if (!validAsteriskSig(id, q.get("sig"))) return new Response("Bad signature", { status: 403 });
  const m = await db.campaignMessage.findUnique({ where: { id }, select: { id: true, status: true, channel: true } });
  if (!m || m.channel !== "voice") return new Response("ok");
  const event = q.get("event");
  if (event === "digit" && q.get("digit") === "1") {
    await db.campaignMessage.update({ where: { id }, data: { status: "interested", error: null } });
  } else if (m.status === "interested") {
    // keep it
  } else if (event === "answered" || event === "digit") {
    await db.campaignMessage.update({ where: { id }, data: { status: "delivered", error: null } });
  } else if (event === "status") {
    const s = (q.get("status") || "").toUpperCase();
    await db.campaignMessage.update({ where: { id }, data: { status: "failed", error: FAILED[s] || `Call ${s.toLowerCase() || "failed"}` } });
  }
  return new Response("ok");
}

export const POST = GET;
