"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Alert, Async, Badge, FieldError, PageHead, Panel, can, useApi, useMe, useToast } from "@/components/cxt/ui";
import { api, type CompanyBrief, type DataPointOut } from "@/lib/cxt/api";
import { date, label, num } from "@/lib/cxt/format";

export default function DataPointPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useMe();
  const toast = useToast();
  const r = useApi<DataPointOut & { company: CompanyBrief }>(`/data-points/${id}`);
  const [mode, setMode] = useState<"" | "correct" | "reject">("");
  const [note, setNote] = useState(""); const [val, setVal] = useState(""); const [err, setErr] = useState<string | null>(null);
  return (
    <Async r={r}>{(d) => {
      const pv = d.provenance;
      const reviewable = can(me, "review.decide") && d.channel === "public" && !["rejected"].includes(d.verification_status);
      const decide = async (decision: string) => {
        setErr(null);
        try {
          const out = await api.post<DataPointOut>(`/data-points/${id}/review`, { decision, note: note || undefined, corrected_value: decision === "correct" ? Number(val) : undefined });
          toast(decision === "verify" ? "Value verified" : decision === "reject" ? "Value rejected" : "Correction recorded");
          if (out.id !== id) window.location.href = `/console/data-points/${out.id}`; else r.reload();
          setMode("");
        } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
      };
      return (
        <>
          <PageHead eyebrow={<Link href={`/console/companies/${d.company.id}?tab=data`}>{d.company.legal_name}</Link>} title={d.metric}
            sub={`${d.fy_label ?? "Period not stated"} · ${d.channel === "company" ? "company submission" : "public disclosure"}`} />
          <div className="cx-grid g3">
            <div className="cx-kpi lead"><div className="eyebrow">As reported</div><div className="v">{d.value !== null ? num(d.value, d.value < 100 ? 2 : 0) : label(d.value_text)}{d.unit && <small>{d.unit}</small>}</div></div>
            <div className="cx-kpi"><div className="eyebrow">Normalised</div><div className="v">{d.normalized_value !== null ? num(d.normalized_value, d.normalized_value < 100 ? 2 : 0) : "—"}{d.normalized_unit && <small>{d.normalized_unit}</small>}</div><div className="n">Converted within the same unit family only</div></div>
            <div className="cx-kpi"><div className="eyebrow">Extraction confidence</div><div className="v">{d.confidence.toFixed(0)}<small>/ 100</small></div><div className="n"><Badge s={d.verification_status} /></div></div>
          </div>
          <div className="cx-grid g2">
            <Panel title="Provenance">
              <dl className="cx-kv">
                <dt>Source document</dt><dd>{pv.document_id ? <Link href={`/console/documents/${pv.document_id}?page=${pv.page_no ?? 1}`}>{pv.document_title}</Link> : "Assessment questionnaire"}</dd>
                <dt>Location</dt><dd>{pv.source_location ?? "—"}</dd>
                <dt>Reporting period</dt><dd>{pv.reporting_period ?? "Not stated"}</dd>
                <dt>Boundary</dt><dd>{d.boundary ?? "Not stated"}</dd>
                <dt>Method</dt><dd>{label(pv.extraction_method)}</dd>
                <dt>Extracted</dt><dd>{date(pv.extracted_at, true)}</dd>
                {pv.source_url && <><dt>Original URL</dt><dd><a href={pv.source_url} target="_blank" rel="noreferrer noopener">{pv.source_url}</a></dd></>}
                {d.reviewed_at && <><dt>Reviewed</dt><dd>{date(d.reviewed_at, true)}{d.review_note ? ` — ${d.review_note}` : ""}</dd></>}
              </dl>
              {pv.quote && <div style={{ marginTop: 12 }}><div className="eyebrow" style={{ marginBottom: 4 }}>Source passage</div><div className="cx-quote">{pv.quote}</div></div>}
            </Panel>
            <Panel title="Why this confidence">
              <table className="t"><tbody>{d.confidence_factors.map((f, i) => (
                <tr key={i}><td>{f.detail}</td><td className="r num">{f.effect > 0 && i > 0 ? `+${f.effect}` : f.effect}</td></tr>))}</tbody></table>
              <p className="small muted" style={{ marginTop: 8 }}>Confidence measures how sure the system is that the document states this value. It says nothing about whether the value is good performance.</p>
            </Panel>
          </div>
          {reviewable && (
            <Panel title="Review">
              <div className="cx-stack">
                <FieldError error={err} />
                <label className="f">Note <span className="hint">Required to reject or correct</span><textarea className="in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
                {mode === "correct" && <label className="f">Corrected value, in {d.unit} as written in the source<input className="in" type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} /></label>}
                <div className="cx-row">
                  {d.verification_status !== "verified" && <button className="btn" onClick={() => decide("verify")}>Verify against source</button>}
                  {mode === "correct" ? <button className="btn sec" onClick={() => decide("correct")}>Save correction</button> : <button className="btn sec" onClick={() => setMode("correct")}>Correct value</button>}
                  <button className="btn danger" onClick={() => decide("reject")}>Reject</button>
                </div>
                <Alert kind="info">A correction never overwrites the extracted value: it records a reviewer-verified value that supersedes it, and the company is re-assessed.</Alert>
              </div>
            </Panel>)}
        </>
      );
    }}</Async>
  );
}
