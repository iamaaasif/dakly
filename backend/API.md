# Dakly API (v1)

JSON API for the Dakly Android app. Base URL: `https://APP_URL/api/v1`.

## Conventions

- **Auth.** Send `Authorization: Bearer <token>`. Tokens come from `/auth/login` or `/auth/register` and last 60 days. Call `POST /auth/refresh` on app start to get a fresh one.
- **Language.** Send `Accept-Language: bn` or `en`. Error messages and server-made text (greeting, notifications, tip text) come back in that language. AI-written text (messages, posts, replies, daily tips) is in the shop's `language`.
- **Errors.** Errors are `{ "error": "<human message>", "code": "<stable code>" }`. The codes are:

  | HTTP | code | Meaning |
  | --- | --- | --- |
  | 400 | `invalid` | The request is not valid |
  | 401 | `unauthorized` | No token, or a bad or expired token |
  | 401 | `bad_credentials` | Wrong email or password |
  | 403 | `pending` | The shop is not approved yet |
  | 403 | `suspended` | The shop is suspended |
  | 404 | `not_found` | Nothing with that id |
  | 429 | `limit_reached` | Monthly message or AI limit reached (AI writing now returns 429, it was 400) |
  | 429 | `rate_limited` | Too many requests; wait `Retry-After` seconds. Also returned by login after 8 wrong passwords (15 min lock) |
  | 400 | `opted_out` | The customer sent STOP |
  | 502 | `provider_error` | WhatsApp, SMS or Twilio refused |
  | 503 | `payments_unavailable` | Online payments are not set up |
- **Money.** Amounts are integers in whole units of the shop's `currency`, for example `1250` with `"currency":"BDT"`. Format them on the device. Plan prices carry their own `{ amount, currency }`.
- **Dates.** Dates are ISO 8601 in UTC. Show them in the shop's `timezone`.
- **Phones.** Phones are international digits without `+`, for example `8801712345678`. When you send a phone number, local formats are read in the shop's country. Both `01712-345678` and `+8801712345678` work for Bangladesh.
- **Shop locale.** `country`, `currency`, `timezone` and `language` come back in `/me`, `/settings`, `/dashboard` and the customer list.
- **Pending or suspended shops.** These get `403` everywhere except `/me`, `/status`, `/auth/refresh` and `DELETE /me`.

## Changes in 1.0.0 (release)

- `GET /me` adds `onboarding: { done, progress, total, steps: [{ key, label, done, href, required }] }`. Show the checklist on Home until `done`.
- New: `POST /auth/reset`, `POST /auth/password`, `GET /customers/export`. `POST /auth/logout` now revokes the token.
- Tokens are revoked after a password change or reset, logout, or when an admin disables the login: on any `401`, send the user to the login screen.
- New error code `rate_limited` (429, with `Retry-After`): about 120 API calls per minute per account; sign-up and forgot-password per IP. For local app test runs set `API_RATE_LIMIT_PER_MIN` (e.g. 2000) on the server; leave it unset in production.
- AI limit errors are `429 limit_reached` (were 400). Adding an order for an unknown customer is `404`.
- `messagesLeft` in `/campaigns/audience` is always a number. An admin limit of 0 now means "no messages" (it used to mean unlimited).
- `GET /billing` payments carry `invoiceUrl`.

## Auth and account

| Method and path | Body | Returns |
| --- | --- | --- |
| `POST /auth/register` | `{ name, shop, email, password (8+), country?: "BD", language?: "bn"\|"en" }` | `201 { token }`. Currency, time zone and language default from the country. |
| `POST /auth/login` | `{ email, password }` | `{ token, expiresInDays, user, shop: { id, name, status, country, currency, timezone, language } }` |
| `POST /auth/refresh` | | `{ token, expiresInDays }` |
| `POST /auth/logout` | | `{ ok }`. The token is revoked on the server; delete it on the device too. |
| `POST /auth/reset` | `{ token, password (8+) }` (token from the emailed `/reset?token=` link) | `{ token, expiresInDays }`. Signs in; every older token stops working. |
| `POST /auth/password` | `{ current, password (8+) }` | `{ token, expiresInDays }`. Other devices are signed out; store the new token. |
| `POST /auth/forgot` | `{ email }` | `{ ok, message }`. Always 200, and sends a reset email. |
| `GET /status` | | `{ status: "active"\|"pending"\|"suspended", reason }` |
| `GET /me` | | `{ user: { id, name, email, uiLang }, shop: { ..., status, brandVoice }, plan: { key, name, until, price, messages: { used, limit }, ai: { used, limit } }, channels: { whatsapp, sms: "gateway"\|"twilio"\|null, voice, facebookPage, store } }` |
| `PATCH /me` | `{ name?, uiLang?: "bn"\|"en"\|null }` | `{ ok }` |
| `DELETE /me` | `{ password }` | `{ deleted: true }`. Permanently deletes the shop and all its data, then the login. |

## Dashboard and insights

`GET /dashboard` returns:

```json
{
  "country", "currency", "timezone", "language", "greeting",
  "kpi": { "sales30", "salesPrev30", "orders30", "avgOrder", "repeatShare", "returnedThisMonth",
           "repeatSalesThisMonth", "customers", "active", "campaignRevenue" },
  "weeks": [{ "start", "fresh", "repeat" }],
  "segments": { "vip", "regular", "new", "inactive" },
  "campaigns": [{ "id", "name", "sentAt", "recipients", "read", "buyers", "revenue" }],
  "aiTips": { "tips": [{ "title", "body", "segment", "offer", "why" }], "source": "ai"|"rules" } | null,
  "notifications": [{ "key", "tone", "icon", "title", "body", "action": { "label", "href" } }],
  "bestTime": { "hour", "label" },
  "inboxUnread": 0,
  "messagesThisMonth": { "used", "limit" }
}
```

`weeks` has 12 entries. A week starts on Saturday in BD and the Gulf, Sunday in the US and Canada, and Monday elsewhere.

`GET /insights?refresh=1` returns `{ aiTips: { tips: [{ ..., campaignHref }], source }, notifications }`. `refresh=1` makes the tips again, and that counts toward the AI limit. To open a campaign from a tip, prefill the wizard with `segment` and `offer`.

`POST /insights/dismiss` takes `{ key }` and returns `{ ok, until }`. It hides the notification for 3 days.

## Customers

| Method and path | Body / query | Returns |
| --- | --- | --- |
| `GET /customers` | `?q=&segment=vip\|regular\|new\|inactive&sort=total\|recent\|name&page=1&pageSize=50` | `{ country, currency, ..., total, page, pageSize, hasMore, items: [{ id, name, phone, email, area, createdAt, optedOut, segment, stats: { total, count, first, last } }] }` |
| `POST /customers` | `{ name, phone, items?, amount?, area?, source?: "manual"\|"voice" }` | `201 { id, name }`. If the phone number already exists, that customer is updated. |
| `GET /customers/:id` | | Customer with `orders[]`, `segment`, `total`, `chatWindowOpen`, `recommendation: { product, reason } \| null`, plus shop locale |
| `PATCH /customers/:id` | `{ name?, area?, email?, note?, optedOut? }` | `{ ok }` |
| `DELETE /customers/:id` | | `{ ok }` |
| `POST /customers/:id/orders` | `{ amount, items? }` | `201 { id }` |
| `POST /customers/:id/calls` | `{ how: "phone"\|"whatsapp", durationSec?, note? }` | `201 { id }`. Logs a call made from the phone into the conversation. |
| `GET /customers/export` | | CSV file (UTF-8 with BOM, opens in Excel) of all customers. |
| `POST /customers/import` | multipart `file` (.xlsx/.csv, max 5 MB). Add `?dry=1` to preview. | Preview: `{ rows, mapping: { name, phone, total, last, count, email, area }, sample, invalid }`. Import: `{ created, updated, skipped }`. |
| `POST /customers/voice` | multipart `audio` (webm/mp4/m4a/ogg, max 10 MB) | `{ text, parsed: { name, phone, items, amount } }`. Show it to the user, then `POST /customers`. |

To call or WhatsApp a customer, the app uses `tel:+<phone>` and `https://wa.me/<phone>` intents, then calls `POST /customers/:id/calls` to log it.

## Campaigns

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /campaigns/audience` | | `{ counts: { vip, regular, new, inactive, all }, channels: { wa, sms, voice, voiceAllowedOnPlan }, messagesLeft, bestTime: { hour, label, nextAt }, placeholders: { name, product } }` |
| `POST /ai/message` | `{ segment, offer, channel: "text"\|"voice" }` | `{ text, ai }`. Uses the knowledge base. Counts toward the AI limit. |
| `GET /campaigns` | | `{ items: [{ id, name, segment, channels, status, sendAt, sentAt, recipients, ... }] }` |
| `POST /campaigns` | `{ name?, segment, message, channels: ["wa","sms"] or ["voice"], when: "now"\|"later", sendAt? (ISO) }` | `201 { id }` |
| `GET /campaigns/:id` | | Campaign with `messages[{ id, channel, status, error, updatedAt, customer }]` and `summary: { sent, delivered, read, interested, failed, test, skipped }` |

A message can use `{name}` or `{নাম}`, and `{product}` or `{পণ্য}`, in either language.

Status values:
- Campaign: `draft`, `scheduled`, `queuing`, `sending`, `sent`.
- Message: `queued`, `sending`, `sent`, `delivered`, `read`, `interested`, `failed`, `test`, `skipped`.

## Facebook posts

| Method and path | Body | Returns |
| --- | --- | --- |
| `POST /ai/post` | `{ prompt, tone: "বন্ধুসুলভ"\|"Offer-কেন্দ্রিক"\|"মজার"\|"আবেগী" }` | `{ text, ai }`. The tones mean friendly, offer-focused, fun and emotional. |
| `GET /posts` | | `{ items: [{ id, text, status, scheduledAt, publishedAt, error }] }` |
| `POST /posts` | `{ text, at (ISO), prompt? }` | `201 { id }` |
| `DELETE /posts/:id` | | `{ ok }`. Cancels a scheduled post. |

## AI knowledge base

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /knowledge` | `?q=&type=` | `{ currency, brandVoice, items: [{ id, type, title, body, price, active, createdAt, updatedAt }] }` |
| `POST /knowledge` | `{ type: "product"\|"policy"\|"faq"\|"voice"\|"note", title, body?, price?, active? }` | `201 { id }` |
| `GET /knowledge/:id` | | item |
| `PATCH /knowledge/:id` | any of the fields above | `{ id }` |
| `DELETE /knowledge/:id` | | `{ ok }` |

Brand voice is a shop field, set with `PATCH /settings { brandVoice }`. AI messages, posts, call scripts, inbox replies and daily tips all read the active items. The AI is told never to invent prices or policies that are not in the knowledge base.

## WhatsApp inbox

| Method and path | Body / query | Returns |
| --- | --- | --- |
| `GET /inbox` | `?q=&unread=1&before=<nextCursor>&limit=30` | `{ conversations: [{ customer: { id, name, phone, optedOut }, last: { body, direction, channel, kind, status, at }, unread, windowOpen, windowEndsAt }], nextCursor, unreadTotal }` |
| `GET /inbox/:customerId` | `?before=<nextCursor>&limit=50` | `{ customer, windowOpen, windowEndsAt, messages: [ChatMessage] (oldest first), nextCursor }` |
| `POST /inbox/:customerId` | `{ text, channel?: "wa"\|"sms" }` | `201 { id, status, kind }` |
| `POST /inbox/:customerId/read` | | `{ ok }`. Marks the conversation read and sends WhatsApp blue ticks. |
| `POST /inbox/:customerId/suggest` | | `{ text }`. An AI draft from the knowledge base, the customer's orders and the last messages. It is not sent. |

A `ChatMessage` has these fields:

```
{ id, direction: "in"|"out", channel: "wa"|"sms"|"call",
  kind: "text"|"template"|"campaign"|"call"|"image"|"audio"|...,
  body, status: "received"|"sending"|"sent"|"delivered"|"read"|"failed"|"test",
  error, readAt, createdAt }
```

**24-hour window.** WhatsApp only allows free text within 24 hours of the customer's last message (`windowOpen`). Outside the window, `POST /inbox/:id` sends the shop's approved template with the text inside it (`kind: "template"`). Templates and SMS count toward the monthly message limit. Free replies inside the window do not. If the customer sent STOP, you can only reply while the window is open.

**WhatsApp Business Calling.** Server-side WhatsApp calls are not available yet. Use the `wa.me` intent.

## Settings

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /settings` | | `{ profile: { name, country, currency, timezone, language, brandVoice }, channels: { state: { wa, sms, voice } ("own"\|"platform"\|"off"), smsProvider, values, saved }, store: { type, url, syncedAt, error }, facebook: { connected, pageId, pageName }, options: { countries[{ code, name, currency, tz, lang }], languages[{ code, name }], currencies[] } }` |
| `PATCH /settings` | any of `name, country, currency, timezone (IANA), language, brandVoice`, plus the channel fields `waPhoneNumberId, waAccessToken, waTemplateName, waTemplateLang, smsApiUrl, smsApiKey, smsSenderId, twilioSid, twilioToken, twilioFrom`, and `clearChannels: true` | `{ ok }` |
| `POST /settings/store` | `{ storeType: "woocommerce"\|"shopify", storeUrl, storeKey, storeSecret? }` | `{ ok, message }`. Imports customers right away. |
| `POST /settings/store/sync` | | `{ ok, message }` |
| `DELETE /settings/store` | | `{ ok }` |
| `GET /settings/facebook` | | `{ available, connected, page, pages[{ id, name }], connectUrl }` |
| `POST /settings/facebook/page` | `{ pageId }` | `{ ok }` |
| `DELETE /settings/facebook` | | `{ ok }` |

`PATCH /settings` details:
- Changing only `country` also moves `currency` and `timezone` to that country's defaults.
- For secret fields (`waAccessToken`, `smsApiKey`, `twilioToken`), send a value to set it, or leave the field out to keep the saved one.

To connect Facebook, open `connectUrl` in a Custom Tab. It is valid for 5 minutes and works once. After login, the page shows a "Back to Dakly" button that opens `dakly://open?path=/settings`. After that, reload `GET /settings/facebook`. If the account has more than one Page, pick one with `POST /settings/facebook/page`.

## Plans, payments, support

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /billing` | | `{ current, until, plans: [{ key, name, price: { amount, currency }, messages, ai, features[] }], onlinePayments, provider: "sslcommerz"\|"stripe", payments: [{ ..., invoiceUrl }] }`. `invoiceUrl` (paid payments only) is a web path to a printable invoice; open `APP_URL + invoiceUrl` with the Bearer token or in the signed-in browser. |
| `POST /billing/checkout` | `{ plan: "starter"\|"growth", months: 1..12 }` | `{ url }`. Open it in a browser. The server confirms the payment, so reload `/billing` when the user returns. |
| `GET /tickets` | | `{ items: [{ id, subject, status, messages[] }] }` |
| `POST /tickets` | `{ subject, body }` | `201 { id }` |

## Web pages the app can link to

- `/privacy`: the privacy policy, in Bangla and English.
- `/delete-account`: how to delete an account, for the Play Store listing.
- `/.well-known/assetlinks.json`: Android App Links.
