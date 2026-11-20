"use client";

import Link from "next/link";
import { useState } from "react";
import { compact, label, num } from "@/lib/cxt/format";
import { Alert, Badge, Kpi, Panel } from "./ui";

export interface NetZeroView {
  summary: {
    net_zero_target: boolean; net_zero_year: number | null; baseline_year: number | null;
    near_term: { reduction_pct: number; target_year: number } | null; long_term: { reduction_pct: number; target_year: number } | null;
    scope_coverage: { scope1: boolean; scope2: boolean; scope3: boolean }; validation_status: string | null;
    baseline_emissions: number | null; latest_emissions: number | null; latest_emissions_year: number | null;
    latest_intensity: number | null; reported_change: { from_year: number; to_year: number; change_pct: number } | null; scope2_basis: string | null;
  };
  declared_targets: { id: string; target_kind: string; horizon: string | null; description: string; scope_coverage: string[]; commitment_class: string; validation_status: string; reduction_pct: number | null; baseline_year: number | null; target_year: number | null; channel: string; verification_status: string; provenance: { document_id: string | null; document_title: string | null; page_no: number | null; quote: string | null } }[];
  validated_targets: unknown[];
  actual_emissions: { fiscal_year: number; fy_label: string; scope1: number | null; scope2: number | null; scope3: number | null; scope1_2: number | null; intensity?: number; intensity_unit?: string }[];
  modelled_trajectory: { points: { fiscal_year: number; value: number }[]; label: string } | null;
  progress: { assessable: boolean; statement?: string; basis?: string; reason?: string; position?: string };
  notes: string[];
}

function Chart({ v, from, to }: { v: NetZeroView; from: number; to: number }) {
  const actual = v.actual_emissions.filter((r) => r.scope1_2 !== null && r.fiscal_year >= from && r.fiscal_year <= to);
  const model = (v.modelled_trajectory?.points ?? []).filter((p) => p.fiscal_year >= from && p.fiscal_year <= to);
  const targets: { year: number; value: number; text: string }[] = [];
  const base = v.summary.baseline_emissions;
  if (base !== null) {
    if (v.summary.near_term) targets.push({ year: v.summary.near_term.target_year, value: base * (1 - v.summary.near_term.reduction_pct / 100), text: `${v.summary.near_term.reduction_pct}% by ${v.summary.near_term.target_year}` });
    if (v.summary.net_zero_year) targets.push({ year: v.summary.net_zero_year, value: 0, text: `Net zero ${v.summary.net_zero_year}` });
  }
  const shownTargets = targets.filter((t) => t.year >= from && t.year <= to);
  const ys = [...actual.map((a) => a.scope1_2 as number), ...model.map((m) => m.value), ...shownTargets.map((t) => t.value), 0];
  if (!actual.length && !model.length) return <p className="t2">No reported Scope 1 and 2 emissions fall in this period range.</p>;
  const maxY = Math.max(...ys) * 1.1 || 1;
  const W = 720, H = 260, L = 64, R = 20, T = 16, B = 32;
  const x = (yr: number) => L + ((yr - from) / Math.max(1, to - from)) * (W - L - R);
  const y = (val: number) => T + (1 - val / maxY) * (H - T - B);
  const yearsTicks = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((yr, _, a) => a.length <= 12 || (yr - from) % Math.ceil(a.length / 10) === 0);
  return (
    <div className="cx-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scope 1 and 2 emissions: reported values, modelled path and declared targets">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line className="grid" x1={L} x2={W - R} y1={y(maxY * f)} y2={y(maxY * f)} /><text x={L - 8} y={y(maxY * f) + 4} textAnchor="end">{compact(maxY * f)}</text></g>)}
        <line className="axis" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
        {yearsTicks.map((yr) => <text key={yr} x={x(yr)} y={H - 10} textAnchor="middle">{yr}</text>)}
        {model.length > 1 && <polyline fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="2 4" points={model.map((m) => `${x(m.fiscal_year)},${y(m.value)}`).join(" ")} />}
        {actual.length > 1 && <polyline fill="none" stroke="var(--accent)" strokeWidth={2.25} points={actual.map((a) => `${x(a.fiscal_year)},${y(a.scope1_2 as number)}`).join(" ")} />}
        {actual.map((a) => <circle key={a.fiscal_year} cx={x(a.fiscal_year)} cy={y(a.scope1_2 as number)} r={4} fill="var(--accent)"><title>{`${a.fy_label}: ${num(a.scope1_2, 0)} tCO2e reported`}</title></circle>)}
        {shownTargets.map((t) => (
          <g key={t.text}>
            <circle cx={x(t.year)} cy={y(t.value)} r={5} fill="var(--bg)" stroke="var(--success)" strokeWidth={2}><title>{`Declared target: ${t.text} (${num(t.value, 0)} tCO2e implied from baseline)`}</title></circle>
            <text x={x(t.year)} y={y(t.value) - 9} textAnchor="middle">{t.text}</text>
          </g>
        ))}
      </svg>
      <div className="cx-legend">
        <span><i />Reported (actual)</span>
        {model.length > 1 && <span><i className="mdl" />Modelled straight-line path to declared target</span>}
        {shownTargets.length > 0 && <span><i className="tgt" />Declared target</span>}
      </div>
    </div>
  );
}

export default function NetZeroPanel({ v }: { v: NetZeroView }) {
  const s = v.summary;
  const years = [...v.actual_emissions.map((a) => a.fiscal_year), ...(v.modelled_trajectory?.points.map((p) => p.fiscal_year) ?? []),
    ...(s.baseline_year ? [s.baseline_year] : []), ...(s.near_term ? [s.near_term.target_year] : []), ...(s.net_zero_year ? [s.net_zero_year] : [])];
  const minY = years.length ? Math.min(...years) : 2020;
  const maxY = years.length ? Math.max(...years) : 2030;
  const [range, setRange] = useState<"reported" | "target" | "all">("all");
  const lastReported = v.actual_emissions.length ? v.actual_emissions[v.actual_emissions.length - 1].fiscal_year : maxY;
  const firstReported = v.actual_emissions.length ? v.actual_emissions[0].fiscal_year : minY;
  const span = range === "reported" ? [firstReported - 1, lastReported + 1] : range === "target" ? [minY, s.near_term?.target_year ?? maxY] : [minY, maxY];
  const scopes = [s.scope_coverage.scope1 && "Scope 1", s.scope_coverage.scope2 && "Scope 2", s.scope_coverage.scope3 && "Scope 3"].filter(Boolean).join(", ");
  return (
    <div className="cx-stack">
      <div className="cx-grid g4">
        <Kpi label="Net zero target" value={s.net_zero_year ?? "None found"} note={s.net_zero_target ? `Validation per source: ${label(s.validation_status)}` : "No net zero target in the documents assessed"} />
        <Kpi label="Near-term target" value={s.near_term ? `${s.near_term.reduction_pct}%` : "—"} note={s.near_term ? `by ${s.near_term.target_year}${s.baseline_year ? ` vs ${s.baseline_year}` : " · no baseline year stated"}` : "No quantified near-term target"} />
        <Kpi label="Latest reported Scope 1+2" value={compact(s.latest_emissions)} unit={s.latest_emissions !== null ? "tCO2e" : undefined} note={s.latest_emissions_year ? `FY${s.latest_emissions_year}${s.scope2_basis ? ` · Scope 2 ${s.scope2_basis.replace("scope2_", "").replace("emissions", "method not stated")}` : ""}` : "Not reported"} />
        <Kpi label="Reported change" value={s.reported_change ? `${s.reported_change.change_pct > 0 ? "+" : ""}${s.reported_change.change_pct}%` : "—"} note={s.reported_change ? `FY${s.reported_change.from_year} to FY${s.reported_change.to_year}` : "Needs two reported periods"} />
      </div>
      <Panel title="Emissions trajectory" sub="Scope 1 and 2, tCO2e" action={
        <div className="seg" role="group" aria-label="Year range">
          {(["reported", "target", "all"] as const).map((r) => <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r === "reported" ? "Reported years" : r === "target" ? "To near-term target" : "Full horizon"}</button>)}
        </div>}>
        <Chart v={v} from={span[0]} to={span[1]} />
        <div style={{ marginTop: 12 }}>
          {v.progress.assessable
            ? <Alert kind={v.progress.position === "behind" ? "warn" : "info"}>{v.progress.statement} <span className="muted">{v.progress.basis}</span></Alert>
            : <Alert kind="warn">{v.progress.reason}</Alert>}
        </div>
      </Panel>
      <Panel title="Declared commitments" sub={`Scope coverage of targets: ${scopes || "not stated"}`} flush>
        {v.declared_targets.length ? (
          <div className="cx-table-wrap"><table className="t">
            <thead><tr><th>Commitment as stated</th><th>Target year</th><th>Baseline</th><th>Scopes</th><th>Strength</th><th>Validation (per source)</th><th>Source</th></tr></thead>
            <tbody>{v.declared_targets.map((t) => (
              <tr key={t.id}>
                <td style={{ maxWidth: 360 }}>{t.description}{t.channel === "company" && <div className="small muted">Company submission</div>}</td>
                <td className="num">{t.target_year ?? "—"}</td><td>{t.baseline_year ?? "—"}</td>
                <td>{t.scope_coverage.join(", ") || "Not stated"}</td>
                <td><Badge t="none" text={label(t.commitment_class)} /></td>
                <td><Badge t={t.validation_status === "validated_third_party" ? "pos" : "none"} text={label(t.validation_status)} /></td>
                <td className="small">{t.provenance.document_id ? <Link href={`/console/documents/${t.provenance.document_id}?page=${t.provenance.page_no ?? 1}`}>{(t.provenance.document_title ?? "Document").slice(0, 40)}{t.provenance.page_no ? `, p.${t.provenance.page_no}` : ""}</Link> : "Questionnaire"}</td>
              </tr>))}</tbody></table></div>
        ) : <div className="cx-state"><h4>No climate targets found</h4><p>No emissions target was found in the documents assessed for this company.</p></div>}
      </Panel>
      <Panel title="Reported emissions by period" flush>
        {v.actual_emissions.length ? (
          <div className="cx-table-wrap"><table className="t">
            <thead><tr><th>Period</th><th className="r">Scope 1</th><th className="r">Scope 2</th><th className="r">Scope 3</th><th className="r">Scope 1+2</th><th className="r">Intensity</th></tr></thead>
            <tbody>{v.actual_emissions.map((r) => (
              <tr key={r.fiscal_year}><td>{r.fy_label}</td><td className="r num">{num(r.scope1)}</td><td className="r num">{num(r.scope2)}</td><td className="r num">{num(r.scope3)}</td><td className="r num">{num(r.scope1_2)}</td>
                <td className="r">{r.intensity ? `${r.intensity.toFixed(2)} ${r.intensity_unit}` : "—"}</td></tr>))}</tbody></table></div>
        ) : <div className="cx-state"><h4>No emissions reported</h4><p>No Scope 1, 2 or 3 figures were found in the documents assessed.</p></div>}
      </Panel>
      <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{v.notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}
