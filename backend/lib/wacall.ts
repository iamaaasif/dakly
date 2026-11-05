/**
 * "Call us on WhatsApp": customers call the shop's WhatsApp number from their own app.
 * These calls are free for the customer and the shop (WhatsApp only charges for calls a
 * business starts). The link opens the shop's chat, where the call button is.
 */
export const waCallLink = (number: string) => `https://wa.me/${number.replace(/\D/g, "")}`;

/** The line added to SMS campaigns when the shop turns it on. */
export const waCallSmsLine = (number: string, lang: string) =>
  `\n${lang === "bn" ? "WhatsApp-এ ফ্রি কল" : "Call free on WhatsApp"}: ${waCallLink(number).replace("https://", "")}`;

/** A floating green button for the shop's own website (Shopify, WooCommerce or any HTML page). */
export function waCallButtonHtml(number: string, label: string) {
  const safe = label.replace(/[<>&"]/g, "");
  return `<a href="${waCallLink(number)}" target="_blank" rel="noopener" aria-label="${safe}" style="position:fixed;right:18px;bottom:18px;z-index:9999;display:flex;align-items:center;gap:8px;padding:12px 18px;border-radius:999px;background:#25D366;color:#fff;font:600 15px/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.25)"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>${safe}</a>`;
}
