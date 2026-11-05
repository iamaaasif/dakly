# Running Dakly day to day

This guide is for the Dakly team. The back office is at `https://APP_URL/admin`. Anyone listed in `ADMIN_EMAILS` is always an Admin there.

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything, including adding staff, changing plans, suspending shops, system tools |
| Support | See merchants, answer tickets, post announcements, send password-reset links |
| Billing | See merchants, change plans, record manual payments, see payments and usage |

To add staff, go to **Admin, then Staff**. The person signs up first, or you add them by email, and then you pick a role.

## Daily checklist

1. **Overview.** Look at new sign-ups, active shops, MRR and messages today. If `SIGNUP_APPROVAL=manual`, approve new merchants under **Merchants, Pending**.
2. **Tickets.** Answer anything Open. The merchant gets an email, and the ticket shows "Replied" in their panel.
3. **System.** Check three things:
   - "Scheduler last ran" should be under 2 minutes ago.
   - No new errors.
   - Every provider (WhatsApp, SMS, Twilio, OpenAI, SSLCommerz, Stripe, SMTP) shows as set up.
4. **Usage.** Look for shops whose cost is above their plan price. Voice calls are the usual cause.

## Common tasks

| Task | Where |
| --- | --- |
| Approve a new merchant | Merchants, open the shop, Approve |
| Suspend for abuse or spam | Merchants, open the shop, Suspend (with a reason; the merchant sees it) |
| Give a plan after a bank or bKash transfer | Merchants, open the shop, Plan: pick the plan and months, tick "record payment" with the amount |
| Raise one shop's monthly message limit | Merchants, open the shop, Limit |
| Merchant forgot password | Merchants, open the shop, Send reset link |
| Announce maintenance or an offer | Announcements: choose audience (all / free / paid) and an end date |
| Run the scheduler now | System, Run scheduler |
| A merchant asks to delete their account | They can do it themselves in Settings ("Account মুছে ফেলুন"). If they cannot sign in, check that the request comes from the account email, then delete the shop. |

## Money

- **Bangladesh (BDT)** shops pay through SSLCommerz with bKash, Nagad, Rocket, cards or net banking. `SSLCZ_SANDBOX=false` turns on live payments.
- **Every other country** pays by card through Stripe Checkout, in USD. Two settings are needed:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`, from a webhook at `https://APP_URL/api/billing/stripe` that listens for `checkout.session.completed`
- **Prices** default to Starter at ৳990 or $12 and Growth at ৳2,490 or $29. You can change them with `PRICE_STARTER_BDT`, `PRICE_GROWTH_BDT`, `PRICE_STARTER_USD` and `PRICE_GROWTH_USD`.
- **Payment status and duplicates.** A payment counts only after the server checks it with SSLCommerz or Stripe. A payment is never applied twice, even when the redirect and the webhook both arrive.
- **MRR** in Overview is in BDT. USD plans are converted at `USD_TO_BDT`.
- **When a plan ends,** the shop drops back to Free. No data is deleted.

## International shops

- **Country.** A shop picks its country when it signs up, and can change it later in Settings. The country sets the default currency, time zone and customer-message language.
- **Phone numbers** are read in the shop's country and stored in international format.
- **Two languages.** The panel language (Bangla or English, top-bar switch) belongs to each user. The language of customer messages belongs to the shop.
- **SMS route.** The BD gateway handles the countries in `SMS_GATEWAY_COUNTRIES`. Every other country goes through Twilio SMS.
- **WhatsApp templates.** Create the marketing template in each language you need. A shop with its own WhatsApp number sets the template language in Settings.
- **Adding a language:**
  1. Copy `lib/i18n/en.ts` to a new file and translate the values.
  2. Add the language to `LANGS` and `DICTS` in `lib/i18n/index.ts`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Messages stay "test" | That channel's keys are missing or contain "dummy" (System page). Or the shop has no WhatsApp/SMS for its country. |
| WhatsApp "failed": template not found | The template name or language in `.env` or the shop's Settings does not match an approved template |
| Inbox gets no messages | The Meta webhook is not subscribed to `messages`, or `WA_APP_SECRET` is wrong (System shows webhook errors) |
| Customer replies land in the wrong shop | On the shared Dakly number, a reply goes to the shop that last messaged that customer. Shops that need certainty should use their own WhatsApp number. |
| Scheduled campaigns or posts never go out | System: scheduler last run. If it is old, restart the app. If you use `/api/cron` instead, check `RUN_SCHEDULER=false` and your cron job. |
| AI writes generic text | `OPENAI_API_KEY` is missing, or the shop has no AI knowledge yet |
| AI limit reached | The shop's monthly AI uses are used up. Upgrade the plan, or wait for the 1st of the month. |
| Voice calls fail | Twilio geo permission for that country, `APP_URL` must be public https, and the shop must be on Growth |
| Stripe payment paid but plan not active | Webhook secret wrong. The return page also confirms, so ask the merchant to reload Billing. Check System errors. |
| Facebook connect fails | App Review status, redirect URI, and that the user is a Page admin |

## Backups and restore

The `backup` service writes `./backups/dakly-YYYYMMDD-HHMM.sql.gz` every `BACKUP_EVERY_HOURS` (24) and keeps `BACKUP_KEEP_DAYS` (14). Copy that folder off the server too (e.g. a nightly `rclone copy ./backups remote:dakly-backups`). Keep a copy of `.env` in a password manager: without `ENCRYPTION_KEY` stored shop tokens cannot be read.

Restore into a fresh install:

```
docker compose up -d db
gunzip -c backups/dakly-20261105-0300.sql.gz | docker compose exec -T db psql -U dakly -d dakly
docker compose up -d
```

## Health and checks

- `GET /api/health` returns `{ ok, db, schedulerLastRunSecondsAgo }`. Point an uptime monitor (UptimeRobot, Better Stack) at it.
- **Admin, System** shows the configuration and provider self-check, with "check now" and "send test email" buttons.
- `docker compose exec app npm run doctor` runs the same check in the terminal.
- Reminders run by themselves: plan ends in 3 days, plan ended, 80% of monthly messages used. Unpaid checkouts close after 24 hours.

## Audit log

Admin actions are recorded with who did them and when:
- approvals
- suspensions
- plan changes
- manual payments
- staff changes
- account deletions

Paid payments are recorded too. The log is under **Admin, then Audit**.
