import { db } from "@/lib/db";
import { validTwilioSignature } from "@/lib/channels/voice";
import { appUrl, channelConfig } from "@/lib/config";

const twiml = (body: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });

/** Key presses (Gather) and call status callbacks from Twilio. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("m") || "";
  const params = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const m = await db.campaignMessage.findUnique({ where: { id }, include: { campaign: { include: { shop: true } } } });
  if (!m) return twiml("");
  const token = channelConfig(m.campaign.shop).voice?.token || "";
  const publicUrl = appUrl() + url.pathname + url.search;
  if (!validTwilioSignature(token, publicUrl, params, req.headers.get("x-twilio-signature"))) return new Response("Bad signature", { status: 403 });

  if (url.searchParams.get("kind") === "status") {
    const s = params.CallStatus;
    if (m.status !== "interested") {
      const status = s === "completed" ? "delivered" : ["busy", "failed", "no-answer", "canceled"].includes(s) ? "failed" : m.status;
      await db.campaignMessage.update({ where: { id }, data: { status, error: status === "failed" ? `Call ${s}` : null } });
    }
    return new Response("ok");
  }
  if (params.Digits === "1") {
    await db.campaignMessage.update({ where: { id }, data: { status: "interested" } });
    return twiml(`<Play>${appUrl()}/api/voice/audio/${id}?part=thanks</Play><Hangup/>`);
  }
  return twiml("<Hangup/>");
}
