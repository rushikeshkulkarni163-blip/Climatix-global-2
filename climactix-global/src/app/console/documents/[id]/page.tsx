"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ActionButton, Alert, Async, Badge, PageHead, Panel, can, useApi, useMe } from "@/components/cxt/ui";
import { api, type CompanyBrief, type DataPointOut, type DocumentOut } from "@/lib/cxt/api";
import { bytes, date, label, num } from "@/lib/cxt/format";

interface Doc extends DocumentOut {
  company: CompanyBrief | null; classification: { detected_type?: string; confidence?: number; basis?: string[]; fiscal_year_basis?: string; company_candidates?: { legal_name: string; confidence: number }[] };
  extraction_summary: Record<string, number>; declared: { category: string | null; fiscal_year: number | null };
  processing_log: { at: string; stage: string; level: string; message: string }[]; data_points: number;
}
interface Pages { page_count: number; pages: { page_no: number; label: string; text: string; tables: { index: number; header: string[]; rows: string[][] }[]; is_ocr: boolean; data_points: DataPointOut[] }[] }

const STAGES = ["ingestion", "extraction", "classification", "validation", "company_mapping", "repository"];

function DocBody() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { me } = useMe();
  const [page, setPage] = useState(Number(sp?.get("page") ?? 1) || 1);
  const r = useApi<Doc>(`/documents/${id}`);
  const pages = useApi<Pages>(r.data?.status === "completed" || r.data?.page_count ? `/documents/${id}/pages` : null, { page, count: 1 });
  return (
    <Async r={r} rows={8}>{(d) => {
      const stageIdx = STAGES.indexOf(d.stage);
      const pg = pages.data?.pages[0];
      return (
        <>
          <PageHead eyebrow={d.company ? <Link href={`/console/companies/${d.company.id}?tab=repository`}>{d.company.legal_name} · {d.company.cx_id}</Link> : "Not yet mapped to a company"}
            title={d.title} sub={`${d.category_label} · ${d.fy_label ?? "period not determined"} · version ${d.version_no}`}
            actions={<>
              <a className="btn sec" href={api.url(`/documents/${id}/download`)}>Download original</a>
              {can(me, "document.ingest_public") && <ActionButton className="btn sec" run={async () => { await api.post(`/documents/${id}/reprocess`); r.reload(); }} done="Queued for re-processing">Re-process</ActionButton>}
            </>} />
          {d.status === "requires_review" && <Alert kind="warn">This document needs human review before it can be used. {can(me, "review.read") ? <Link href="/console/review">Open the review queue</Link> : "Climactix analysts have been notified."}</Alert>}
          {d.status === "failed" && <Alert kind="crit">Processing failed: {d.error}</Alert>}
          {(d.status === "pending" || d.status === "processing") && <Alert kind="info">Processing is under way ({label(d.stage)}). <button className="btn ghost sm" onClick={r.reload}>Refresh</button></Alert>}
          <Panel title="Processing workflow">
            <div className="cx-row" style={{ gap: 6 }}>
              {STAGES.map((s, i) => (
                <span key={s} className="cx-row" style={{ gap: 6 }}>
                  <Badge t={d.status === "completed" || i < stageIdx ? "pos" : i === stageIdx ? (d.status === "failed" ? "crit" : d.status === "requires_review" ? "warn" : "accent") : "none"} text={label(s)} />
                  {i < STAGES.length - 1 && <span className="muted">→</span>}
                </span>))}
            </div>
          </Panel>
          <div className="cx-grid side">
            <Panel title="Page preview" sub="Text as extracted. Highlighted values are the data points read from this page." action={pages.data && (
              <div className="cx-row" style={{ gap: 6 }}>
                <button className="btn sec sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="small">Page {page} of {pages.data.page_count}</span>
                <button className="btn sec sm" disabled={page >= pages.data.page_count} onClick={() => setPage(page + 1)}>Next</button>
              </div>)}>
              <Async r={pages}>{() => pg ? (
                <div className="cx-stack">
                  {pg.is_ocr && <Alert kind="warn">Text on this page was obtained by OCR and may contain recognition errors.</Alert>}
                  <div className="cx-page-text">{pg.text || "(no text on this page)"}</div>
                  {pg.tables.map((t) => (
                    <div key={t.index} className="cx-table-wrap"><div className="eyebrow">Table {t.index}</div><table className="t">
                      <thead><tr>{t.header.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>{t.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>))}
                  {pg.data_points.length > 0 && (
                    <div><div className="eyebrow" style={{ marginBottom: 6 }}>Data points from this page</div>
                      <table className="t"><tbody>{pg.data_points.map((p) => (
                        <tr key={p.id}><td><Link href={`/console/data-points/${p.id}`}>{p.metric}</Link></td><td>{p.fy_label}</td>
                          <td className="r num">{p.value !== null ? `${num(p.value, 2)} ${p.unit ?? ""}` : label(p.value_text)}</td><td><Badge s={p.verification_status} /></td></tr>))}</tbody></table></div>)}
                </div>) : <p className="t2">No extracted text is available for this document.</p>}</Async>
            </Panel>
            <div className="cx-stack">
              <Panel title="Source and integrity">
                <dl className="cx-kv">
                  <dt>Source</dt><dd>{d.source_url ? <a href={d.source_url} target="_blank" rel="noreferrer noopener">{d.source_url}</a> : label(d.source_type)}</dd>
                  {d.retrieved_at && <><dt>Retrieved</dt><dd>{date(d.retrieved_at, true)}</dd></>}
                  <dt>File</dt><dd>{d.filename} · {d.file_format.toUpperCase()} · {bytes(d.size_bytes)}</dd>
                  <dt>SHA-256</dt><dd className="small" style={{ fontFamily: "monospace" }}>{d.sha256}</dd>
                  <dt>Visibility</dt><dd>{d.visibility === "public" ? "Public disclosure" : "Private to the submitting organisation"}</dd>
                  <dt>Added</dt><dd>{date(d.created_at, true)}</dd>
                  <dt>Processed</dt><dd>{date(d.processed_at, true)}</dd>
                  {d.supersedes_id && <><dt>Supersedes</dt><dd><Link href={`/console/documents/${d.supersedes_id}`}>previous version</Link></dd></>}
                </dl>
              </Panel>
              <Panel title="Classification">
                <dl className="cx-kv">
                  <dt>Category</dt><dd>{d.category_label}{d.declared.category ? " (declared)" : " (detected)"}</dd>
                  <dt>Detected type</dt><dd>{d.classification.detected_type ?? "—"} · confidence {d.classification.confidence ?? "—"}</dd>
                  <dt>Reporting period</dt><dd>{d.fy_label ?? "Not determined"} ({d.classification.fiscal_year_basis ?? "—"})</dd>
                  <dt>Pages</dt><dd>{d.page_count ?? "—"}{d.ocr_pages ? ` · ${d.ocr_pages} by OCR` : ""}</dd>
                  <dt>Extracted</dt><dd>{d.extraction_summary.data_points ?? 0} values · {d.extraction_summary.targets ?? 0} targets · {d.extraction_summary.signals ?? 0} statements</dd>
                  <dt>Sent to review</dt><dd>{d.extraction_summary.needs_review ?? 0} low-confidence · {d.extraction_summary.contradictions ?? 0} contradiction(s)</dd>
                </dl>
                {d.classification.basis && d.classification.basis.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>Basis: {d.classification.basis.slice(0, 5).map((b) => b.replace(/\\[bdsw]\??/g, "").replace(/[()?:|\\]/g, "")).join("; ")}</p>}
              </Panel>
              <Panel title="Processing log" flush>
                <div style={{ maxHeight: 320, overflow: "auto" }}><table className="t"><tbody>{d.processing_log.map((l, i) => (
                  <tr key={i}><td className="small muted" style={{ whiteSpace: "nowrap" }}>{date(l.at, true)}</td><td className="small"><b>{label(l.stage)}</b> {l.level !== "info" && <Badge t={l.level === "error" ? "crit" : "warn"} text={l.level} />}<div className="t2">{l.message}</div></td></tr>))}</tbody></table></div>
              </Panel>
            </div>
          </div>
        </>
      );
    }}</Async>
  );
}

export default function Page() { return <Suspense><DocBody /></Suspense>; }
