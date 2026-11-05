/** Digital Asset Links for the Android app (Trusted Web Activity). Served at /.well-known/assetlinks.json via a rewrite. */
export const dynamic = "force-dynamic";
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE || "bd.com.dakly.app";
  const certs = (process.env.ANDROID_CERT_SHA256 || "14:06:C2:84:88:76:37:7F:45:D4:ED:E7:D3:FB:AD:65:13:FA:FF:D9:9D:87:19:0A:45:AF:C2:66:E2:27:2C:A1")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return Response.json([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: certs } }]);
}
