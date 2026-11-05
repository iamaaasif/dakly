# Releasing Dakly on Google Play

## Before you upload (one time)

1. **Back up the signing key.** `signing/dakly-upload.jks` and `signing/keystore.properties` (password inside) are the upload key. Keep 2 copies off this server (e.g. password manager + encrypted drive). If it is lost you can ask Google to reset the upload key, but it takes days.
2. **Server is live on `https://dakly.wowapps.io`** with HTTPS, and `https://dakly.wowapps.io/.well-known/assetlinks.json` returns the JSON (it does by default once the backend is deployed).
3. **Privacy policy page** and **account deletion page** are live on the web (Play requires both, see the URLs in the thread).
4. A Google Play developer account (one-time USD 25). A new *personal* account must run a closed test with at least 12 testers for 14 days before production; an *organization* account (needs a D-U-N-S number) skips that.

## Upload

1. Play Console > **Create app**: name `Dakly`, default language Bengali (bn-BD), App, Free.
2. **Release > Testing > Internal testing** (or Closed testing) > Create release > upload `dakly-1.0.0-release.aab`. Accept **Play App Signing**.
3. After the first upload: **Setup > App signing** shows the *App signing key certificate* SHA-256. Add it to the server env and redeploy, so App Links keep working for Play installs:
   `ANDROID_CERT_SHA256="14:06:C2:84:88:76:37:7F:45:D4:ED:E7:D3:FB:AD:65:13:FA:FF:D9:9D:87:19:0A:45:AF:C2:66:E2:27:2C:A1,<Play SHA-256>"`
4. Fill **Store listing** from `store/listing.md` and upload `store/play-icon-512.png`, `store/feature-graphic-1024x500.png`, `store/screenshot-1..5.png`.
5. Fill **App content** with the answers in `store/listing.md` (Data safety, permissions, ads, target audience, app access with the review login).
6. When testing is done: **Production > Create release** > add the same AAB (or promote the testing release) > countries: Bangladesh (and others if wanted) > Review > Start rollout.

## Updating the app

Most changes are on the web and need no app update. For a native change, raise `versionCode` and `versionName` in `version.properties`, build with `./gradlew bundleRelease` (or `tools/build-offline.sh`), and upload the new AAB.

## Testing the APK on a phone

`dakly-1.0.0-release.apk` installs directly (allow "install unknown apps"). It is signed with the same key as the AAB. To test against a staging server, change `app_url`/`app_host` in `res/values/config.xml` and rebuild.
