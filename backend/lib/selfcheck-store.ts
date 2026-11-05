import { db } from "./db";
import { fullCheck } from "./selfcheck";
import { setState } from "./audit";

/** Runs the full self-check and keeps the result for the System page. */
export async function runSelfCheck() {
  const r = await fullCheck({ db: () => db.$queryRaw`SELECT 1 FROM "User" LIMIT 1` });
  await setState("selfcheck", JSON.stringify(r));
  return r;
}
export async function lastSelfCheck(): Promise<Awaited<ReturnType<typeof fullCheck>> | null> {
  const s = await db.systemState.findUnique({ where: { key: "selfcheck" } });
  try { return s ? JSON.parse(s.value) : null; } catch { return null; }
}
