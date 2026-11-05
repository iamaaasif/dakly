# Handoff: compile, sign and test

This code was written in a sandbox without access to Google's Maven, so it has **never been compiled**. A Kotlin parse found no syntax errors, but expect a round of compile fixes (imports, API signatures). Steps for the next session (which needs dl.google.com / maven.google.com):

1. Install the Android SDK (cmdline-tools → `platforms;android-35`, `build-tools;35.0.0`) or use the Gradle wrapper with `ANDROID_HOME` set.
2. `./gradlew assembleDebug` and fix compile errors. Keep behaviour and texts; add any missing string to both `values/strings.xml` and `values-bn/strings.xml`.
3. Run lint: `./gradlew lintDebug`.
4. Test against a local backend: run the Dakly backend (`docker compose up` or `npm run dev` + Postgres, `npm run db:seed`, login demo@dakly.app / demo1234) and build with `-PdaklyApi=http://10.0.2.2:3000` on an emulator. Note: `network_security_config.xml` blocks cleartext; for local testing add a debug-only override (`src/debug/res/xml/network_security_config.xml` allowing cleartext to 10.0.2.2).
5. Check on an emulator (API 24 and API 35): login, home, customers list/detail/add/voice/import, inbox chat send, campaign wizard (test mode), posts, knowledge CRUD, settings language switch (English ↔ Bangla), dark mode, rotation, deep link `adb shell am start -d "dakly://open?path=/settings"`.
6. Take Play screenshots (1080×1920) from the emulator with the seeded demo shop.
7. Sign: `cp /mnt/project-files/dakly/android/signing/{dakly-upload.jks,keystore.properties} .` then `./gradlew bundleRelease assembleRelease`. Same package and key as before, so App Links fingerprint stays `14:06:C2:...:2C:A1`.
8. Save outputs to `/mnt/project-files/dakly/android/native/release/` and update `RELEASE.md` there.
