/**
 * Dakly doctor: checks .env and every provider key, and says in plain words what to fix.
 *   docker compose exec app npm run doctor         full check, including live provider logins
 *   (runs automatically with --startup on every container start: format checks + database)
 */
import { PrismaClient } from "@prisma/client";
import { checkEnv, fatal, formatChecks } from "../lib/envcheck";
import { liveCheck } from "../lib/selfcheck";

const startup = process.argv.includes("--startup");

async function main() {
  const checks = checkEnv();
  console.log("\n=== Dakly configuration check ===\n" + formatChecks(checks));
  const bad = fatal(checks);
  if (bad.length) {
    console.error(`\n!!! Dakly cannot start: fix ${bad.length === 1 ? "this setting" : "these settings"} in .env, then run: docker compose up -d\n` + bad.map((c) => `    - ${c.key}: ${c.message}`).join("\n") + "\n");
    process.exit(1);
  }
  const db = new PrismaClient();
  let ok = false;
  for (let i = 0; i < (startup ? 30 : 1); i++) {
    try { await db.$queryRaw`SELECT 1`; ok = true; break; }
    catch (e) {
      const m = (e as Error).message;
      if (/authentication failed/i.test(m)) { console.error("\n!!! The database refused the password. POSTGRES_PASSWORD in .env was changed after the database was created.\n    Put the original password back, or (only on a fresh install with no data) run: docker compose down -v\n"); process.exit(1); }
      if (i === 0) console.log("Waiting for the database...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!ok) { console.error("\n!!! Cannot reach the database (DATABASE_URL). Is the db container running?\n"); process.exit(1); }
  console.log("  OK   Database      connected");
  if (startup) { await db.$disconnect(); return; }
  console.log("\n=== Live provider check (read-only) ===");
  const live = await liveCheck({ db: () => db.$queryRaw`SELECT 1 FROM "User" LIMIT 1` });
  console.log(formatChecks(live));
  await db.$disconnect();
  const errors = [...checks, ...live].filter((c) => c.level === "error");
  console.log(errors.length ? `\n${errors.length} problem(s) to fix. Features with problems run in test mode until fixed.\n` : "\nAll configured providers work.\n");
  process.exit(errors.length ? 2 : 0);
}
main();
