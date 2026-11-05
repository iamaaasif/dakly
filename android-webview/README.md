# Dakly for Android

The merchant app for Dakly. It opens the Dakly web app (`https://app.dakly.com.bd`) full screen in a hardened WebView, so every screen the web has (home dashboard, customers, campaigns, AI posts, notifications, settings) is in the app, and every web update reaches the app without a new release.

What the native side adds:

| Feature | How |
| --- | --- |
| Excel/CSV customer import | System file picker, filtered to .xlsx/.csv |
| Add customer by voice | Asks for the microphone permission the first time, only for the Dakly site |
| WhatsApp, phone, other links | Open in the right app; other websites open in the browser |
| Facebook Page connect | Opens in the phone's browser (Facebook blocks login inside apps), then returns with `dakly://open?path=/settings` |
| App Links | Any `https://app.dakly.com.bd/...` link opens in the app (verified by `/.well-known/assetlinks.json`) |
| Offline / server down | Bangla error screen with retry; retries by itself when the internet comes back |
| Languages | App screens in English (default) and Bangla; users pick the app language in Android settings. The web gets the same language through Accept-Language |
| Light and dark mode | Follows the phone; the web gets the matching `prefers-color-scheme` |
| Android 15 edge-to-edge | Content is padded around the status bar, navigation bar and keyboard |
| Security | HTTPS only, no file access, Safe Browsing, no backups of the session |

The web can detect the app by `DaklyAndroid/<version>` in the User-Agent.

- Package: `bd.com.dakly.app`
- Min Android 7.0 (API 24), target API 35
- No third-party libraries, no tracking, no ads

## Build

Android Studio: open this folder, put `keystore.properties` next to `settings.gradle.kts` (see below), then **Build > Generate Signed App Bundle**, or:

```
./gradlew bundleRelease     # app/build/outputs/bundle/release/app-release.aab
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

`keystore.properties`:

```
storeFile=dakly-upload.jks
keyAlias=dakly
storePassword=...
keyPassword=...
```

`tools/build-offline.sh` builds the same APK/AAB without Gradle (used for the first release, because the build machine had no access to Google's Maven).

## Change things

- **Server address:** `app/src/main/res/values/config.xml` and the App Links host in `AndroidManifest.xml`.
- **New version:** raise `versionCode` (by 1) and `versionName` in `version.properties`.
- **Texts:** `res/values/strings.xml` (English) and `res/values-bn/strings.xml` (Bangla). New language: add `res/values-<code>/strings.xml`, then add it to `res/xml/locales_config.xml` and `resourceConfigurations` in `app/build.gradle.kts`.
- **Icon/colours:** `res/mipmap-*`, `res/values/colors.xml`.
