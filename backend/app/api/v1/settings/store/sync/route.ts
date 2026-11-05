import { apiAuth, ok, fail } from "@/lib/api";
import { syncStoreNow } from "@/app/actions";

export async function POST() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const r = await syncStoreNow();
  return r?.error ? fail(r.error) : ok({ ok: true, message: r?.ok });
}
