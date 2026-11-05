import "server-only";
import { db } from "./db";
import type { Loc } from "./i18n";
import type { CustomerRow } from "./segments";

export type Insight = {
  key: string; tone: "dak" | "haldi" | "leaf" | "sky"; icon: string;
  title: string; body: string; action: { label: string; href: string };
};

/** Smart notifications: what the seller should do next, computed from their data. */
export async function buildInsights(shopId: string, all: CustomerRow[], { t, f }: Loc): Promise<Insight[]> {
  const rows = all.filter((r) => !r.optedOut);
  const out: Insight[] = [];
  const now = Date.now(), day = 86400000;

  const inactive = rows.filter((r) => r.segment === "inactive");
  if (inactive.length) {
    const avg = inactive.reduce((a, r) => a + r.stats.total / Math.max(1, r.stats.count), 0) / inactive.length;
    out.push({
      key: `inactive-${inactive.length}`, tone: "dak", icon: "clock",
      title: t("{n} জন Customer ৬০ দিনের বেশি কিছু কেনেননি", { n: inactive.length }),
      body: t("এঁরা আগে গড়ে {m} করে কিনতেন। একটা Winback Offer পাঠালে অনেকে ফিরে আসতে পারেন।", { m: f.money(avg) }),
      action: { label: t("Winback Campaign তৈরি করুন"), href: "/campaigns/new?segment=inactive" },
    });
  }

  const slipping = rows.filter((r) => r.segment !== "inactive" && r.stats.last && now - r.stats.last.getTime() > 40 * day);
  if (slipping.length >= 3)
    out.push({
      key: `slipping-${slipping.length}`, tone: "haldi", icon: "trend",
      title: t("{n} জন Customer হারিয়ে যাওয়ার পথে", { n: slipping.length }),
      body: t("৪০ দিনের বেশি কেনেননি। আর ২০ দিন গেলে Inactive হয়ে যাবেন। এখনই একটা ছোট Offer দিন।"),
      action: { label: t("Offer পাঠান"), href: "/campaigns/new?segment=regular" },
    });

  const fresh = rows.filter((r) => r.stats.first && now - r.stats.first.getTime() <= 7 * day);
  if (fresh.length)
    out.push({
      key: `new-${fresh.length}`, tone: "leaf", icon: "users",
      title: t("এই সপ্তাহে {n} জন নতুন Customer", { n: fresh.length }),
      body: t("প্রথম কেনাকাটার ৭ দিনের মধ্যে Welcome Offer দিলে দ্বিতীয়বার কেনার সম্ভাবনা বাড়ে।"),
      action: { label: t("Welcome Offer পাঠান"), href: "/campaigns/new?segment=new" },
    });

  const top = [...rows].sort((a, b) => b.stats.total - a.stats.total)[0];
  if (top && top.stats.total > 0 && top.stats.last && now - top.stats.last.getTime() < 3 * day)
    out.push({
      key: `top-${top.id}-${top.stats.count}`, tone: "haldi", icon: "gift",
      title: t("{name} আবার কিনেছেন (মোট {m})", { name: top.name, m: f.money(top.stats.total) }),
      body: t("উনি আপনার সবচেয়ে বড় Customer। একটা ধন্যবাদ Message আর পরের Order-এ ছোট উপহার দিন।"),
      action: { label: t("VIP-দের ধন্যবাদ দিন"), href: "/campaigns/new?segment=vip" },
    });

  const lastPost = await db.post.findFirst({
    where: { shopId, status: { in: ["published", "scheduled"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!lastPost || now - lastPost.createdAt.getTime() > 3 * day)
    out.push({
      key: `post-${lastPost?.id ?? "none"}`, tone: "sky", icon: "pen",
      title: lastPost ? t("৩ দিনের বেশি কোনো Facebook Post হয়নি") : t("এখনো কোনো Facebook Post Schedule করেননি"),
      body: t("নিয়মিত Post না থাকলে Page-এর Reach কমে যায়। AI দিয়ে এক মিনিটে Post লিখে Schedule করুন।"),
      action: { label: t("AI দিয়ে Post লিখুন"), href: "/posts" },
    });

  const dismissed = await db.dismissedInsight.findMany({ where: { shopId, until: { gt: new Date() } } });
  const hide = new Set(dismissed.map((d) => d.key));
  return out.filter((i) => !hide.has(i.key));
}
