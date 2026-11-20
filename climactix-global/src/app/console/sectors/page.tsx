"use client";

import { Alert, Async, Empty, PageHead, Panel, useApi } from "@/components/cxt/ui";

interface Row { sector_code: string; sector: string; companies: number; companies_reporting: number; reporting_participation_pct: number; companies_scored: number; disclosure_coverage: Record<string, number>; companies_with_net_zero_target: number; score: { median: number; min: number; max: number; average_confidence: number } | null; pillar_averages?: Record<string, number>; suppressed?: string }

export default function Sectors() {
  const r = useApi<{ sectors: Row[]; basis: string; minimum_group_size: number }>("/sectors/aggregates");
  const cov = useApi<{ items: { id: string; legal_name: string; sector: string | null; reporting: boolean; disclosures: Record<string, { documents: number; latest_period: string }> }[] }>("/coverage");
  return (
    <>
      <PageHead title="Sector intelligence" sub="Aggregated indicators drawn from public corporate disclosures. Company-level values are not shown here." />
      <Async r={r}>{(d) => (
        <>
          <Alert kind="info">{d.basis} Statistics are withheld for any group of fewer than {d.minimum_group_size} scored companies.</Alert>
          <Panel title="Sustainability indicators by sector" flush>
            {d.sectors.length === 0 ? <Empty title="No companies in the database yet" /> : (
              <div className="cx-table-wrap"><table className="t">
                <thead><tr><th>Sector</th><th className="r">Companies</th><th className="r">Reporting</th><th className="r">Participation</th><th className="r">Scored</th><th className="r">Median score</th><th className="r">Range</th><th className="r">Avg confidence</th><th className="r">Net zero targets</th></tr></thead>
                <tbody>{d.sectors.map((s) => (
                  <tr key={s.sector_code}><td>{s.sector}</td><td className="r num">{s.companies}</td><td className="r num">{s.companies_reporting}</td><td className="r">{s.reporting_participation_pct}%</td><td className="r">{s.companies_scored}</td>
                    {s.score ? <><td className="r num">{s.score.median}</td><td className="r">{s.score.min}–{s.score.max}</td><td className="r">{s.score.average_confidence}</td></> : <td colSpan={3} className="small muted">{s.suppressed}</td>}
                    <td className="r">{s.companies_with_net_zero_target}</td></tr>))}</tbody></table></div>)}
          </Panel>
          <Panel title="Disclosure coverage by metric" sub="Number of companies in each sector disclosing the metric" flush>
            <div className="cx-table-wrap"><table className="t">
              <thead><tr><th>Sector</th><th className="r">Scope 1</th><th className="r">Scope 3</th><th className="r">Energy</th><th className="r">Water</th><th className="r">Waste</th></tr></thead>
              <tbody>{d.sectors.map((s) => (
                <tr key={s.sector_code}><td>{s.sector}</td>{["scope1", "scope3", "energy", "water", "waste"].map((k) => <td key={k} className="r">{s.disclosure_coverage[k]} / {s.companies}</td>)}</tr>))}</tbody></table></div>
          </Panel>
        </>)}</Async>
      <Panel title="Reporting participation" sub="Which companies have public disclosures on file" flush>
        <Async r={cov}>{(c) => (
          <div className="cx-table-wrap" style={{ maxHeight: 420, overflow: "auto" }}><table className="t">
            <thead><tr><th>Company</th><th>Sector</th><th>Disclosures on file</th></tr></thead>
            <tbody>{c.items.map((i) => <tr key={i.id}><td>{i.legal_name}</td><td>{i.sector ?? "—"}</td><td className="small">{i.reporting ? Object.entries(i.disclosures).map(([k, v]) => `${k.replace(/_/g, " ").toLowerCase()} (${v.latest_period ?? "period n/a"})`).join(", ") : <span className="muted">None</span>}</td></tr>)}</tbody></table></div>)}</Async>
      </Panel>
    </>
  );
}
