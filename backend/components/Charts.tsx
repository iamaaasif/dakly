import type { Loc } from "@/lib/i18n";

const short = ({ f, lang }: Loc, n: number) => (lang === "bn" && n >= 100000 ? f.digits((n / 100000).toFixed(1)) + " লাখ" : n >= 1000000 ? f.digits((n / 1000000).toFixed(1)) + "M" : n >= 1000 ? f.digits((n / 1000).toFixed(n >= 10000 ? 0 : 1)) + "k" : f.digits(n));

/** Stacked bars, drawn to one scale. series colors come from theme tokens. */
export function StackedBars({ loc, data, series, height = 180, labelEvery = 1 }: {
  loc: Loc; data: { label: string; values: number[] }[]; series: { name: string; color: string }[]; height?: number; labelEvery?: number;
}) {
  const W = 640, H = height, padL = 44, padB = 26, padT = 10, padR = 8;
  const max = Math.max(1, ...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const bw = (W - padL - padR) / data.length;
  const y = (v: number) => H - padB - (v / top) * (H - padB - padT);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={series.map((s) => s.name).join(", ")} style={{ display: "block", overflow: "visible" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? "3 4" : undefined} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{short(loc, t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {d.values.map((v, k) => {
                const y0 = y(acc), y1 = y(acc + v); acc += v;
                return v > 0 ? <rect key={k} x={padL + i * bw + bw * 0.18} width={bw * 0.64} y={y1} height={Math.max(0, y0 - y1)} fill={series[k].color} rx={k === d.values.length - 1 ? 3 : 0}><title>{`${d.label} · ${series[k].name}: ${loc.f.money(v)}`}</title></rect> : null;
              })}
              {i % labelEvery === 0 && <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-2)", marginTop: 6 }}>
        {series.map((s) => <span key={s.name} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><i style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />{s.name}</span>)}
      </figcaption>
    </figure>
  );
}

/** 24-hour activity strip with the best window highlighted. */
export function HourStrip({ loc, hist, best }: { loc: Loc; hist: number[]; best: number }) {
  const max = Math.max(1, ...hist);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(24,1fr)", gap: 2, alignItems: "end", height: 64 }}>
        {hist.map((v, h) => (
          <div key={h} title={`${loc.f.hour(h)}: ${loc.f.n(v)}`} style={{ height: `${Math.max(4, (v / max) * 100)}%`, borderRadius: 2, background: h === best || h === (best + 1) % 24 ? "var(--dak)" : "var(--sky-soft)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{[0, 6, 12, 18, 23].map((h) => <span key={h}>{loc.f.hour(h)}</span>)}</div>
    </div>
  );
}

export function Delta({ loc, now, prev }: { loc: Loc; now: number; prev: number }) {
  if (!prev) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: pct >= 0 ? "var(--leaf)" : "var(--dak)" }}>{pct >= 0 ? "▲" : "▼"} {loc.t("{n}% আগের ৩০ দিন থেকে", { n: Math.abs(pct) })}</span>;
}
