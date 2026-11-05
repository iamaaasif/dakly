# Dakly

Dakly helps small online sellers bring old customers back. It keeps every customer in one place, groups them with AI (VIP, Regular, New, Inactive), sends targeted offers over WhatsApp, SMS or an AI voice call, answers customers in a WhatsApp inbox with AI-drafted replies, writes Facebook posts and publishes them on schedule, and tells the seller what to do next every morning.

Bangladesh is the first market and the default (Bangla UI, ৳, Asia/Dhaka, BD phone numbers, SSLCommerz with bKash/Nagad). Every shop can run in another country, currency, time zone and language.

It is a mobile-first web app (installable PWA) with a desktop layout, an admin back office for the Dakly team at `/admin`, and a JSON API at `/api/v1` for the native Android app (see [API.md](API.md)). Day-to-day running is in [OPERATIONS.md](OPERATIONS.md).

## Features

| Area | What it does |
| --- | --- |
| Customers | Add by Excel/CSV upload (columns matched automatically), by voice (speech to text, then name, phone, items and amount are pulled out), by hand, or by Shopify/WooCommerce sync. Orders per customer. Phone numbers are read in the shop's country and stored in international format. |
| Segments | VIP (15,000+ spent or 8+ orders), Inactive (no order in 60 days), New (first order in 30 days), Regular. Rules in `lib/segments.ts`. |
| Campaigns | Segment, channel, AI-written message with `{name}`/`{নাম}` and `{product}`/`{পণ্য}` (a per-customer product pick), send now or schedule (AI suggests the best hour). Per-customer delivery, read and "interested" status, and sales attributed within 7 days. |
| WhatsApp inbox | Incoming WhatsApp messages land in Inbox. Inside the 24-hour window the seller replies with free text; outside it Dakly sends the approved template. "AI writes a reply" drafts an answer from the knowledge base, the customer's orders and the conversation. Campaign messages show in each conversation too. |
| Calls | AI voice calls through Twilio (Growth plan): OpenAI speaks the script in the shop's language and the customer presses 1 if interested. One-tap "Call" and "WhatsApp call / chat" buttons open the phone's dialer or WhatsApp, and the call is noted in the conversation. |
| AI knowledge | Per-shop products (with price), policies, FAQs, notes and brand voice. Every AI feature reads it and is told not to invent prices or rules. |
| AI daily tips | Every morning (shop's local time) AI reads the shop's numbers, season and knowledge and gives 3 concrete actions, each opening a ready campaign. |
| Facebook posts | AI writes a post from a brief and tone, the seller edits it and schedules it to their Page. |
| Smart notifications | Inactive customers, customers slipping away, new customers this week, top customer reordered, no recent post. |
| Plans and billing | Free, Starter, Growth with monthly message and AI limits. Bangladesh pays through SSLCommerz (bKash, Nagad, Rocket, cards); other countries pay by card through Stripe in USD. |
| Languages | Bangla and English UI (switch in the top bar), chosen per user. The shop's customer-message language is separate, so a seller can use the English panel and still send Bangla messages. Add a language by copying `lib/i18n/en.ts`. |
| Back office | Merchant approval and suspension, plans and manual payments, usage and cost per shop, support tickets, announcements, staff roles, audit log, system health. |
| Privacy | Public `/privacy` and `/delete-account` pages (Bangla and English), and self-service account deletion in Settings and the API. |
| Test mode | A channel without real keys sends nothing; messages are recorded as "test" so every flow can be tried safely. |

## Release

1. On a server with Docker (Ubuntu 22.04+, 2 GB RAM is enough to start), point your domain's DNS A record at it.
2. `./setup.sh` creates `.env` with fresh random secrets. Open `.env` and fill in `APP_URL`, `ADMIN_EMAILS`, `SMTP_*`, and the provider keys you have. Anything left empty stays off (test mode).
3. `docker compose up -d --build`. This starts Postgres, Dakly, Caddy (free HTTPS certificate for the domain in `APP_URL`) and a daily database backup into `./backups`.
4. `docker compose exec app npm run doctor` signs in to every provider with your keys and says in plain words what is wrong. The same check runs on every start (see `docker compose logs app`) and on **Admin, System**.

If a core setting is missing or still the example value, Dakly refuses to start and the log says exactly which one to fix. See [GO-LIVE.md](GO-LIVE.md) for the full launch checklist.

Tests: `sh test/run.sh` runs 100 API use cases (and `WEB=1` adds 25 browser cases) against fake versions of every provider. See `test/results/TEST-RESULTS.md`.

Demo data for local testing: `npm run db:seed`, then demo@dakly.app / demo1234 (merchant) and admin@dakly.app / admin1234 (admin). Never run it in production.

## Channels and providers

Platform keys in `.env` are shared by every shop, so sellers can start with no setup. A seller can enter their own WhatsApp number, SMS gateway or Twilio account in Settings; those win for that shop.

**WhatsApp.** Meta Business app and phone number. A Marketing template whose body has two variables, e.g. `Hello {{1}}, {{2}}` (1 = first name, 2 = the message). Create one per language you need and set the language per shop. Webhook `https://APP_URL/api/webhooks/whatsapp` with `WA_VERIFY_TOKEN`, subscribed to `messages`; production requires `WA_APP_SECRET`. The webhook stores incoming messages (Inbox), delivery/read receipts, and opt-outs: STOP, বন্ধ, बंद, إيقاف, baja and similar words in many languages.

On the shared Dakly number an incoming message goes to the shop that last messaged that customer. A shop with its own WhatsApp number gets every message to it, and unknown senders become new customers.

**SMS.** Bangladesh: the BulkSMSBD-style HTTP gateway in `SMS_API_*` (countries in `SMS_GATEWAY_COUNTRIES`). Everywhere else: Twilio SMS with the Twilio keys. Other gateways: `lib/channels/sms.ts`.

**AI voice call.** `OPENAI_API_KEY`, a Twilio number with Voice geo permission for the target countries, and a public https `APP_URL`.

**WhatsApp calling.** Sellers call customers on WhatsApp from their own phone (the button opens WhatsApp). Server-side WhatsApp Business Calling (AI on a WhatsApp call) needs Meta's calling API, a customer call permission and a WebRTC/SIP media server; it is not in this release.

**Payments.** SSLCommerz for BDT shops, Stripe Checkout for all others (webhook `https://APP_URL/api/billing/stripe`, event `checkout.session.completed`). Prices: `PRICE_*` in `.env`.

**Facebook Page.** Facebook Login app with redirect `https://APP_URL/api/facebook/callback` and `pages_show_list`, `pages_manage_posts`, `pages_read_engagement` (App Review needed for the public).

**Shopify / WooCommerce.** WooCommerce REST key and secret (read), or a Shopify custom-app Admin API token with `read_orders` and `read_customers`.

## Code map

- `app/(app)/` merchant pages; `app/admin/` back office; `app/privacy`, `app/delete-account` public pages
- `app/actions.ts` server actions; `app/api/v1/` JSON API; `app/api/webhooks/` WhatsApp and Twilio
- `lib/i18n/` languages, countries, money/date/phone formatting, STOP words; `lib/i18n/en.ts` English strings
- `lib/config.ts` which credentials a shop uses; `lib/channels/*` WhatsApp, SMS (gateway + Twilio), voice
- `lib/inbox.ts` conversations; `lib/knowledge.ts` AI knowledge; `lib/ai.ts` OpenAI; `lib/ai-insights.ts` daily tips
- `lib/send.ts` campaign queue and scheduler; `lib/billing.ts` SSLCommerz and Stripe; `lib/plans.ts` plans and prices
- `instrumentation.ts` starts the scheduler
