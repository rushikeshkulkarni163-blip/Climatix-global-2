"use client";

import Link from "next/link";
import { useState } from "react";
import type { ScoreOut } from "@/lib/cxt/api";
import { date, label, num, tone } from "@/lib/cxt/format";
import { Badge, Bar, Kpi } from "./ui";

const BASIS: Record<string, string> = {
  verified: "Verified evidence", partly_verified: "Partly verified", unverified: "Unverified extraction", derived: "Derived",
};

export function ScoreHeadline({ s, benchmark, title }: { s: ScoreOut | null; benchmark?: { available: boolean; median?: number; percentile?: number | null; sector?: string; companies_scored?: number; reason?: string }; title: string }) {
  if (!s || !s.result) {
    return (
      <div className="cx-grid g4">
        <Kpi lead label={title} value="—" note="No score has been generated. Scores are produced once public reports have been ingested and processed." />
      </div>
    );
  }
  const r = s.result;
  return (
    <div className="cx-grid g4">
      <Kpi lead label={title} value={s.overall === null ? "Withheld" : s.overall.toFixed(1)} unit={s.overall === null ? undefined : "/ 100"}
        note={s.overall === null ? "Insufficient evidence for an overall score" : <span><span className={`dot ${tone(s.overall)}`} /> {r.pillars.filter((p) => p.status === "scored").length} of 6 pillars evidenced</span>} />
      <Kpi label="Data Confidence" value={s.confidence.toFixed(0)} unit="/ 100"
        note={`${label(r.confidence.band)} · how complete, verified and recent the evidence is`} />
      <Kpi label="Evidence coverage" value={s.evidence_coverage.toFixed(0)} unit="%"
        note={`${r.gaps.length} indicator(s) not scorable — excluded, not scored as zero`} />
      <Kpi label="Sector benchmark" value={benchmark?.available ? `${benchmark.median}` : "—"} unit={benchmark?.available ? "median" : undefined}
        note={benchmark?.available ? `${benchmark.sector}: ${benchmark.companies_scored} companies${benchmark.percentile !== null && benchmark.percentile !== undefined ? ` · above ${benchmark.percentile}% of peers` : ""}` : benchmark?.reason ?? "Not available"} />
    </div>
  );
}

export function ScoreMeta({ s }: { s: ScoreOut }) {
  return (
    <p className="small muted">
      Methodology {s.methodology_version} · engine {s.engine_version} · computed {date(s.computed_at, true)} · latest evidence {s.fy_label ?? "—"} ·{" "}
      <Link href={`/console/scores/${s.id}`}>reproducibility record</Link>
    </p>
  );
}

export function PillarBreakdown({ s, benchmarkPillars }: { s: ScoreOut; benchmarkPillars?: Record<string, { median: number }> }) {
  const [open, setOpen] = useState<string | null>(null);
  const r = s.result!;
  return (
    <div className="cx-stack">
      {r.pillars.map((p) => (
        <div key={p.id} className="cx-panel">
          <button onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}
            style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(0,1.6fr) 60px minmax(80px,1.4fr) 90px", gap: 16, alignItems: "center", padding: "12px 16px", width: "100%", boxSizing: "border-box" }}>
            <div><b style={{ fontFamily: "var(--font-heading)" }}>{p.name}</b><div className="small muted">Weight {p.weight}% · {p.indicator_coverage.toFixed(0)}% of indicators evidenced</div></div>
            <div className="num" style={{ fontSize: 18 }}>{p.score === null ? "—" : p.score.toFixed(1)}</div>
            <Bar value={p.score} benchmark={benchmarkPillars?.[p.id]?.median} />
            <div style={{ textAlign: "right" }}>{p.status === "scored" ? (p.deductions.length ? <Badge t="warn" text={`−${p.deductions.reduce((a, d) => a + d.points, 0)} pts`} /> : null) : <Badge s="insufficient_evidence" />}</div>
          </button>
          {open === p.id && (
            <div style={{ padding: "0 16px 12px", borderTop: "1px solid var(--border-soft)" }}>
              <p className="small t2" style={{ padding: "10px 0" }}>{p.description}</p>
              {p.indicators.map((i) => (
                <div key={i.id} className="cx-ind">
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.name}</div>
                    <div className="small muted">Weight {i.weight} within pillar</div>
                  </div>
                  <div className="num" style={{ fontSize: 16 }}>{i.score === null ? "—" : i.score.toFixed(0)}</div>
                  <div>
                    <div className="cx-row" style={{ gap: 6, marginBottom: 4 }}>
                      <Badge t={i.status !== "scored" ? "warn" : i.band === "poor" ? "crit" : i.band === "strong" ? "pos" : "none"} text={i.classification} />
                      {i.evidence_basis && <Badge t={i.evidence_basis === "verified" ? "pos" : "none"} text={BASIS[i.evidence_basis]} />}
                    </div>
                    <div className="t2">{i.explanation}</div>
                    {i.evidence.length > 0 && (
                      <div className="small" style={{ marginTop: 4 }}>
                        Evidence:{" "}
                        {i.evidence.map((e, n) => (
                          <span key={n}>
                            {n > 0 && ", "}
                            {e.kind === "data_point" && e.id ? <Link href={`/console/data-points/${e.id}`}>{e.metric.replace(/_/g, " ")}{e.fy ? ` FY${e.fy}` : ""}</Link> : <span>{e.metric.replace(/_/g, " ")}{e.fy ? ` FY${e.fy}` : ""}</span>}
                            {e.src === "company" && <span className="muted"> (company)</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {p.deductions.map((d) => (
                <div key={d.id} className="cx-alert warn" style={{ marginTop: 8 }}>Deduction −{d.points} points: {d.reason} ({d.count})</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Findings({ s }: { s: ScoreOut }) {
  const r = s.result!;
  return (
    <div className="cx-grid g2">
      <div className="cx-panel"><div className="hd"><h3>Key strengths</h3></div><div className="bd">
        {r.strengths.length ? r.strengths.map((x) => (
          <div key={x.indicator} className="cx-ind" style={{ gridTemplateColumns: "1fr 50px" }}>
            <div><b>{x.indicator}</b><div className="small t2">{x.explanation}</div></div><div className="num">{x.score.toFixed(0)}</div>
          </div>)) : <p className="t2">No indicator reaches the strong band on the evidence available.</p>}
      </div></div>
      <div className="cx-panel"><div className="hd"><h3>Improvement areas</h3></div><div className="bd">
        {r.improvements.length ? r.improvements.map((x) => (
          <div key={x.indicator} className="cx-ind" style={{ gridTemplateColumns: "1fr 50px" }}>
            <div><b>{x.indicator}</b><div className="small t2">{x.explanation}</div></div><div className="num">{x.score.toFixed(0)}</div>
          </div>)) : <p className="t2">No scored indicator falls in the improvement range.</p>}
      </div></div>
      <div className="cx-panel"><div className="hd"><h3>Reasons for deductions</h3></div><div className="bd">
        {r.deductions.length ? r.deductions.map((d) => <p key={d.id} className="t2">−{d.points} points ({d.pillar}): {d.reason}</p>) : <p className="t2">No deductions were applied.</p>}
      </div></div>
      <div className="cx-panel"><div className="hd"><h3>Not scorable</h3><span className="small muted">Excluded from the score; lowers confidence</span></div><div className="bd">
        {r.gaps.length ? (
          <div className="cx-table-wrap"><table className="t"><tbody>{r.gaps.map((g) => (
            <tr key={g.indicator}><td>{g.indicator}<div className="small muted">{g.pillar}</div></td><td><Badge t="warn" text={g.classification} /></td></tr>
          ))}</tbody></table></div>
        ) : <p className="t2">Every indicator was scored.</p>}
        {r.unverified_claims.length > 0 && (
          <p className="small" style={{ marginTop: 8 }}>Unverified company claims (listed, not scored): {r.unverified_claims.map((c) => c.label).join("; ")}</p>
        )}
      </div></div>
    </div>
  );
}

export function ConfidenceDetail({ s }: { s: ScoreOut }) {
  const c = s.result!.confidence;
  const names: Record<string, string> = { coverage: "Evidence coverage", verification: "Reviewer verification", extraction: "Extraction reliability", recency: "Recency" };
  return (
    <div className="cx-table-wrap"><table className="t">
      <thead><tr><th>Component</th><th className="r">Weight</th><th className="r">Value</th><th style={{ width: "40%" }} /></tr></thead>
      <tbody>{Object.entries(c.components).map(([k, v]) => (
        <tr key={k}><td>{names[k] ?? k}</td><td className="r">{Math.round((c.weights[k] ?? 0) * 100)}%</td><td className="r num">{num(v, 0)}</td><td><Bar plain value={v} /></td></tr>
      ))}</tbody>
    </table></div>
  );
}

/** Score movement over successive versions. */
export function ScoreHistoryChart({ history }: { history: { computed_at: string; overall: number | null; confidence: number; score_type: string; methodology_version: string | null }[] }) {
  const pts = history.filter((h) => h.score_type === "public");
  if (pts.length < 2) return <p className="t2 small">Score movement appears once the company has been re-assessed at least once.</p>;
  const W = 640, H = 180, P = 32;
  const x = (i: number) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  const line = (k: "overall" | "confidence") => pts.map((p, i) => (p[k] === null ? null : `${x(i)},${y(p[k] as number)}`)).filter(Boolean).join(" ");
  return (
    <div className="cx-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Public Data Score and Data Confidence over successive assessments">
        {[0, 25, 50, 75, 100].map((v) => <g key={v}><line className="grid" x1={P} x2={W - P} y1={y(v)} y2={y(v)} /><text x={4} y={y(v) + 4}>{v}</text></g>)}
        <polyline fill="none" stroke="var(--accent)" strokeWidth={2} points={line("overall")} />
        <polyline fill="none" stroke="var(--text-2)" strokeWidth={1.5} strokeDasharray="4 3" points={line("confidence")} />
        {pts.map((p, i) => (
          <g key={i}>
            {p.overall !== null && <circle cx={x(i)} cy={y(p.overall)} r={3.5} fill="var(--accent)"><title>{`${date(p.computed_at, true)} · score ${p.overall.toFixed(1)} · methodology ${p.methodology_version}`}</title></circle>}
            <text x={x(i)} y={H - 8} textAnchor="middle">v{i + 1}</text>
          </g>
        ))}
      </svg>
      <div className="cx-legend"><span><i />Public Data Score</span><span><i className="dash" />Data Confidence</span></div>
    </div>
  );
}
