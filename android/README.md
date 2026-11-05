# Dakly for Android (native)

Native Android app for Dakly merchants, written in Kotlin with Jetpack Compose (Material 3). It talks to the Dakly backend's REST API (`/api/v1`, see `API.md` in the backend).

- Package `bd.com.dakly.app` (same as the earlier WebView build, same upload key)
- Min Android 7.0 (API 24), target/compile API 35
- English (default) and Bangla; users pick the app language in Settings or in Android's per-app language settings
- Money, dates and phone numbers follow the shop's country, currency and time zone (Bangladesh by default)

## Screens

| Area | What it does |
| --- | --- |
| Sign in | Login, sign-up with country, forgot password, pending/suspended shop screens |
| Home | Greeting, AI tip of the day, sales last 30 days with 12-week chart, returned customers, segment cards, campaign results, unread inbox, monthly message usage, quick actions |
| Customers | Search, segment filter, sort, infinite scroll; one-tap phone call and WhatsApp per row |
| Customer | Call, WhatsApp chat/call, SMS, in-app inbox; spend stats; AI product suggestion; orders with add order; notes; STOP opt-out; delete |
| Add customer | Manual form with phone validation, or speak the details (voice → AI extracts name, phone, items, amount) |
| Import | Excel/CSV with column-matching preview, then import |
| Inbox | WhatsApp/SMS conversations, unread filter, live refresh |
| Chat | Bubbles with delivery ticks, 24-hour window notice, template fallback, AI reply suggestion from the knowledge base, call logging, older pages |
| Campaigns | List with status; 4-step wizard (segment, channel, AI-written message, review and send now or schedule); results with per-customer status |
| AI Facebook posts | AI writes from a brief and tone, edit, schedule, cancel |
| AI knowledge base | Products (with price), policies, FAQs, brand voice, notes; on/off per item; brand voice text |
| Notifications | AI tips and smart notifications, each opening the right campaign; remind in 3 days |
| Settings | App language, shop profile (country, currency, time zone, AI language), usage, Facebook Page connect (in a Custom Tab, returns via `dakly://`), WooCommerce/Shopify, own WhatsApp/SMS/Twilio credentials, delete account |
| Plan and billing | Plans priced in the shop's currency, pay online in a Custom Tab |
| Support | Open tickets and read replies |

Deep links: `https://dakly.wowapps.io/...` (App Links, verified by the backend's `assetlinks.json`) and `dakly://open?path=/...` open the matching screen.

## Code map

- `data/ApiClient.kt` HTTP + JSON, Bearer token, `Accept-Language`, error mapping (`{error, code}`)
- `data/Models.kt` API models; `data/Repository.kt` every endpoint; `data/SessionStore.kt` token (DataStore)
- `util/Format.kt` locale formatting (currency, numbers, dates in the shop time zone, phones via libphonenumber)
- `util/Intents.kt` call, WhatsApp (`wa.me`, prefers WhatsApp Business), SMS, Custom Tabs
- `ui/DaklyRoot.kt` login gate, bottom navigation, routes, web-path → route mapping
- `ui/screens/*` all screens; `ui/components/Components.kt` shared UI; `ui/theme/Theme.kt` brand colours (light/dark)
- `res/values/strings.xml` English, `res/values-bn/strings.xml` Bangla

## Build

```
./gradlew assembleDebug                       # debug build, talks to production API
./gradlew assembleDebug -PdaklyApi=https://staging.example.com
./gradlew bundleRelease                       # needs keystore.properties (see below)
```

`keystore.properties` next to `settings.gradle.kts` (never commit it):

```
storeFile=dakly-upload.jks
keyAlias=dakly
storePassword=...
keyPassword=...
```

Version: `version.properties` (raise `versionCode` by 1 for every Play upload).

## Adding a language

Add `res/values-<code>/strings.xml`, add the code to `res/xml/locales_config.xml`, to `resourceConfigurations` in `app/build.gradle.kts`, and to the language chips in `AccountScreens.kt` (`AppLanguageCard`).

## Look and feel

Colours and type follow wowapps.io: lime `#D6EF67` (fills only), ink `#070707`, forest green `#347421` (text, links, selected borders), Inter. Tokens live in `ui/theme/Theme.kt` (`dak`, `accent`, `bad`) and mirror `backend/app/globals.css`. Phones get a bottom bar; screens 600dp and wider get a side rail with content capped at 840dp. `res/font/inter.ttf` is Inter (SIL Open Font License 1.1); weights apply on Android 8+.
