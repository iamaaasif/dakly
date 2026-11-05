# Dakly

AI customer growth platform for small online sellers. Bangladesh is the first market and the default; every shop can set its own country, currency, time zone and language.

| Folder | What it is |
| --- | --- |
| [`backend/`](backend/) | Next.js 16 + Prisma/Postgres app: merchant panel, Dakly admin panel, REST API (`/api/v1`), Docker deploy. See `backend/README.md`, `backend/GO-LIVE.md`, `backend/API.md`. |
| [`android/`](android/) | Native Android app (Kotlin, Jetpack Compose) on `/api/v1`. Not compiled yet; see `android/HANDOFF.md`. |
| [`android-webview/`](android-webview/) | Earlier Android build that wraps the web app in a WebView (released as 1.0.0). |

Secrets (`.env`, signing keystores, `keystore.properties`) are not in this repo. Copy `backend/.env.example` (or run `backend/setup.sh`) and keep the upload key outside git.
