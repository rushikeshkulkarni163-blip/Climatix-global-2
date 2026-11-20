"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CompanyPicker from "@/components/cxt/CompanyPicker";
import { ActionButton, Alert, Async, Badge, Bar, Empty, Kpi, PageHead, Panel, Synthetic, useApi, useToast } from "@/components/cxt/ui";
import { api, type CompanyBrief } from "@/lib/cxt/api";
import { label } from "@/lib/cxt/format";

interface Holding extends CompanyBrief { score: number | null; score_status: string; confidence: number | null; previous_score: number | null; score_change: number | null; net_zero: { target_year: number } | null; latest_period: string | null; note: string | null }
interface PF { id: string; name: string; description: string | null; holdings: Holding[]; summary: { companies: number; scored: number; insufficient_evidence: number; not_assessed: number; average_score: number | null; average_confidence: number | null; with_net_zero_target: number; score_bands: Record<string, number> }; by_sector: { sector: string; companies: number; average_score: number | null }[]; note: string }

export default function PortfolioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const r = useApi<PF>(`/portfolios/${id}`);
  return (
    <Async r={r} rows={8}>{(p) => (
      <>
        <PageHead title={p.name} sub={p.description ?? undefined} actions={
          <ActionButton className="btn danger" confirm={`Delete ${p.name}? The companies themselves are not affected.`} run={async () => { await api.del(`/portfolios/${id}`); router.replace("/console/portfolios"); }}>Delete</ActionButton>} />
        <div className="cx-grid g4">
          <Kpi lead label="Average score" value={p.summary.average_score ?? "—"} note={`${p.summary.scored} of ${p.summary.companies} companies scored`} />
          <Kpi label="Average confidence" value={p.summary.average_confidence ?? "—"} />
          <Kpi label="Net zero target" value={`${p.summary.with_net_zero_target} / ${p.summary.companies}`} note="companies with a target found" />
          <Kpi label="Evidence gaps" value={p.summary.insufficient_evidence + p.summary.not_assessed} note={`${p.summary.insufficient_evidence} insufficient evidence · ${p.summary.not_assessed} not assessed`} />
        </div>
        <Panel title="Holdings" action={<CompanyPicker exclude={p.holdings.map((h) => h.id)} placeholder="Add a company" onPick={async (c) => {
          try { await api.post(`/portfolios/${id}/companies`, { company_id: c.id }); r.reload(); } catch (e) { toast(e instanceof Error ? e.message : "Failed"); }
        }} />} flush>
          {p.holdings.length === 0 ? <Empty title="No companies yet">Use the search box to add companies.</Empty> : (
            <div className="cx-table-wrap"><table className="t">
              <thead><tr><th>Company</th><th>Sector</th><th className="r">Score</th><th style={{ width: 110 }} /><th className="r">Change</th><th className="r">Confidence</th><th>Net Zero</th><th /></tr></thead>
              <tbody>{p.holdings.map((h) => (
                <tr key={h.id}>
                  <td><Link href={`/console/companies/${h.id}`}>{h.legal_name}</Link> <Synthetic on={h.is_synthetic} /><div className="small muted">{h.latest_period ?? ""}</div></td>
                  <td>{h.sector ?? "—"}</td>
                  <td className="r num">{h.score?.toFixed(1) ?? <Badge t="warn" text={label(h.score_status)} />}</td><td><Bar value={h.score} /></td>
                  <td className="r">{h.score_change === null ? "—" : <span className="num" style={{ color: h.score_change > 0 ? "var(--success)" : h.score_change < 0 ? "var(--critical)" : undefined }}>{h.score_change > 0 ? "+" : ""}{h.score_change}</span>}</td>
                  <td className="r num">{h.confidence?.toFixed(0) ?? "—"}</td>
                  <td>{h.net_zero?.target_year ?? <span className="muted">None found</span>}</td>
                  <td className="r"><ActionButton className="btn ghost sm" run={async () => { await api.del(`/portfolios/${id}/companies/${h.id}`); r.reload(); }}>Remove</ActionButton></td>
                </tr>))}</tbody></table></div>)}
        </Panel>
        <div className="cx-grid g2">
          <Panel title="Score distribution"><table className="t"><tbody>{Object.entries(p.summary.score_bands).map(([b, n]) => <tr key={b}><td>{b}</td><td className="r num">{n}</td><td style={{ width: "50%" }}><Bar plain value={p.summary.scored ? (100 * n) / p.summary.scored : 0} /></td></tr>)}</tbody></table></Panel>
          <Panel title="By sector"><table className="t"><tbody>{p.by_sector.map((s) => <tr key={s.sector}><td>{s.sector}</td><td className="r">{s.companies}</td><td className="r num">{s.average_score ?? "—"}</td></tr>)}</tbody></table></Panel>
        </div>
        <Alert kind="info">{p.note}</Alert>
      </>)}</Async>
  );
}
