/**
 * Runs once per server process: a live check of every provider key (logged and saved for
 * /admin/system), then the built-in scheduler (campaigns, posts, store sync, reminders).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __daklyBoot?: boolean };
  if (g.__daklyBoot) return;
  g.__daklyBoot = true;

  setTimeout(async () => {
    try {
      const { runSelfCheck } = await import("./lib/selfcheck-store");
      const r = await runSelfCheck();
      const bad = [...r.env, ...r.live].filter((c) => c.level === "error");
      console.log(bad.length ? `[self-check] ${bad.length} problem(s):\n` + bad.map((c) => `  - ${c.group} ${c.key}: ${c.message}`).join("\n") + "\n  Details: /admin/system or `docker compose exec app npm run doctor`" : "[self-check] all configured providers work");
    } catch (e) { console.error("[self-check] could not run:", (e as Error).message); }
  }, 3000);

  if (process.env.RUN_SCHEDULER === "false") return;
  const { tick } = await import("./lib/send");
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try { await tick(); } catch (e) { const { logError } = await import("./lib/audit"); await logError("scheduler", e); } finally { running = false; }
  }, 60_000);
  console.log("[scheduler] started");
}
