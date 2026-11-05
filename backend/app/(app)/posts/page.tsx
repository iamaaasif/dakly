import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { channelConfig } from "@/lib/config";
import { getLoc } from "@/lib/i18n/server";
import { PostStudio } from "@/components/PostStudio";
import { cancelPost } from "@/app/actions";
import Link from "next/link";
import { bestTime, nextAt } from "@/lib/timing";

const ST: Record<string, string> = { publishing: "যাচ্ছে", scheduled: "Scheduled", published: "Published", failed: "ব্যর্থ", draft: "বাতিল" };

export default async function Posts() {
  const { shop } = await requireShop();
  const loc = await getLoc();
  const { t, f } = loc;
  const bt = await bestTime(shop, loc);
  const posts = await db.post.findMany({ where: { shopId: shop.id }, orderBy: [{ scheduledAt: "desc" }], take: 30 });
  return (
    <>
      <div className="greet"><h2>AI Facebook Post</h2><p>{t("কী Promote করবেন বলুন, AI Post লিখে নির্দিষ্ট সময়ে Page-এ Publish করবে।")}</p></div>
      {!channelConfig(shop).fb && <div className="err">{t("Facebook Page এখনো Connect করা নেই। Post লিখে Schedule করতে পারবেন, কিন্তু Publish হবে না।")} <Link href="/settings" style={{ fontWeight: 600 }}>{t("Connect করুন")} →</Link></div>}
      <div className="grid2">
        <PostStudio shopName={shop.name} best={{ label: bt.label, at: nextAt(bt.hour, shop.timezone) }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <h3 style={{ fontSize: 17 }}>{t("Schedule করা ও আগের Post")}</h3>
          {posts.length ? (
            <div className="list">
              {posts.map((p) => (
                <div key={p.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm" style={{ fontWeight: 600 }}>{p.text.split("\n")[0].slice(0, 80)}</div>
                    <div className="meta">{p.scheduledAt ? f.dt(p.scheduledAt) : ""}{p.error ? ` · ${t(p.error)}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <span className={`badge b-${p.status}`}>{t(ST[p.status] ?? p.status)}</span>
                    {p.status === "scheduled" && <form action={cancelPost.bind(null, p.id)}><button className="btn ghost sm" style={{ padding: "2px 8px" }}>{t("বাতিল")}</button></form>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="card empty">{t("এখনো কোনো Post নেই।")}</div>}
        </div>
      </div>
    </>
  );
}
