"use client";

import Link from "next/link";
import { useState } from "react";
import CompanyPicker from "@/components/cxt/CompanyPicker";
import { Alert, Badge, Bar, Empty, ErrorState, Loading, PageHead, Panel, Synthetic } from "@/components/cxt/ui";
import { ApiError, api, type CompanyBrief } from "@/lib/cxt/api";
import { label, num } from "@/lib/cxt/format";

interface Row extends CompanyBrief {
  score: number | null; score_status: string; confidence: number | null; pillars: Record<string, number | null> | null; evidence_coverage: number | null; latest_period: string | null;
  indicators: Record<string, { value: number; unit: string; fy_label: string; verification_status: string }>;
  net_zero: { net_zero_target: boolean; net_zero_year: number | null; near_term: { reduction_pct: number; target_year: number } | null; validation_status: string | null; scope_coverage: Record<string, boolean> };
  progress: { assessable: boolean; statement?: string; reason?: string };
  benchmark: { available: boolean; median?: number; percentile?: number | null };
  strengths: { indicator: string }[]; improvements: { indicator: string }[]; gaps: number | null;
}
const PILLARS: [string, string][] = [["environmental_performance", "Environmental performance"], ["climate_risk_exposure", "Climate-risk exposure"], ["transition_readiness", "Transition readiness"], ["resource_efficiency", "Resource efficiency"], ["governance_disclosure", "Governance and disclosure"], ["evidence_credibility", "Evidence and credibility"]];
const INDICATORS: [string, string][] = [["scope1_emissions", "Scope 1 emissions"], ["scope2_location", "Scope 2 (location-based)"], ["scope2_market", "Scope 2 (market-based)"], ["scope3_emissions", "Scope 3 emissions"], ["total_energy", "Energy consumption"], ["renewable_energy_share", "Renewable energy share"], ["water_withdrawal", "Water withdrawal"], ["total_waste", "Waste generated"], ["environmental_incidents", "Environmental incidents"]];

export default function ComparePage() {
  const [picked, setPicked] = useState<CompanyBrief[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (list: CompanyBrief[]) => {
    if (list.length < 2) { setRows(null); return; }
    setBusy(true); setErr(null);
    try { const r = await api.post<{ companies: Row[]; note: string }>("/compare", { company_ids: list.map((c) => c.id) }); setRows(r.companies); setNote(r.note); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const update = (list: CompanyBrief[]) => { setPicked(list); run(list); };
  return (
    <>
      <PageHead title="Compare companies" sub="Select two to six companies. Values are as reported, in normalised units, for each company's latest period." />
      <Panel>
        <div className="cx-row">
          {picked.length < 6 && <CompanyPicker exclude={picked.map((p) => p.id)} onPick={(c) => update([...picked, c])} placeholder="Add a company" />}
          {picked.map((c) => <span key={c.id} className="badge accent">{c.legal_name} <button aria-label={`Remove ${c.legal_name}`} onClick={() => update(picked.filter((p) => p.id !== c.id))} style={{ all: "unset", cursor: "pointer", marginLeft: 4 }}>×</button></span>)}
        </div>
      </Panel>
      {err ? <div className="cx-panel"><ErrorState error={err} /></div> : busy ? <Loading rows={6} /> : !rows ? (
        <div className="cx-panel"><Empty title="Choose at least two companies">The comparison appears here.</Empty></div>
      ) : (
        <>
          <Alert kind="info">{note}</Alert>
          <Panel flush>
            <div className="cx-table-wrap"><table className="t">
              <thead><tr><th style={{ minWidth: 200 }} />{rows.map((r) => <th key={r.id} style={{ minWidth: 160 }}><Link href={`/console/companies/${r.id}`}>{r.legal_name}</Link> <Synthetic on={r.is_synthetic} /><div className="small muted" style={{ fontWeight: 400 }}>{r.sector}</div></th>)}</tr></thead>
              <tbody>
                <tr className="sub"><td colSpan={rows.length + 1}>Climactix Score</td></tr>
                <tr><td>Public Data Score</td>{rows.map((r) => <td key={r.id}><span className="num" style={{ fontSize: 18 }}>{r.score?.toFixed(1) ?? label(r.score_status)}</span><Bar value={r.score} benchmark={r.benchmark.available ? r.benchmark.median : null} /></td>)}</tr>
                <tr><td>Data Confidence</td>{rows.map((r) => <td key={r.id} className="num">{r.confidence?.toFixed(0) ?? "—"}</td>)}</tr>
                <tr><td>Sector percentile</td>{rows.map((r) => <td key={r.id}>{r.benchmark.available && r.benchmark.percentile !== null && r.benchmark.percentile !== undefined ? `Above ${r.benchmark.percentile}%` : "Not available"}</td>)}</tr>
                <tr><td>Indicators not scorable</td>{rows.map((r) => <td key={r.id}>{r.gaps ?? "—"}</td>)}</tr>
                {PILLARS.map(([k, n]) => <tr key={k}><td>{n}</td>{rows.map((r) => <td key={r.id} className="num">{r.pillars?.[k]?.toFixed(1) ?? "—"}</td>)}</tr>)}
                <tr className="sub"><td colSpan={rows.length + 1}>Reported indicators (latest period)</td></tr>
                {INDICATORS.map(([k, n]) => <tr key={k}><td>{n}</td>{rows.map((r) => { const v = r.indicators[k]; return <td key={r.id}>{v ? <><span className="num">{num(v.value, v.value < 100 ? 1 : 0)}</span> <span className="small muted">{v.unit} · {v.fy_label}</span></> : <span className="muted">Not disclosed</span>}</td>; })}</tr>)}
                <tr className="sub"><td colSpan={rows.length + 1}>Net Zero</td></tr>
                <tr><td>Net zero target</td>{rows.map((r) => <td key={r.id}>{r.net_zero.net_zero_year ?? "None found"}</td>)}</tr>
                <tr><td>Near-term target</td>{rows.map((r) => <td key={r.id}>{r.net_zero.near_term ? `${r.net_zero.near_term.reduction_pct}% by ${r.net_zero.near_term.target_year}` : "—"}</td>)}</tr>
                <tr><td>Validation (per source)</td>{rows.map((r) => <td key={r.id}><Badge t="none" text={label(r.net_zero.validation_status)} /></td>)}</tr>
                <tr><td>Progress</td>{rows.map((r) => <td key={r.id} className="small t2">{r.progress.assessable ? r.progress.statement : "Not assessable on available evidence"}</td>)}</tr>
              </tbody>
            </table></div>
          </Panel>
        </>)}
    </>
  );
}
