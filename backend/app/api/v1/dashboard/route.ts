import { apiAuth, ok, locale } from "@/lib/api";
import { dashboardData } from "@/lib/reports";
import { cachedTips } from "@/lib/ai-insights";
import { buildInsights } from "@/lib/insights";
import { loadCustomers } from "@/lib/segments";
import { bestTime } from "@/lib/timing";
import { getLoc } from "@/lib/i18n/server";
import { localHour } from "@/lib/i18n";
import { unreadCount } from "@/lib/inbox";
import { usedThisMonth } from "@/lib/send";
import { messageLimit } from "@/lib/plans";

/** Amounts are whole units of shop.currency; format them on the device. */
export async function GET() {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const loc = await getLoc();
  const rows = await loadCustomers(a.shop.id);
  const [d, tips, notifications, bt, unread, used] = await Promise.all([dashboardData(a.shop), cachedTips(a.shop), buildInsights(a.shop.id, rows, loc), bestTime(a.shop, loc), unreadCount(a.shop.id), usedThisMonth(a.shop.id)]);
  const h = localHour(a.shop.timezone);
  return ok({
    ...locale(a.shop), greeting: loc.t(h < 12 ? "শুভ সকাল" : h < 17 ? "শুভ দুপুর" : "শুভ সন্ধ্যা"),
    ...d, aiTips: tips, notifications, bestTime: { hour: bt.hour, label: bt.label },
    inboxUnread: unread, messagesThisMonth: { used, limit: messageLimit(a.shop) },
  });
}
