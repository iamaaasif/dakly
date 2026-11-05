import { apiAuth, ok, fail } from "@/lib/api";
import { connectStore, disconnectStore } from "@/app/actions";

/** { storeType: "woocommerce" | "shopify", storeUrl, storeKey, storeSecret? } connects and imports customers. */
export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const b = await req.json().catch(() => ({}));
  const fd = new FormData();
  for (const k of ["storeType", "storeUrl", "storeKey", "storeSecret"]) fd.set(k, String(b[k] ?? ""));
  const r = await connectStore(undefined, fd);
  return r?.error ? fail(r.error) : ok({ ok: true, message: r?.ok });
}
export async function DELETE() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  await disconnectStore();
  return ok({ ok: true });
}
