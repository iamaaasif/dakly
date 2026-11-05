import { requireShop } from "@/lib/auth";
import { loadCustomers, countBySegment } from "@/lib/segments";
import { channelConfig } from "@/lib/config";
import { messageLimit, voiceAllowed } from "@/lib/plans";
import { bestTime, nextAt } from "@/lib/timing";
import { usedThisMonth } from "@/lib/send";
import { CampaignWizard } from "@/components/CampaignWizard";
import { getLoc } from "@/lib/i18n/server";

export default async function NewCampaign({ searchParams }: { searchParams: Promise<{ segment?: string; offer?: string }> }) {
  const { segment, offer } = await searchParams;
  const { shop } = await requireShop();
  const rows = await loadCustomers(shop.id);
  const reachable = rows.filter((r) => !r.optedOut);
  const counts = { ...countBySegment(reachable), all: reachable.length };
  const cfg = channelConfig(shop);
  const limit = messageLimit(shop);
  const loc = await getLoc();
  const bt = await bestTime(shop, loc);
  const left = limit > 0 ? Math.max(0, limit - (await usedThisMonth(shop.id))) : null;
  const sample = Object.fromEntries((["vip", "regular", "new", "inactive"] as const).map((k) => [k, rows.find((r) => r.segment === k)?.name ?? loc.t("রহিমা")]));
  return (
    <CampaignWizard
      shopName={shop.name}
      counts={counts}
      sample={{ ...sample, all: rows[0]?.name ?? loc.t("রহিমা") }}
      initialSegment={segment && segment in counts ? segment : "inactive"}
      ready={{ wa: !!cfg.wa, sms: !!cfg.sms, voice: !!cfg.voice }}
      left={left}
      initialOffer={offer ?? ""}
      voicePlan={voiceAllowed(shop)}
      best={{ label: bt.label, at: nextAt(bt.hour, shop.timezone) }}
    />
  );
}
