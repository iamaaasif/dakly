import type { ChannelConfig } from "../config";
type WA = NonNullable<ChannelConfig["wa"]>;

/**
 * Sends a marketing message through the WhatsApp Cloud API.
 * Marketing messages outside a 24-hour chat window must use an approved template.
 * Dakly expects a template whose body has two variables: {{1}} = customer name, {{2}} = message text.
 */
export async function sendWhatsApp(cfg: WA, to: string, name: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: cfg.template,
        language: { code: cfg.lang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              // Template variables cannot contain new lines, tabs or 4+ spaces
              { type: "text", text: text.replace(/\s*\n+\s*/g, " ").replace(/\s{4,}/g, " ").slice(0, 1000) },
            ],
          },
        ],
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `WhatsApp error ${res.status}`);
  return String(data.messages?.[0]?.id ?? "");
}

/** Free-form text reply. Only allowed within 24 hours of the customer's last message. */
export async function sendWhatsAppText(cfg: WA, to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: text.slice(0, 4096) } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `WhatsApp error ${res.status}`);
  return String(data.messages?.[0]?.id ?? "");
}

/** Tells WhatsApp the customer's message was read (blue ticks). */
export async function markWhatsAppRead(cfg: WA, waMessageId: string) {
  await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: waMessageId }),
  }).catch(() => undefined);
}
