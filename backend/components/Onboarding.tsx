import Link from "next/link";
import type { Shop } from "@prisma/client";
import { onboarding, ONBOARDING_LABELS } from "@/lib/onboarding";
import { getLoc } from "@/lib/i18n/server";

/** "Get started" checklist on the home screen until the four required steps are done. */
export async function Onboarding({ shop }: { shop: Shop }) {
  const o = await onboarding(shop);
  if (o.done) return null;
  const { t, f } = await getLoc();
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="onboarding">
      <div className="sec-h"><h3>{t("শুরু করার ধাপ")}</h3><b className="num">{f.n(o.progress)}/{f.n(o.total)}</b></div>
      <div className="bar"><i style={{ width: `${(o.progress / o.total) * 100}%`, background: "var(--leaf)" }} /></div>
      {o.steps.map((s) => (
        <Link key={s.key} href={s.href} style={{ display: "flex", gap: 10, alignItems: "center", opacity: s.done ? 0.6 : 1 }}>
          <span aria-hidden style={{ width: 22, height: 22, borderRadius: 11, display: "grid", placeItems: "center", background: s.done ? "var(--leaf)" : "transparent", border: "2px solid var(--leaf)", color: "#fff", fontSize: 13, flex: "none" }}>{s.done ? "✓" : ""}</span>
          <span style={{ textDecoration: s.done ? "line-through" : "none" }}>{t(ONBOARDING_LABELS[s.key])}</span>
        </Link>
      ))}
    </div>
  );
}
