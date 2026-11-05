import { db } from "@/lib/db";
import { activePlan } from "@/lib/plans";
import type { Shop } from "@prisma/client";

export async function Announcements({ shop }: { shop: Shop }) {
  const paid = activePlan(shop) !== "free";
  const list = await db.announcement.findMany({
    where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }], audience: { in: ["all", paid ? "paid" : "free"] } },
    orderBy: { createdAt: "desc" }, take: 2,
  });
  return (
    <>
      {list.map((a) => (
        <div key={a.id} className={a.tone === "warning" ? "err" : "card"} style={a.tone === "warning" ? undefined : { background: "var(--sky-soft)", border: 0 }}>
          <b>{a.title}</b>
          <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{a.body}</p>
        </div>
      ))}
    </>
  );
}
