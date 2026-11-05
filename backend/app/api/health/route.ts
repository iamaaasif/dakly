import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
/** Liveness for Docker and uptime monitors. 503 when the database is down. */
export async function GET() {
  let dbOk = false, scheduler: number | null = null;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
    const t = await db.systemState.findUnique({ where: { key: "scheduler.lastTick" } });
    scheduler = t ? Math.round((Date.now() - new Date(t.value).getTime()) / 1000) : null;
  } catch { /* db down */ }
  return Response.json({ ok: dbOk, db: dbOk, schedulerLastRunSecondsAgo: scheduler, version: process.env.npm_package_version ?? null }, { status: dbOk ? 200 : 503 });
}
