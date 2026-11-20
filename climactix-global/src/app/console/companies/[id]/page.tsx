"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import NetZeroPanel, { type NetZeroView } from "@/components/cxt/NetZero";
import Repository from "@/components/cxt/Repository";
import { ConfidenceDetail, Findings, PillarBreakdown, ScoreHeadline, ScoreHistoryChart, ScoreMeta } from "@/components/cxt/Score";
import { ActionButton, Alert, Async, Badge, Empty, PageHead, Panel, Synthetic, Tabs, can, entitled, useApi, useMe } from "@/components/cxt/ui";
import { api, type DataPointOut, type MetricSeries, type ScoreOut } from "@/lib/cxt/api";
import { date, label, num } from "@/lib/cxt/format";

interface Profile {
  company: { id: string; cx_id: string; legal_name: string; common_name: string | null; country: string; sector: string | null; industry: string | null; registration_id: string | null; registration_type: string | null; website: string | null; headquarters: string | null; description: string | null; is_synthetic: boolean; aliases: string[]; share_company_score: boolean; created_at: string };
  access_level: "private" | "intelligence" | "directory"; withheld: string[];
  reporting_periods: number[]; document_count: number; documents_by_category: Record<string, number>;
  public_score?: ScoreOut | null; company_score?: ScoreOut | null;
  benchmark?: { available: boolean; median?: number; percentile?: number | null; sector?: string; companies_scored?: number; reason?: string; pillars?: Record<string, { median: number }> };
  score_history?: (ScoreOut & { score_type: string })[];
  metrics?: MetricSeries[]; signals?: DataPointOut[];
  assessment_history?: { id: string; channel: string; version_no: number; status: string; fiscal_year: number | null; created_at: string; trigger: string | null }[];
}

type Tab = "overview" | "score" | "data" | "repository" | "netzero" | "history";
const CATS: [string, string][] = [["climate", "Emissions and climate"], ["environmental", "Environmental performance"], ["social", "Social"], ["governance", "Governance"], ["financial", "Financial"]];
const SIGNAL_GROUPS: [string, string][] = [["climate", "Climate strategy and risk"], ["governance", "Governance and disclosure"], ["social", "Social"], ["environmental", "Environmental management"]];

function MetricsTable({ metrics, category }: { metrics: MetricSeries[]; category: string }) {
  const rows = metrics.filter((m) => m.category === category);
  if (!rows.length) return <p className="t2 small" style={{ padding: 16 }}>No quantitative disclosures in this area were found in the documents assessed.</p>;
  const years = Array.from(new Set(rows.flatMap((m) => Object.keys(m.values)))).sort().reverse().slice(0, 4);
  return (
    <div className="cx-table-wrap"><table className="t">
      <thead><tr><th>Metric</th><th>Unit</th>{years.map((y) => <th key={y} className="r">FY{Number(y) - 1}-{y.slice(2)}</th>)}</tr></thead>
      <tbody>{rows.map((m) => (
        <tr key={m.metric_key}><td>{m.name}</td><td className="small muted">{m.unit}</td>
          {years.map((y) => {
            const v = m.values[y];
            return <td key={y} className="r">{v ? (
              <Link href={`/console/data-points/${v.data_point_id}`} title={`As reported: ${num(v.as_reported, 2)} ${v.as_reported_unit} · ${label(v.verification_status)} · confidence ${v.confidence.toFixed(0)}`}>
                <span className="num">{num(v.value, v.value < 100 ? 2 : 0)}</span>{v.verification_status === "verified" || v.verification_status === "evidence_accepted" ? " ✓" : ""}{v.channel === "company" && <sup className="muted"> co</sup>}
              </Link>) : <span className="muted">—</span>}</td>;
          })}
        </tr>))}</tbody>
    </table></div>
  );
}

function ProfileBody() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { me } = useMe();
  const [tab, setTab] = useState<Tab>((sp?.get("tab") as Tab) || "overview");
  const r = useApi<Profile>(`/companies/${id}`);
  const p = r.data;
  const intel = p && p.access_level !== "directory";
  const nz = useApi<NetZeroView>(intel && tab === "netzero" && (p!.access_level === "private" || entitled(me, "net_zero_intelligence")) ? `/companies/${id}/net-zero` : null);
  const own = me?.user.role === "company_admin" && me.organisation.company_id === id;

  return (
    <Async r={r} rows={8}>{(p) => {
      const c = p.company;
      const pub = p.public_score ?? null;
      const tabs: [Tab, string][] = p.access_level === "directory" ? [["overview", "Overview"], ["repository", "Reports"]]
        : [["overview", "Overview"], ["score", "Climactix Score"], ["data", "Disclosures and evidence"], ["repository", "Report repository"], ["netzero", "Net Zero"], ["history", "Assessment history"]];
      return (
        <>
          <PageHead eyebrow={<>{c.cx_id}{c.registration_id ? ` · ${c.registration_type} ${c.registration_id}` : ""}</>}
            title={<span className="cx-row" style={{ gap: 10 }}>{c.legal_name}<Synthetic on={c.is_synthetic} /></span>}
            sub={[c.sector, c.industry, c.country, c.headquarters].filter(Boolean).join(" · ")}
            actions={<>
              {intel && entitled(me, "report_download") && can(me, "report.generate") && (
                <ActionButton className="btn" run={async () => {
                  const rep = await api.post<{ id: string }>(`/companies/${id}/report`, undefined, { include_company_assessment: own || undefined });
                  window.location.href = api.url(`/reports/${rep.id}/download`);
                }}>Generate intelligence report</ActionButton>)}
              {can(me, "score.compute") && <ActionButton className="btn sec" run={async () => { await api.post(`/companies/${id}/assess`); r.reload(); }} done="Public assessment re-run">Re-run assessment</ActionButton>}
            </>} />
          {c.is_synthetic && <Alert kind="warn">Synthetic entity: this record and its documents were created for demonstration and testing. It does not describe a real organisation.</Alert>}
          {p.access_level === "directory" && (
            <Alert kind="info">Your organisation has directory access to this company. Scores, extracted data and Net Zero intelligence are available to institutional subscribers{me?.organisation.type === "government" ? "; government users see sector-level aggregates" : ""}.</Alert>)}
          <Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); router.replace(`/console/companies/${id}?tab=${t}`, { scroll: false }); }} />

          {tab === "overview" && (
            <>
              {intel && <ScoreHeadline title="Public Data Score" s={pub} benchmark={p.benchmark} />}
              {intel && p.company_score && (
                <Panel title="Company Assessment Score" sub="Public evidence plus company submissions whose evidence a Climactix reviewer accepted. Shown separately; it never alters the Public Data Score.">
                  <div className="cx-row" style={{ gap: 24 }}>
                    <div><div className="eyebrow">Score</div><div className="num" style={{ fontSize: 28, color: "var(--accent)" }}>{p.company_score.overall?.toFixed(1) ?? "Withheld"}</div></div>
                    <div><div className="eyebrow">Data Confidence</div><div className="num" style={{ fontSize: 28 }}>{p.company_score.confidence.toFixed(0)}</div></div>
                    <div className="small t2">Computed {date(p.company_score.computed_at)} · {p.company_score.result?.unverified_claims.length ?? 0} unverified claim(s) not scored</div>
                  </div>
                </Panel>)}
              {own && (
                <Panel title="Sharing">
                  <div className="cx-row"><span className="t2">Institutional users {c.share_company_score ? "can" : "cannot"} see your Company Assessment Score. Your submissions themselves are never shared.</span>
                    <ActionButton className="btn sec sm" run={async () => { await api.put(`/companies/${id}/sharing`, undefined, { share: !c.share_company_score }); r.reload(); }}>
                      {c.share_company_score ? "Stop sharing" : "Share with institutional users"}</ActionButton></div>
                </Panel>)}
              <div className="cx-grid side">
                <Panel title="Corporate information">
                  <dl className="cx-kv">
                    <dt>Legal name</dt><dd>{c.legal_name}</dd>
                    {c.common_name && <><dt>Common name</dt><dd>{c.common_name}</dd></>}
                    {c.aliases.length > 0 && <><dt>Also known as</dt><dd>{c.aliases.join("; ")}</dd></>}
                    <dt>Climactix ID</dt><dd>{c.cx_id}</dd>
                    <dt>Registration</dt><dd>{c.registration_id ? `${c.registration_type} ${c.registration_id}` : "Not recorded"}</dd>
                    <dt>Sector</dt><dd>{c.sector ?? "Unclassified"}{c.industry ? ` · ${c.industry}` : ""}</dd>
                    <dt>Country</dt><dd>{c.country}</dd>
                    {c.headquarters && <><dt>Headquarters</dt><dd>{c.headquarters}</dd></>}
                    {c.website && <><dt>Website</dt><dd><a href={c.website} target="_blank" rel="noreferrer noopener">{c.website}</a></dd></>}
                    <dt>Reporting periods</dt><dd>{p.reporting_periods.length ? p.reporting_periods.map((y) => `FY${y - 1}-${String(y).slice(2)}`).join(", ") : "None on file"}</dd>
                  </dl>
                  {c.description && <p className="t2 measure" style={{ marginTop: 12 }}>{c.description}</p>}
                </Panel>
                <Panel title="Disclosures on file">
                  {Object.keys(p.documents_by_category).length ? (
                    <table className="t"><tbody>{Object.entries(p.documents_by_category).map(([k, n]) => <tr key={k}><td>{label(k)}</td><td className="r num">{n}</td></tr>)}</tbody></table>
                  ) : <Empty title="No public disclosures">No reports have been ingested for this company.</Empty>}
                </Panel>
              </div>
              {intel && pub?.result && <Findings s={pub} />}
            </>)}

          {tab === "score" && intel && (pub?.result ? (
            <>
              <ScoreHeadline title="Public Data Score" s={pub} benchmark={p.benchmark} />
              <Alert kind="info">{pub.result.summary}</Alert>
              <PillarBreakdown s={pub} benchmarkPillars={p.benchmark?.pillars} />
              <div className="cx-grid g2">
                <Panel title="Data Confidence Score" sub="Independent of performance: measures the evidence, not the result."><ConfidenceDetail s={pub} /></Panel>
                <Panel title="Score movement"><ScoreHistoryChart history={(p.score_history ?? []) as never} /></Panel>
              </div>
              <ScoreMeta s={pub} />
              <p className="small muted measure">The Climactix Score is an independent, methodology-based assessment of disclosed information. It is not a certification, a credit rating, an assurance opinion or investment advice, and no payment influences it.</p>
            </>) : <div className="cx-panel"><Empty title="Not yet assessed">A score is generated automatically once a public report for this company has been processed.</Empty></div>)}

          {tab === "data" && intel && (
            <>
              <p className="t2 small">Values are shown in normalised units. Hover for the value as reported; select a value to see its source page, quote, method and review status. ✓ marks reviewer-verified values{p.access_level === "private" ? "; co marks company-submitted values" : ""}.</p>
              {CATS.map(([k, t]) => <Panel key={k} title={t} flush><MetricsTable metrics={p.metrics ?? []} category={k} /></Panel>)}
              <Panel title="Qualitative disclosures" sub="Statements found in the documents. 'Explicit no' means the company states the practice is not in place.">
                {(p.signals ?? []).length ? (
                  <div className="cx-grid g2">{SIGNAL_GROUPS.map(([k, t]) => {
                    const rows = (p.signals ?? []).filter((s) => s.category === k);
                    if (!rows.length) return null;
                    return (<div key={k}><h4 style={{ fontSize: 13, marginBottom: 6 }}>{t}</h4>
                      {rows.map((s) => (
                        <div key={s.id} className="cx-row" style={{ justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border-soft)" }}>
                          <Link href={`/console/data-points/${s.id}`}>{s.metric}</Link>
                          <Badge t={s.value_text === "explicit_no" ? "crit" : "none"} text={s.value_text === "explicit_no" ? "Explicit no" : "Stated"} />
                        </div>))}</div>);
                  })}</div>
                ) : <p className="t2">No qualitative disclosures were found.</p>}
              </Panel>
            </>)}

          {tab === "repository" && <Repository companyId={id} canUpload={can(me, "document.ingest_public") || own} privateUpload={own} />}

          {tab === "netzero" && intel && (
            p.access_level !== "private" && !entitled(me, "net_zero_intelligence")
              ? <div className="cx-panel"><Empty title="Net Zero intelligence is not included in your subscription" /></div>
              : <Async r={nz}>{(v) => <NetZeroPanel v={v} />}</Async>)}

          {tab === "history" && intel && (
            <>
              <Panel title="Score versions" flush>
                <div className="cx-table-wrap"><table className="t">
                  <thead><tr><th>Computed</th><th>Type</th><th className="r">Score</th><th className="r">Confidence</th><th>Methodology</th><th>Trigger</th><th /></tr></thead>
                  <tbody>{(p.score_history ?? []).slice().reverse().map((s) => (
                    <tr key={s.id}><td>{date(s.computed_at, true)} {s.is_current && <Badge t="accent" text="Current" />}</td>
                      <td>{s.score_type === "public" ? "Public Data" : "Company Assessment"}</td>
                      <td className="r num">{s.overall?.toFixed(1) ?? "Withheld"}</td><td className="r num">{s.confidence.toFixed(0)}</td>
                      <td>{s.methodology_version}</td><td className="small muted">{s.trigger}</td>
                      <td className="r"><Link href={`/console/scores/${s.id}`} className="small">Detail</Link></td></tr>))}</tbody>
                </table></div>
              </Panel>
              <Panel title="Assessment versions" flush>
                <div className="cx-table-wrap"><table className="t">
                  <thead><tr><th>Created</th><th>Channel</th><th>Version</th><th>Period</th><th>Status</th><th>Trigger</th></tr></thead>
                  <tbody>{(p.assessment_history ?? []).map((a) => (
                    <tr key={a.id}><td>{date(a.created_at, true)}</td><td>{a.channel === "public" ? "Public data" : "Company submission"}</td><td>v{a.version_no}</td>
                      <td>{a.fiscal_year ? `FY${a.fiscal_year - 1}-${String(a.fiscal_year).slice(2)}` : "—"}</td><td><Badge s={a.status} /></td><td className="small muted">{a.trigger ?? "—"}</td></tr>))}</tbody>
                </table></div>
              </Panel>
            </>)}
        </>
      );
    }}</Async>
  );
}

export default function CompanyPage() {
  return <Suspense><ProfileBody /></Suspense>;
}
