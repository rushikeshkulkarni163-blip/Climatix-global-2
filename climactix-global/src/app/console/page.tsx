"use client";

import Link from "next/link";
import { Alert, Async, Badge, Empty, Kpi, PageHead, Panel, can, entitled, useApi, useMe } from "@/components/cxt/ui";
import { date, label } from "@/lib/cxt/format";

interface Workspace { title: string; purpose: string; portfolio_label: string | null; entity_label: string }
interface Dash { companies: { total: number; by_stage: { stage: string; label: string; count: number }[] }; documents: Record<string, number>; review_queue: Record<string, number>; company_assessments: Record<string, number>; correction_requests_open: number; scores: { public_current: number; company_current: number }; system: Record<string, { configured?: boolean; available?: boolean; detail?: string }> }
interface Portal { company: { id: string; legal_name: string; cx_id: string }; assessments: { id: string; version_no: number; status: string; fiscal_year: number }[]; public_score: { overall: number | null; confidence: number; computed_at: string } | null; company_score: { overall: number | null; confidence: number } | null; notice: string }

function Internal() {
  const r = useApi<Dash>("/admin/dashboard");
  return (
    <Async r={r}>{(d) => {
      const reviews = Object.values(d.review_queue).reduce((a, b) => a + b, 0);
      const assess = (d.company_assessments.submitted ?? 0) + (d.company_assessments.under_review ?? 0);
      return (
        <>
          <div className="cx-grid g4">
            <Kpi lead label="Companies" value={d.companies.total} note={`${d.scores.public_current} with a Public Data Score`} />
            <Kpi label="Documents processing" value={(d.documents.pending ?? 0) + (d.documents.processing ?? 0)} note={`${d.documents.completed ?? 0} completed · ${d.documents.failed ?? 0} failed`} />
            <Kpi label="Review queue" value={reviews} note={<Link href="/console/review">Open extraction review</Link>} />
            <Kpi label="Assessments awaiting review" value={assess} note={<Link href="/console/review/assessments">Open assessment review</Link>} />
          </div>
          <Panel title="Pipeline status" action={<Link href="/console/admin" className="small">Full processing dashboard</Link>}>
            <table className="t"><tbody>{d.companies.by_stage.map((s) => <tr key={s.stage}><td>{s.label}</td><td className="r num">{s.count}</td></tr>)}</tbody></table>
          </Panel>
          {(!d.system.ocr?.available || !d.system.email?.configured) && (
            <Alert kind="warn">{[!d.system.ocr?.available && d.system.ocr?.detail, !d.system.email?.configured && d.system.email?.detail].filter(Boolean).join(". ")}.</Alert>)}
        </>
      );
    }}</Async>
  );
}

function CompanyHome() {
  const r = useApi<Portal>("/portal");
  return (
    <Async r={r}>{(p) => (
      <>
        <div className="cx-grid g3">
          <Kpi lead label="Public Data Score" value={p.public_score?.overall?.toFixed(1) ?? "—"} note={p.public_score ? `Confidence ${p.public_score.confidence.toFixed(0)} · ${date(p.public_score.computed_at)}` : "Not yet assessed"} />
          <Kpi label="Company Assessment Score" value={p.company_score?.overall?.toFixed(1) ?? "—"} note={p.company_score ? `Confidence ${p.company_score.confidence.toFixed(0)}` : "Submit an assessment to receive one"} />
          <Kpi label="Assessment versions" value={p.assessments.length} note={p.assessments[0] ? <>Latest v{p.assessments[0].version_no}: <Badge s={p.assessments[0].status} /></> : "None yet"} />
        </div>
        <Alert kind="info">{p.notice}</Alert>
        <div className="cx-row">
          <Link className="btn" href="/console/assessment">Open assessment portal</Link>
          <Link className="btn sec" href={`/console/companies/${p.company.id}`}>View your intelligence profile</Link>
          <Link className="btn sec" href="/console/corrections">Correction requests</Link>
        </div>
      </>)}</Async>
  );
}

function Institutional() {
  const { me } = useMe();
  const ws = useApi<Workspace>("/workspace");
  const pf = useApi<{ id: string; name: string; companies: number }[]>(can(me, "portfolio.manage") && entitled(me, "portfolio") ? "/portfolios" : null);
  return (
    <Async r={ws}>{(w) => (
      <>
        <Alert kind="info">{w.purpose}</Alert>
        {!me?.subscription && <Alert kind="warn">Your organisation has no active subscription. Directory search remains available; contact Climactix to arrange access.</Alert>}
        <div className="cx-grid g3">
          <Panel title="Find a company"><p className="t2">Search {w.entity_label.toLowerCase()}s by name, Climactix ID or CIN and open the consolidated intelligence profile.</p><div style={{ marginTop: 12 }}><Link className="btn" href="/console/companies">Company search</Link></div></Panel>
          {entitled(me, "comparison") && <Panel title="Compare"><p className="t2">Put up to six companies side by side on scores, indicators and targets.</p><div style={{ marginTop: 12 }}><Link className="btn sec" href="/console/compare">Compare companies</Link></div></Panel>}
          {can(me, "sector.aggregate") && <Panel title="Sector intelligence"><p className="t2">Sector-level indicators and disclosure coverage, aggregated from public disclosures.</p><div style={{ marginTop: 12 }}><Link className="btn sec" href="/console/sectors">Open sector view</Link></div></Panel>}
        </div>
        {w.portfolio_label && pf.data && (
          <Panel title={`${w.portfolio_label}s`} action={<Link href="/console/portfolios" className="small">Manage</Link>} flush>
            {pf.data.length ? <table className="t"><tbody>{pf.data.map((p) => <tr key={p.id}><td><Link href={`/console/portfolios/${p.id}`}>{p.name}</Link></td><td className="r">{p.companies} companies</td></tr>)}</tbody></table>
              : <Empty title={`No ${w.portfolio_label.toLowerCase()} yet`}>Create one to monitor a set of companies together.</Empty>}
          </Panel>)}
      </>)}</Async>
  );
}

export default function Home() {
  const { me } = useMe();
  if (!me) return null;
  const type = me.organisation.type;
  return (
    <>
      <PageHead title={type === "climactix" ? "Operations overview" : type === "company" ? "Company overview" : `${label(type)} intelligence`}
        sub={`Signed in as ${me.user.full_name}, ${me.organisation.name}.`} />
      {type === "climactix" ? <Internal /> : type === "company" ? <CompanyHome /> : <Institutional />}
    </>
  );
}
