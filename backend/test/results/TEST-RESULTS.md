# Dakly end-to-end test results

Run: 2026-11-05T06:50:09.281Z  
Result: **125/125 passed**

Every outside provider is the mock in `test/mock/server.mjs`.

## A. Sign-up, login and account

| ID | Use case | Result |
| --- | --- | --- |
| A1 | Register a Bangladesh shop: BDT, Asia/Dhaka, Bangla by default | Pass |
| A2 | Register an international shop (US): USD, New York time, English | Pass |
| A3 | Duplicate email is refused | Pass |
| A4 | Bad email and short password are refused with a readable message | Pass |
| A5 | Login works; wrong password gives 401 bad_credentials | Pass |
| A6 | Login is locked for 15 minutes after repeated wrong passwords | Pass |
| A7 | Token refresh returns a new working token | Pass |
| A8 | No token, a garbage token or a tampered token gets 401 unauthorized | Pass |
| A9 | PATCH /me changes name and panel language | Pass |
| A10 | Logout revokes the token on the server | Pass |
| A11 | A new shop gets a welcome email | Pass |
| A12 | Onboarding checklist is returned by /me | Pass |

## B. Password reset

| ID | Use case | Result |
| --- | --- | --- |
| B1 | Forgot password always answers 200 and emails a link only for real accounts | Pass |
| B2 | Reset link sets a new password, works once, and signs out old tokens | Pass |
| B3 | Forgot password is rate limited per address | Pass |

## C. Customers and import

| ID | Use case | Result |
| --- | --- | --- |
| C1 | Add a customer with a local BD number (01712-345678 → 8801712345678) and first order | Pass |
| C2 | Bangla digits and +880 format both work and match the same customer | Pass |
| C3 | An invalid phone number is refused | Pass |
| C4 | Add order, edit and delete a customer | Pass |
| C5 | CSV import with Bangla headers: preview, then import, existing customers updated | Pass |
| C6 | Excel (.xlsx) import | Pass |
| C7 | A broken file gives a clear error | Pass |
| C8 | Customer list: search by name and phone, segment filter, paging | Pass |
| C9 | Voice input: speech to text and the customer fields pulled out | Pass |
| C10 | One shop can never see or change another shop's customers | Pass |
| C11 | Free plan keeps at most 500 customers; import skips the rest | Pass |

## D. Segments

| ID | Use case | Result |
| --- | --- | --- |
| D1 | VIP, Regular, New and Inactive are worked out from orders | Pass |

## E. Campaigns

| ID | Use case | Result |
| --- | --- | --- |
| E1 | WhatsApp campaign to everyone: template sent with first name and personalised text | Pass |
| E2 | Delivery and read receipts from WhatsApp update the campaign | Pass |
| E3 | SMS campaign in Bangladesh goes through the BD gateway | Pass |
| E4 | SMS campaign outside Bangladesh goes through Twilio | Pass |
| E5 | AI voice call is refused on Free and Starter plans | Pass |
| E6 | AI voice call on Growth: Twilio call placed, audio served, press 1 marks interested | Pass |
| E7 | Scheduled campaign waits, then goes out when the scheduler runs | Pass |
| E8 | A time in the past and an empty audience are refused | Pass |
| E9 | WhatsApp refuses a message: it is marked failed with the reason, and logged | Pass |
| E10 | {product} is filled with a product the customer is likely to want | Pass |
| E11 | Message limit: a campaign larger than what is left this month is refused | Pass |

## F. AI and the knowledge base

| ID | Use case | Result |
| --- | --- | --- |
| F1 | Knowledge base: add, list, search, edit, switch off, delete | Pass |
| F2 | AI campaign message is written with the shop's knowledge and brand voice | Pass |
| F3 | Switched-off knowledge is not given to the AI | Pass |
| F4 | AI Facebook post and AI voice script | Pass |
| F5 | English shops get English AI prompts and the {name} placeholder | Pass |
| F6 | Daily AI tips: three tips, bad segments cleaned, cached for the day | Pass |
| F7 | OpenAI down: the merchant gets a clear error, nothing crashes | Pass |
| F8 | Monthly AI limit (Free = 50) returns 429 limit_reached | Pass |

## G. WhatsApp inbox

| ID | Use case | Result |
| --- | --- | --- |
| G1 | Meta webhook verification answers the challenge only with the right token | Pass |
| G2 | Unsigned or wrongly signed webhooks are refused | Pass |
| G3 | A customer reply lands in the right shop's inbox as unread; retries are not duplicated | Pass |
| G4 | AI suggests a reply from the conversation and knowledge | Pass |
| G5 | Reply inside the 24h window is free text and does not use the monthly limit | Pass |
| G6 | Opening the chat marks it read and sends the WhatsApp read receipt | Pass |
| G7 | Outside the 24h window the approved template is used and counted | Pass |
| G8 | One-to-one SMS and call log appear in the conversation | Pass |
| G9 | Provider error on a reply gives 502 provider_error | Pass |
| G10 | A shop with its own WhatsApp number receives messages from new people as new customers | Pass |

## H. Online store sync

| ID | Use case | Result |
| --- | --- | --- |
| H1 | Shopify: connect imports customers and orders, follows pages, skips cancelled orders | Pass |
| H2 | WooCommerce: connect imports orders and skips refunded ones | Pass |
| H3 | Wrong store keys: clear error and nothing saved | Pass |

## I. Opt-out (STOP)

| ID | Use case | Result |
| --- | --- | --- |
| I1 | Customer sends STOP: opted out, left out of campaigns, one-to-one messages blocked | Pass |
| I2 | Bangla বন্ধ also opts out | Pass |
| I3 | SMS campaigns carry a one-tap opt-out link that works | Pass |
| I4 | STOP by SMS to the Twilio number opts the customer out | Pass |

## J. Plans and limits

| ID | Use case | Result |
| --- | --- | --- |
| J1 | Free plan limits are shown in /me and /billing with BDT prices | Pass |
| J2 | A paid plan that has run out falls back to Free | Pass |
| J3 | When the monthly limit is used up, templates and SMS stop with 429 | Pass |

## K. Payments

| ID | Use case | Result |
| --- | --- | --- |
| K1 | Bangladesh: checkout opens SSLCommerz for the right amount | Pass |
| K2 | SSLCommerz success: validated with SSLCommerz, plan on for 3 months, receipt emailed | Pass |
| K3 | The IPN arriving too does not add months twice | Pass |
| K4 | A forged success (validation fails) does not give a plan | Pass |
| K5 | Cancelled and failed payments are recorded as such | Pass |
| K6 | International: Stripe Checkout in USD, return page confirms, plan on | Pass |
| K7 | Stripe webhook: signature checked, a repeat does not add months twice | Pass |
| K8 | Stripe session not paid: no plan | Pass |
| K9 | Paid plans unlock voice and higher limits; buying again extends from the end date | Pass |
| K10 | Invoice for a paid payment can be downloaded | Pass |

## L. Facebook Page posts

| ID | Use case | Result |
| --- | --- | --- |
| L1 | Post scheduled with no Page connected fails with a clear reason | Pass |
| L2 | Connect a Page: login URL, callback saves every Page, pick the second Page | Pass |
| L3 | Scheduled post is published to the chosen Page at its time; cancel works | Pass |
| L4 | Disconnect Facebook | Pass |

## M. Languages, currencies and countries

| ID | Use case | Result |
| --- | --- | --- |
| M1 | Errors come back in the language asked for (bn / en) | Pass |
| M2 | Dashboard greeting and locale fields | Pass |
| M3 | Changing country moves currency and time zone; bad values are refused | Pass |
| M4 | Web pages render in Bangla and English | Pass |

## N. Support tickets

| ID | Use case | Result |
| --- | --- | --- |
| N1 | Merchant opens a ticket and sees it in the list | Pass |

## O. Pending, suspended and deleted accounts

| ID | Use case | Result |
| --- | --- | --- |
| O1 | Pending shop: 403 pending everywhere except /me and /status | Pass |
| O2 | Delete account: wrong password refused, right password removes everything | Pass |

## Q. Account extras, reminders and exports

| ID | Use case | Result |
| --- | --- | --- |
| Q1 | Change password: needs the current one, signs out other devices, emails a notice | Pass |
| Q2 | Customer list downloads as CSV for Excel | Pass |
| Q3 | Plan ending in 2 days and plan ended both email the owner once | Pass |
| Q4 | Abandoned checkouts older than a day are closed | Pass |
| Q5 | New sign-ups notify the admins | Pass |

## P. Security

| ID | Use case | Result |
| --- | --- | --- |
| P1 | Scheduler endpoint needs the cron secret | Pass |
| P2 | Security headers are set | Pass |
| P3 | Sign-up is rate limited per IP | Pass |
| P4 | API is rate limited per account | Pass |
| P5 | Webhook for an unknown Twilio message id is ignored safely | Pass |
| P6 | Voice audio is only served for real voice messages | Pass |

## R. Health and self-check

| ID | Use case | Result |
| --- | --- | --- |
| R1 | /api/health reports database and scheduler | Pass |
| R2 | Startup self-check ran against every provider and found them working | Pass |

## W. Merchant web panel

| ID | Use case | Result |
| --- | --- | --- |
| W1 | Sign up in the browser lands on Home with the get-started checklist | Pass |
| W2 | Every merchant page opens without errors | Pass |
| W3 | Add a customer by hand | Pass |
| W4 | Excel upload from the browser | Pass |
| W5 | Teach the AI a product in the knowledge base | Pass |
| W6 | Campaign wizard: pick segment, channel, AI writes, send now | Pass |
| W7 | Settings: save shop name and change password (other sessions signed out) | Pass |
| W8 | Billing: buying a plan sends the browser to SSLCommerz | Pass |
| W9 | Support ticket from the panel | Pass |
| W10 | Logout, forgot password by email, reset from the link | Pass |
| W11 | English panel renders English | Pass |

## X. Admin back office

| ID | Use case | Result |
| --- | --- | --- |
| X1 | Admin (ADMIN_EMAILS) signs in and every admin page opens | Pass |
| X2 | System page shows the self-check; re-run it and send a test email | Pass |
| X3 | Approve a pending merchant: they get an email and can use the app | Pass |
| X4 | Give a plan with a recorded bKash payment, and set a message limit | Pass |
| X5 | Suspend: the merchant is blocked with the reason and queued messages stop; unsuspend restores | Pass |
| X6 | Turn a merchant's login off (signs them out everywhere) and back on | Pass |
| X7 | Send a password reset link from the back office | Pass |
| X8 | Answer a ticket: merchant sees the reply and gets an email | Pass |
| X9 | Announcement appears on merchants' home | Pass |
| X10 | Add a Support staff member: invite email; Support cannot open System | Pass |
| X11 | Audit log records the admin actions | Pass |
| X12 | Delete a shop from the back office (typed confirmation) | Pass |
| X13 | A merchant cannot open the back office | Pass |
| X14 | No browser errors or blocked resources (CSP) on any page | Pass |
