import { apiAuth, ok } from "@/lib/api";
import { loadCustomers, countBySegment } from "@/lib/segments";
import { channelConfig } from "@/lib/config";
import { messageLimit, voiceAllowed } from "@/lib/plans";
import { usedThisMonth } from "@/lib/send";
import { bestTime, nextAt } from "@/lib/timing";
import { getLoc } from "@/lib/i18n/server";
import { placeholders } from "@/lib/ai";

/** What the campaign wizard needs: reachable customers per segment, channel readiness, messages left, best time. */
export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const rows = (await loadCustomers(a.shop.id)).filter((r) => !r.optedOut);
  const cfg = channelConfig(a.shop);
  const limit = messageLimit(a.shop);
  const bt = await bestTime(a.shop, await getLoc());
  return ok({
    counts: { ...countBySegment(rows), all: rows.length },
    channels: { wa: !!cfg.wa, sms: !!cfg.sms, voice: !!cfg.voice, voiceAllowedOnPlan: voiceAllowed(a.shop) },
    messagesLeft: Math.max(0, limit - (await usedThisMonth(a.shop.id))),
    bestTime: { hour: bt.hour, label: bt.label, nextAt: nextAt(bt.hour, a.shop.timezone) },
    placeholders: placeholders(a.shop),
  });
}
