import "server-only";
import { db } from "./db";

export async function audit(actor: { id: string; email: string } | null, action: string, target?: string, detail?: string) {
  await db.auditLog.create({ data: { actorId: actor?.id ?? null, actor: actor?.email ?? "system", action, target: target ?? null, detail: detail?.slice(0, 1000) ?? null } });
}

export async function logError(source: string, err: unknown, shopId?: string | null) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${source}]`, message);
  try { await db.errorLog.create({ data: { source, message: message.slice(0, 1000), shopId: shopId ?? null } }); } catch { /* db down */ }
}

export async function setState(key: string, value: string) {
  await db.systemState.upsert({ where: { key }, update: { value }, create: { key, value } });
}
