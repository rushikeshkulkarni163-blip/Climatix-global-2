"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionButton, Alert, Async, Badge, Kpi, PageHead, Panel, Synthetic, useApi } from "@/components/cxt/ui";
import { api, type CompanyBrief } from "@/lib/cxt/api";
import { date, label } from "@/lib/cxt/format";

interface Dash { companies: { total: number; by_stage: { stage: string; label: string; count: number; companies: (CompanyBrief & { documents: number })[] }[] }; documents: Record<string, number>; jobs: Record<string, number>; review_queue: Record<string, number>; company_assessments: Record<string, number>; correction_requests_open: number; scores: { public_current: number; company_current: number };
  system: { environment: string; ocr: { available: boolean; detail: string }; llm_extraction: { detail: string }; email: { configured: boolean; detail: string }; storage: { backend: string }; payments: { detail: string }; connectors: { key: string; name: string; status: string; requires: string | null }[] } }
interface Job { id: string; kind: string; status: string; attempts: number; error: string | null; document_id: string | null; created_at: string }

export default function AdminDashboard() {
  const r = useApi<Dash>("/admin/dashboard");
  const jobs = useApi<Job[]>("/admin/jobs", { status: "failed", limit: 20 });
  const [stage, setStage] = useState("no_reports");
  return (
    <>
      <PageHead title="Processing dashboard" sub="Where every company stands between first record and generated score." actions={<button className="btn sec" onClick={() => { r.reload(); jobs.reload(); }}>Refresh</button>} />
      <Async r={r} rows={8}>{(d) => {
        const sel = d.companies.by_stage.find((s) => s.stage === stage)!;
        return (
          <>
            <div className="cx-grid g4">
              {d.companies.by_stage.map((s) => (
                <button key={s.stage} onClick={() => setStage(s.stage)} className="cx-kpi" style={{ textAlign: "left", cursor: "pointer", borderColor: stage === s.stage ? "var(--accent)" : undefined }}>
                  <div className="eyebrow">{s.label}</div><div className="v">{s.count}</div>
                </button>))}
            </div>
            <Panel title={sel.label} flush>
              {sel.companies.length === 0 ? <p className="t2" style={{ padding: 16 }}>No companies at this stage.</p> : (
                <table className="t"><thead><tr><th>Company</th><th>Sector</th><th className="r">Documents</th></tr></thead>
                  <tbody>{sel.companies.map((c) => <tr key={c.id}><td><Link href={`/console/companies/${c.id}?tab=repository`}>{c.legal_name}</Link> <Synthetic on={c.is_synthetic} /><div className="small muted">{c.cx_id}</div></td><td>{c.sector ?? "—"}</td><td className="r num">{c.documents}</td></tr>)}</tbody></table>)}
            </Panel>
            <div className="cx-grid g3">
              <Panel title="Documents"><table className="t"><tbody>{["pending", "processing", "completed", "requires_review", "failed"].map((k) => <tr key={k}><td><Badge s={k} /></td><td className="r num">{d.documents[k] ?? 0}</td></tr>)}</tbody></table></Panel>
              <Panel title="Review queue" action={<Link href="/console/review" className="small">Open</Link>}><table className="t"><tbody>{Object.keys(d.review_queue).length ? Object.entries(d.review_queue).map(([k, n]) => <tr key={k}><td>{label(k)}</td><td className="r num">{n}</td></tr>) : <tr><td className="t2">Empty</td></tr>}</tbody></table></Panel>
              <Panel title="Assessments and scores"><table className="t"><tbody>
                <tr><td>Public Data Scores (current)</td><td className="r num">{d.scores.public_current}</td></tr>
                <tr><td>Company Assessment Scores (current)</td><td className="r num">{d.scores.company_current}</td></tr>
                {Object.entries(d.company_assessments).map(([k, n]) => <tr key={k}><td>Company assessments: {label(k)}</td><td className="r num">{n}</td></tr>)}
                <tr><td>Open correction requests</td><td className="r num">{d.correction_requests_open}</td></tr></tbody></table></Panel>
            </div>
            <Panel title="Failed jobs" flush>
              <Async r={jobs}>{(rows) => rows.length === 0 ? <p className="t2" style={{ padding: 16 }}>No failed jobs.</p> : (
                <table className="t"><tbody>{rows.map((j) => (
                  <tr key={j.id}><td>{label(j.kind)}<div className="small muted">{date(j.created_at, true)} · {j.attempts} attempt(s)</div></td><td className="small t2">{j.error}</td>
                    <td className="r">{j.document_id && <Link className="small" href={`/console/documents/${j.document_id}`}>Document</Link>} <ActionButton className="btn sec sm" run={async () => { await api.post(`/admin/jobs/${j.id}/retry`); jobs.reload(); }}>Retry</ActionButton></td></tr>))}</tbody></table>)}</Async>
            </Panel>
            <Panel title="System configuration" sub={`Environment: ${d.system.environment} · storage: ${d.system.storage.backend}`}>
              <div className="cx-stack">
                <Alert kind={d.system.ocr.available ? "pos" : "warn"}>OCR: {d.system.ocr.detail}</Alert>
                <Alert kind={d.system.email.configured ? "pos" : "warn"}>Email: {d.system.email.detail}</Alert>
                <Alert kind="info">Extraction: {d.system.llm_extraction.detail}</Alert>
                <Alert kind="info">Payments: {d.system.payments.detail}</Alert>
                <table className="t"><thead><tr><th>Connector</th><th>Status</th><th>Requirement</th></tr></thead><tbody>{d.system.connectors.map((c) => <tr key={c.key}><td>{c.name}</td><td><Badge s={c.status} /></td><td className="small t2">{c.requires ?? "—"}</td></tr>)}</tbody></table>
              </div>
            </Panel>
          </>);
      }}</Async>
    </>
  );
}
