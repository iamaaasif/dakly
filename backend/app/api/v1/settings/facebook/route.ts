import { apiAuth, ok } from "@/lib/api";
import { appUrl, channelConfig, fbAppReady } from "@/lib/config";
import { handoffToken } from "@/lib/handoff";
import { decrypt } from "@/lib/crypto";
import { disconnectFacebook } from "@/app/actions";

/**
 * connectUrl: open it in a Custom Tab / browser. It is valid for 5 minutes and one use.
 * After Facebook login the browser lands on a page with a "Back to Dakly" button (dakly://open?path=/settings).
 */
export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const cfg = channelConfig(a.shop);
  const pages = (JSON.parse(decrypt(a.shop.fbPagesJson) || "[]") as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name }));
  return ok({
    available: fbAppReady(), connected: !!cfg.fb, page: cfg.fb ? { id: cfg.fb.pageId, name: cfg.fb.name } : null, pages,
    connectUrl: fbAppReady() ? `${appUrl()}/api/facebook/connect?handoff=${await handoffToken(a.shop.id)}` : null,
  });
}
export async function DELETE() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  await disconnectFacebook();
  return ok({ ok: true });
}
