import Link from "next/link";
import { Icon } from "./Icon";
import { dismissInsight } from "@/app/actions";
import type { Insight } from "@/lib/insights";
import type { T } from "@/lib/i18n";

export function InsightCard({ i, t }: { i: Insight; t: T }) {
  return (
    <div className="al">
      <div className={`ic t-${i.tone}`}><Icon name={i.icon} /></div>
      <div style={{ minWidth: 0 }}>
        <h4>{i.title}</h4>
        <p>{i.body}</p>
        <div className="acts">
          <Link className="btn primary sm" href={i.action.href}>{i.action.label}</Link>
          <form action={dismissInsight.bind(null, i.key)}><button className="btn ghost sm">{t("৩ দিন পরে মনে করান")}</button></form>
        </div>
      </div>
    </div>
  );
}
