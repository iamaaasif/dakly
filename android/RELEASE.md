# Dakly Android (native) 1.0.0: release notes

**Status: compiled, tested, signed. Ready for a Play internal/closed test.**

## Files

| File | What |
| --- | --- |
| `release/dakly-1.0.0-native-release.aab` | Upload this to Google Play |
| `release/dakly-1.0.0-native-release.apk` | Install directly on a phone to try it |
| `store/bn/*.png`, `store/en/*.png` | Play phone screenshots, 1080x1920, Bangla and English |
| `dakly-android-native-source.zip` | Source, with the tests (no key inside) |

- Package `bd.com.dakly.app`, versionName 1.0.0, **versionCode 2** (above the old WebView build, so it replaces it on any track).
- Signed with the same upload key `signing/dakly-upload.jks` (SHA-256 `14:06:C2:84:…:27:2C:A1`), so App Links keep working.
- Release builds talk to `https://app.dakly.com.bd`. To point at another server: `./gradlew bundleRelease -PdaklyApi=https://staging.example.com`.
- Min Android 7.0 (API 24), target API 35. R8 shrinking on (5.9 MB AAB).

## How it was tested

The build machine has no hardware acceleration, so the Android emulator could not run. Instead the real app (every screen, real
navigation, real HTTP) ran under Robolectric against a local copy of the Dakly 1.0.0 backend with the seeded demo shop.

`./gradlew testDebugUnitTest -PdaklyApi=http://localhost:3000` (backend running, `npm run db:seed`): **34 tests, all pass.**

- **API contract (10):** every endpoint the app calls, compared field by field with the app's models; customer add/edit/order/call log/opt-out/delete,
  CSV import preview + import, campaign now and scheduled, AI message/post, posts schedule/cancel, knowledge CRUD + brand voice, inbox send/read/AI
  suggestion, settings, store connect error, billing, tickets, sign-up in India (INR, Asia/Kolkata), delete account, logout, change password
  (old token revoked), reset from emailed link, CSV export.
- **Screen tour (4 x 16 screens):** every screen opened by deep link in English, Bangla, light and dark; checks it loads without error and saves a screenshot.
- **User flows (20):** login with wrong then right password, logout, forgot password, sign-up, add customer (with phone validation), chat send,
  campaign wizard to send, AI post write + date/time pick + schedule, knowledge add, customer delete, support ticket, "remind me in 3 days",
  language switch English/Bangla, rotation keeps typed text, deep links while open, expired token goes to login, offline shows retry,
  onboarding checklist on Home, CSV export opens the share sheet, change password, reset-password link.
- **Lint:** 0 errors.

Not covered automatically (try on a real phone before production): the add-order and edit-note dialogs (text fields inside a dialog hang
Robolectric; their API calls are tested), voice add (needs a microphone and a real OpenAI key), the Excel import file picker, Facebook connect and
payment in Custom Tabs, and real WhatsApp/SMS sending (the backend is in test mode without keys).

## Bugs found and fixed

1. 3 compile errors (Material3 dropdown API).
2. **Crash on Android 7.0/7.1:** java.time needs core library desugaring (now enabled).
3. Date picker chose yesterday in Bangladesh between midnight and 6 AM (UTC vs shop time zone), so scheduling a post or campaign failed.
4. Brand voice field always showed empty.
5. A request that started before a password change could log the user out when it came back 401; now only the token that was rejected is cleared.
6. Relative times ("3 days ago") and dates/times used English words and digits in the Bangla UI; now follow the app language.
7. Home tip card: "Later" button squeezed into a vertical strip in Bangla.
8. Bottom bar labels cut off ("Campaig").
9. Toasts from background work could crash; now always shown on the main thread.

## Added for backend 1.0.0

Reset password screen (from `https://app.dakly.com.bd/reset?token=…`, works logged in or out), change password in Settings (keeps this phone
signed in), CSV export from the Customers screen (share to Drive/Gmail/WhatsApp), onboarding checklist on Home until done, one automatic retry
for reads on `429 rate_limited` (waits for `Retry-After`, max 10 s), payments and invoices on Plan and billing. New strings in English and Bangla.

## Uploading

Follow `../RELEASE.md` (Play Console steps), but upload `release/dakly-1.0.0-native-release.aab` and the screenshots in `store/bn` (default listing
language Bengali) and `store/en`. The feature graphic and icon in `../store/` still apply.

## Building again

1. Android SDK 35 + JDK 17+. `sdk.dir` in `local.properties`.
2. Copy `signing/dakly-upload.jks` and `signing/keystore.properties` next to `settings.gradle.kts` (never commit them).
3. Raise `versionCode` in `version.properties` for every Play upload.
4. `./gradlew testDebugUnitTest -PdaklyApi=http://localhost:3000`, then `./gradlew bundleRelease assembleRelease`.
5. Play screenshots: `./gradlew testDebugUnitTest --tests '*PlayScreenshots*' -PdaklyApi=http://localhost:3000 -PdaklyPlay=1 -Proborazzi.test.record=true`
   (files land in `app/build/outputs/roborazzi/play/`).

Local test runs only: start the test backend with `API_RATE_LIMIT_PER_MIN=2000` (the default 120 calls/min per account is too low for a full
test run). Production limits are unchanged.
