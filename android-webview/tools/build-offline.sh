#!/usr/bin/env bash
# Builds a signed APK and AAB without Gradle (aapt2 + javac + dx + apksigner/jarsigner).
# Normal builds should use Gradle / Android Studio (./gradlew bundleRelease). This script
# exists for machines without the Android Gradle Plugin.
# Needs: ANDROID_JAR (platform 35 android.jar), BT (dir with aapt2, zipalign, apksigner, dx),
#        KEYSTORE_PROPS (keystore.properties), OUT (output dir).
set -euo pipefail
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${ANDROID_JAR:?}" "${BT:?}" "${KEYSTORE_PROPS:?}" "${OUT:?}"
PKG=bd.com.dakly.app
MIN=24; TARGET=35
source <(grep -E '^(versionCode|versionName)=' "$ROOT/version.properties")
prop() { grep -E "^$1=" "$KEYSTORE_PROPS" | cut -d= -f2-; }
KS="$(dirname "$KEYSTORE_PROPS")/$(prop storeFile)"; ALIAS=$(prop keyAlias); SP=$(prop storePassword); KP=$(prop keyPassword)

W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
M="$ROOT/app/src/main"
sed "s|<manifest |<manifest package=\"$PKG\" |" "$M/AndroidManifest.xml" > "$W/AndroidManifest.xml"

echo "== resources"
"$BT/aapt2" compile --dir "$M/res" -o "$W/res.zip"
LINK=(-I "$ANDROID_JAR" --manifest "$W/AndroidManifest.xml" --min-sdk-version $MIN --target-sdk-version $TARGET
      --version-code "$versionCode" --version-name "$versionName" --auto-add-overlay "$W/res.zip")
"$BT/aapt2" link "${LINK[@]}" -o "$W/base.apk" --java "$W/gen"
"$BT/aapt2" link "${LINK[@]}" -o "$W/proto.apk" --proto-format

echo "== java"
mkdir -p "$W/classes"
javac -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -encoding UTF-8 -d "$W/classes" \
  $(find "$M/java" "$W/gen" -name '*.java') 2>&1 | grep -v "^warning: \[options\]" || true
test -f "$W/classes/bd/com/dakly/app/MainActivity.class"

echo "== dex"
"$BT/dx" --dex --min-sdk-version=$MIN --output="$W/classes.dex" "$W/classes"

echo "== apk"
cp "$W/base.apk" "$W/unsigned.apk"; (cd "$W" && zip -qj unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$W/unsigned.apk" "$W/aligned.apk"
mkdir -p "$OUT"
APK="$OUT/dakly-$versionName-release.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$ALIAS" --ks-pass "pass:$SP" --key-pass "pass:$KP" \
  --min-sdk-version $MIN --v4-signing-enabled false --out "$APK" "$W/aligned.apk"
"$BT/apksigner" verify --print-certs "$APK" | head -3

echo "== aab"
B="$W/bundle"; mkdir -p "$B/base/manifest" "$B/base/dex"
(cd "$B/base" && unzip -q "$W/proto.apk")
mv "$B/base/AndroidManifest.xml" "$B/base/manifest/AndroidManifest.xml"
cp "$W/classes.dex" "$B/base/dex/classes.dex"
python3 "$ROOT/tools/bundle_config.py" "$B/BundleConfig.pb"
AAB="$OUT/dakly-$versionName-release.aab"; rm -f "$AAB"
(cd "$B" && zip -qrD -X "$W/bundle.aab" BundleConfig.pb base)
cp "$W/bundle.aab" "$AAB"
jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore "$KS" -storepass "$SP" -keypass "$KP" "$AAB" "$ALIAS" >/dev/null
jarsigner -verify "$AAB" | tail -1
echo "Built: $APK"
echo "Built: $AAB"
