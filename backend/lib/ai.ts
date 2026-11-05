import "server-only";

import { openaiKey } from "./config";

const KEY = openaiKey;
export const aiEnabled = () => KEY().length > 0;
const MODEL = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function chat(system: string, user: string, json = false): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL(),
      temperature: 0.9,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

import { COUNTRIES, LANGS, isLang, type Lang } from "./i18n";
import { knowledgeContext, kbPrompt } from "./knowledge";
import { db } from "./db";

type ShopCtx = { id?: string; name: string; language?: string | null; country?: string | null };
const kbFor = async (s: ShopCtx, query: string) => (s.id ? kbPrompt(await knowledgeContext(s.id, query)) : "");
const langOf = (s: ShopCtx): Lang => (isLang(s.language) ? s.language : "bn");
const where = (s: ShopCtx) => COUNTRIES[s.country ?? "BD"]?.name ?? s.country ?? "Bangladesh";

const STYLE_BN =
  "তুমি বাংলাদেশের একটি ছোট অনলাইন দোকানের Marketing সহকারী। স্বাভাবিক, আন্তরিক বাংলায় লেখো, যেখানে দরকার ইংরেজি শব্দ (Offer, Order, Delivery, Collection) রাখো, যেমন বাংলাদেশের Facebook Seller-রা লেখেন। বানানো দাম বা ছাড় যোগ কোরো না যদি না বলা থাকে।";
const styleFor = (s: ShopCtx) => {
  const l = langOf(s);
  if (l === "bn") return STYLE_BN;
  return `You are the marketing assistant of a small online shop in ${where(s)}. Write in ${LANGS[l].ai}, warm and natural, the way small social-media sellers there talk to customers. Use local currency and local customs. Never invent prices or discounts that were not given.`;
};

const SEG_HINT: Record<string, string> = {
  inactive: "এরা অনেকদিন কেনেননি। উষ্ণভাবে মনে করিয়ে দাও, ফিরে আসার কারণ দাও (Winback)।",
  vip: "এরা সবচেয়ে মূল্যবান Customer। সম্মান দেখাও, Exclusive অনুভূতি দাও।",
  new: "এরা সম্প্রতি প্রথমবার কিনেছেন। ধন্যবাদ দাও, দ্বিতীয়বার কেনায় উৎসাহ দাও।",
  regular: "এরা নিয়মিত Customer। নতুন কিছু জানাও।",
  all: "সব Customer।",
};
const SEG_HINT_EN: Record<string, string> = {
  inactive: "They have not bought for a long time. Remind them warmly and give a reason to come back (win-back).",
  vip: "Your most valuable customers. Show appreciation and make it feel exclusive.",
  new: "They bought for the first time recently. Thank them and encourage a second purchase.",
  regular: "Regular customers. Tell them something new.",
  all: "All customers.",
};

/** Name / product placeholders in the shop's language. Both forms always work when sending. */
export const placeholders = (s: ShopCtx) => (langOf(s) === "bn" ? { name: "{নাম}", product: "{পণ্য}" } : { name: "{name}", product: "{product}" });

/** Writes a short campaign message in the shop's language, with a name placeholder. */
export async function writeCampaignMessage(shop: ShopCtx, opts: { segment: string; offer: string; channel: "text" | "voice" }) {
  if (!aiEnabled()) return fallbackMessage(shop, opts);
  const voice = opts.channel === "voice";
  const ph = placeholders(shop).name;
  const kb = await kbFor(shop, opts.offer);
  if (langOf(shop) === "bn")
    return chat(
      STYLE_BN + kb,
      `দোকান: ${shop.name}\nCustomer দল: ${SEG_HINT[opts.segment] ?? ""}\nকী জানাতে চাই: ${opts.offer || "নতুন Collection"}\n\n` +
        (voice
          ? "একটা ফোন কলের Script লেখো, ২০-৩০ সেকেন্ড পড়তে লাগবে। শুরুতে {নাম} দিয়ে সম্বোধন করো, দোকানের নাম বলো, Offer বলো, শেষে বলো \"আগ্রহী হলে ১ চাপুন\"। কোনো Emoji বা লিংক নয়।"
          : "WhatsApp/SMS Message লেখো, ৩০০ অক্ষরের মধ্যে। {নাম} দিয়ে সম্বোধন করো। সর্বোচ্চ ২টি Emoji। শুধু Message-টা দাও, আর কিছু নয়।")
    );
  return chat(
    styleFor(shop) + kb,
    `Shop: ${shop.name}\nAudience: ${SEG_HINT_EN[opts.segment] ?? ""}\nWhat to say: ${opts.offer || "new collection"}\n\n` +
      (voice
        ? `Write a phone call script that takes 20-30 seconds to read. Greet the customer with ${ph}, say the shop name, give the offer, and end with "press 1 if you are interested" (in the same language). No emoji, no links.`
        : `Write a WhatsApp/SMS message under 300 characters. Address the customer with ${ph}. At most 2 emoji. Return only the message.`)
  );
}

function fallbackMessage(shop: ShopCtx, o: { segment: string; offer: string; channel: string }) {
  if (langOf(shop) !== "bn") {
    const offer = o.offer || "Our new collection is here";
    if (o.channel === "voice") return `Hello {name}, this is ${shop.name}. ${offer}. If you are interested, press 1 and we will send you the details on WhatsApp. Thank you.`;
    if (o.segment === "inactive") return `Hi {name}, we miss you! ${offer}. A special discount is waiting for you. - ${shop.name}`;
    if (o.segment === "vip") return `Dear {name}, you are one of our VIP customers. ${offer}, for you first. - ${shop.name}`;
    return `{name}, ${offer}. Reply if you would like to see it. - ${shop.name}`;
  }
  const offer = o.offer || "নতুন Collection এসেছে";
  if (o.channel === "voice")
    return `আসসালামু আলাইকুম {নাম}, ${shop.name} থেকে বলছি। ${offer}। আগ্রহী হলে ১ চাপুন, আমরা আপনাকে WhatsApp-এ বিস্তারিত পাঠাব। ধন্যবাদ।`;
  if (o.segment === "inactive") return `আসসালামু আলাইকুম {নাম}, অনেকদিন দেখা নেই! ${offer}। আপনার জন্য রইল বিশেষ ছাড়। — ${shop.name}`;
  if (o.segment === "vip") return `প্রিয় {নাম}, আপনি আমাদের VIP Customer। ${offer}, সবার আগে আপনার জন্য। — ${shop.name}`;
  return `{নাম}, ${offer}। দেখতে চাইলে Reply দিন। — ${shop.name}`;
}

export async function writeFacebookPost(shop: ShopCtx, opts: { prompt: string; tone: string }) {
  const bn = langOf(shop) === "bn";
  if (!aiEnabled())
    return bn
      ? `✨ ${opts.prompt}\n\n${shop.name}-এ এখন পাওয়া যাচ্ছে। সারা দেশে Cash on Delivery।\n\n📩 Order করতে Inbox করুন অথবা Comment-এ লিখুন "দাম"।`
      : `✨ ${opts.prompt}\n\nAvailable now at ${shop.name}.\n\n📩 Message us or comment "price" to order.`;
  const kb = await kbFor(shop, opts.prompt);
  if (bn)
    return chat(
      STYLE_BN + kb,
      `দোকান: ${shop.name}\nকী Promote করব: ${opts.prompt}\nধরন: ${opts.tone}\n\nএকটা Facebook Page Post লেখো। প্রথম লাইন চোখে পড়ার মতো, ৩-৫টা ছোট লাইন, কয়েকটা Emoji, শেষে Order করার Call to action (Inbox/Comment)। ২-৩টা প্রাসঙ্গিক Hashtag। শুধু Post-টা দাও।`
    );
  return chat(
    styleFor(shop) + kb,
    `Shop: ${shop.name}\nPromote: ${opts.prompt}\nTone: ${TONE_EN[opts.tone] ?? opts.tone}\n\nWrite a Facebook Page post. Eye-catching first line, 3-5 short lines, a few emoji, and a call to action to order (message or comment) at the end. 2-3 relevant hashtags. Return only the post.`
  );
}
const TONE_EN: Record<string, string> = { "বন্ধুসুলভ": "friendly", "Offer-কেন্দ্রিক": "offer-focused", "মজার": "fun", "আবেগী": "emotional" };

/**
 * Suggests the shop's next WhatsApp reply in a conversation, using the knowledge base,
 * the customer's orders and the last messages. The owner reviews it before sending.
 */
export async function suggestReply(shop: ShopCtx & { id: string; currency?: string }, customerId: string) {
  const [c, history] = await Promise.all([
    db.customer.findFirst({ where: { id: customerId, shopId: shop.id }, include: { orders: { orderBy: { orderedAt: "desc" }, take: 5 } } }),
    db.chatMessage.findMany({ where: { shopId: shop.id, customerId }, orderBy: { createdAt: "desc" }, take: 16 }),
  ]);
  if (!c) throw new Error("customer not found");
  const lastIn = history.find((m) => m.direction === "in")?.body ?? "";
  const kb = await kbFor(shop, history.slice(0, 4).map((m) => m.body).join(" "));
  const convo = [...history].reverse().map((m) => `${m.direction === "in" ? "Customer" : "Shop"}: ${m.body}`).join("\n");
  const orders = c.orders.map((o) => `${o.orderedAt.toISOString().slice(0, 10)} ${o.items ?? "order"} ${o.amount} ${shop.currency ?? ""}`).join("; ");
  if (!aiEnabled())
    return langOf(shop) === "bn" ? `জি ${c.name.split(" ")[0]}, ধন্যবাদ! একটু দেখে জানাচ্ছি।` : `Hi ${c.name.split(" ")[0]}, thank you! Let me check and get back to you.`;
  const lang = LANGS[langOf(shop)].ai;
  return chat(
    (langOf(shop) === "bn" ? STYLE_BN : styleFor(shop)) + kb +
      `\n\nYou are replying on WhatsApp for the shop, to one customer. Reply in the customer's language if they wrote in another language, otherwise in ${lang}. Be short (1-3 sentences), helpful and specific. Answer only from the shop knowledge and order history; if you do not know (price, stock, delivery time), say you will check. No markdown.`,
    `Customer: ${c.name}\nPast orders: ${orders || "none"}\n\nConversation:\n${convo || "(no messages yet)"}\n\nLast customer message: ${lastIn || "(none, write a friendly opener)"}\n\nWrite the shop's next reply only.`
  );
}

/** Speech to text for voice input, in the shop's language. */
export async function transcribe(audio: Blob, filename: string, lang: string = "bn") {
  const fd = new FormData();
  fd.append("file", audio, filename);
  fd.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe");
  fd.append("language", isLang(lang) ? lang : "bn");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${KEY()}` }, body: fd,
  });
  if (!res.ok) throw new Error(`Transcription failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return String((await res.json()).text ?? "");
}

export type ParsedCustomer = { name: string; phone: string; items: string; amount: number | null };

/** Pulls name, phone, items and amount out of a spoken Bangla sentence. */
export async function parseCustomerSpeech(text: string, country = "BD"): Promise<ParsedCustomer> {
  const out = await chat(
    `Extract a customer record from a shop owner's spoken note. The shop is in ${COUNTRIES[country]?.name ?? country}; the note may be in any language or mixed (e.g. Bangla/Banglish). Convert spoken numbers (e.g. 'জিরো ওয়ান সেভেন', 'বত্রিশশো', 'three thousand two hundred') to digits. Return JSON {"name":string,"phone":string (digits only, as the owner said it; keep a leading + and country code if spoken),"items":string,"amount":number|null}.`,
    text,
    true
  );
  const j = JSON.parse(out);
  return { name: String(j.name ?? ""), phone: String(j.phone ?? ""), items: String(j.items ?? ""), amount: j.amount == null ? null : Number(j.amount) };
}

/** Text to speech (mp3) for AI voice calls, in the shop's language. */
/** Speech for a call. "mp3" for Twilio; "pcm" is raw 24 kHz 16-bit mono, which Asterisk plays as .sln24. */
export async function speak(text: string, lang: string = "bn", format: "mp3" | "pcm" = "mp3"): Promise<ArrayBuffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "coral",
      input: text,
      instructions: lang === "bn" ? "Speak in warm, natural Bangladeshi Bangla, like a friendly shop assistant on the phone. Moderate pace." : `Speak in warm, natural ${LANGS[isLang(lang) ? lang : "en"].name}, like a friendly shop assistant on the phone. Moderate pace.`,
      response_format: format,
    }),
  });
  if (!res.ok) throw new Error(`TTS failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.arrayBuffer();
}
