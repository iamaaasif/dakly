import { db } from "@/lib/db";
import { validTwilioSignature } from "@/lib/channels/voice";
import { appUrl, env } from "@/lib/config";
import { decrypt } from "@/lib/crypto";
import { isStopMessage, normalizePhone } from "@/lib/i18n";

/**
 * Incoming SMS on a Twilio number (set it as the number's "A message comes in" webhook):
 * STOP and similar words opt the sender out of every shop that sends from that number.
 */
export async function POST(req: Request) {
  const params = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const to = params.To || "";
  const own = await db.shop.findMany({ where: { twilioFrom: to } });
  const tokens = [env("TWILIO_AUTH_TOKEN"), ...own.map((s) => decrypt(s.twilioToken))].filter(Boolean) as string[];
  const url = appUrl() + "/api/webhooks/twilio-sms";
  if (!tokens.some((t) => validTwilioSignature(t, url, params, req.headers.get("x-twilio-signature")))) return new Response("Bad signature", { status: 403 });
  const from = normalizePhone(params.From || "");
  if (from && isStopMessage(params.Body || "")) {
    const platform = to === env("TWILIO_SMS_FROM") || to === env("TWILIO_FROM");
    await db.customer.updateMany({ where: { phone: from, OR: [{ shopId: { in: own.map((s) => s.id) } }, ...(platform ? [{ shop: { twilioFrom: null } }] : [])] }, data: { optedOut: true } });
  }
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { headers: { "Content-Type": "text/xml" } });
}
