# Dakly go-live checklist

Do these in order. Each step says where the key comes from. After each change: `docker compose up -d`, then `docker compose exec app npm run doctor`.

## 1. Server and domain (30 minutes)
- [ ] A server with Docker and Docker Compose (Ubuntu 22.04+, 2 GB RAM). Ports 80 and 443 open.
- [ ] DNS: an A record for `app.yourdomain` pointing at the server.
- [ ] `./setup.sh`, then in `.env`: `APP_URL=https://app.yourdomain`, `ADMIN_EMAILS`, `SUPPORT_EMAIL`, `BUSINESS_NAME`, `BUSINESS_ADDRESS`.
- [ ] `docker compose up -d --build`. Open `https://app.yourdomain/register` and sign up with your admin email; you land in `/admin`.
- [ ] Save `.env` in a password manager.

## 2. Email (required for password reset and receipts)
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` from Zoho, Brevo, SES or similar. Add the provider's SPF and DKIM records to your domain.
- [ ] Admin, System, "Test Email পাঠান" arrives in your inbox (not spam).

## 3. OpenAI
- [ ] `OPENAI_API_KEY` from platform.openai.com, with billing turned on.

## 4. WhatsApp
- [ ] Meta Business verified; WhatsApp number added; permanent System User token with `whatsapp_business_messaging`.
- [ ] `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`.
- [ ] Marketing template `dakly_offer` (body `{{1}}` name, `{{2}}` message) approved in Bangla (and English if needed). Name and language in `WA_TEMPLATE_NAME` / `WA_TEMPLATE_LANG`.
- [ ] Webhook `https://APP_URL/api/webhooks/whatsapp`, verify token = `WA_VERIFY_TOKEN` from `.env`, subscribed to `messages`.
- [ ] Send a test campaign to your own number; reply "hi" and see it in Inbox; reply "STOP" and see the customer marked opted out.

## 5. SMS (Bangladesh)
- [ ] BulkSMSBD (or similar) account with an approved sender ID: `SMS_API_KEY`, `SMS_SENDER_ID`. Doctor shows the balance.

## 6. Twilio (voice calls, SMS abroad) — optional
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`; Voice geo permission for Bangladesh.
- [ ] Number's "A message comes in" webhook: `https://APP_URL/api/webhooks/twilio-sms`.

## 7. Payments
- [ ] SSLCommerz live store: `SSLCZ_STORE_ID`, `SSLCZ_STORE_PASSWORD`, `SSLCZ_SANDBOX=false`. Register the IPN URL `https://APP_URL/api/billing/sslcommerz?kind=ipn` in the SSLCommerz panel.
- [ ] Stripe (international, optional): `STRIPE_SECRET_KEY` (sk_live_), webhook `https://APP_URL/api/billing/stripe` for `checkout.session.completed`, `STRIPE_WEBHOOK_SECRET`.
- [ ] Buy Starter for 1 month with a real bKash payment of your own; see the plan switch on, the receipt email and the invoice. Refund it from the SSLCommerz panel.

## 8. Facebook Pages — optional
- [ ] Facebook app with Facebook Login, redirect `https://APP_URL/api/facebook/callback`, permissions `pages_show_list`, `pages_manage_posts`, `pages_read_engagement` (App Review for public use). `FB_APP_ID`, `FB_APP_SECRET`.

## 9. Before you announce
- [ ] `npm run doctor` shows no ERROR lines.
- [ ] Decide `SIGNUP_APPROVAL` (`manual` lets you check every new shop first; admins get an email for each sign-up).
- [ ] Uptime monitor on `https://APP_URL/api/health`.
- [ ] Copy `./backups` off the server nightly; try one restore (OPERATIONS.md).
- [ ] Android: put the Play App Signing SHA-256 in `ANDROID_CERT_SHA256`.
- [ ] Read `/privacy` and the invoice once, and adjust the business name and address.
