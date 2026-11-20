"use client";

import Link from "next/link";
import { useState } from "react";
import CompanyPicker from "@/components/cxt/CompanyPicker";
import { ActionButton, Async, Badge, Empty, PageHead, Panel, useApi, useToast } from "@/components/cxt/ui";
import { api, type CompanyBrief, type DataPointOut } from "@/lib/cxt/api";
import { date, label, num } from "@/lib/cxt/format";

interface Item { id: string; kind: string; status: string; summary: string; detail: Record<string, unknown> & { values?: { data_point_id: string; value: number; unit: string; page_no: number | null; document_id: string }[]; candidates?: { company_id: string; legal_name: string; confidence: number }[]; problems?: string[] }; created_at: string; company: CompanyBrief | null; document: { id: string; title: string } | null; data_point: DataPointOut | null }

const KINDS: [string, string][] = [["", "All"], ["low_confidence", "Low confidence"], ["contradiction", "Contradictions"], ["company_mapping", "Company mapping"], ["classification", "Classification"], ["ocr_unavailable", "OCR unavailable"], ["extraction_failure", "Failures"], ["duplicate_company", "Duplicate companies"]];

function Resolve({ it, done }: { it: Item; done: () => void }) {
  const [company, setCompany] = useState<CompanyBrief | null>(null);
  const [category, setCategory] = useState(""); const [fy, setFy] = useState("");
  const toast = useToast();
  const resolve = async (body: Record<string, unknown>) => { await api.post(`/review/items/${it.id}/resolve`, body); toast("Resolved"); done(); };
  if (it.kind === "low_confidence" && it.data_point) {
    const d = it.data_point;
    return <div className="cx-row">
      <ActionButton className="btn sm" run={async () => { await api.post(`/data-points/${d.id}/review`, { decision: "verify", note: "Checked against source" }); done(); }}>Verify</ActionButton>
      <Link className="btn sec sm" href={`/console/data-points/${d.id}`}>Correct or reject…</Link>
    </div>;
  }
  if (it.kind === "contradiction") {
    return <div className="cx-stack">{(it.detail.values ?? []).map((v) => (
      <div key={v.data_point_id} className="cx-row"><span className="num">{num(v.value, 2)} {v.unit}</span>
        <Link className="small" href={`/console/documents/${v.document_id}?page=${v.page_no ?? 1}`}>source p.{v.page_no ?? "?"}</Link>
        <ActionButton className="btn sm" run={async () => { await api.post(`/data-points/${v.data_point_id}/review`, { decision: "verify", note: "Selected as the correct value among conflicting sources" }); done(); }}>Use this value</ActionButton></div>))}</div>;
  }
  if (it.kind === "company_mapping") {
    return <div className="cx-stack">
      {(it.detail.candidates ?? []).length > 0 && <div className="small t2">Candidates: {(it.detail.candidates ?? []).map((c) => `${c.legal_name} (${c.confidence})`).join(", ")}</div>}
      <div className="cx-row"><CompanyPicker onPick={setCompany} placeholder="Assign to company" />{company && <span className="badge accent">{company.legal_name}</span>}
        <ActionButton className="btn sm" disabled={!company} run={() => resolve({ resolution: `Assigned to ${company!.legal_name}`, company_id: company!.id })}>Assign and re-process</ActionButton></div>
    </div>;
  }
  if (it.kind === "classification") {
    return <div className="cx-row">
      <select className="in" style={{ maxWidth: 220 }} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Keep category</option>
        {["ANNUAL_REPORT", "BRSR", "SUSTAINABILITY_REPORT", "ESG_REPORT", "CLIMATE_REPORT", "NET_ZERO_REPORT", "INTEGRATED_REPORT", "ENVIRONMENTAL_DATA", "FINANCIAL_DISCLOSURE", "ASSURANCE_STATEMENT", "POLICY", "OTHER"].map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
      <input className="in" style={{ maxWidth: 140 }} placeholder="FY end year, e.g. 2025" value={fy} onChange={(e) => setFy(e.target.value)} />
      <ActionButton className="btn sm" run={() => resolve({ resolution: "Classification confirmed by reviewer", category: category || undefined, fiscal_year: fy ? Number(fy) : undefined })}>Confirm</ActionButton>
    </div>;
  }
  return <ActionButton className="btn sec sm" run={() => resolve({ resolution: "Reviewed", ...(it.kind === "ocr_unavailable" || it.kind === "extraction_failure" ? {} : {}) })}>{it.kind === "ocr_unavailable" || it.kind === "extraction_failure" ? "Re-process" : "Mark reviewed"}</ActionButton>;
}

export default function ReviewQueue() {
  const [kind, setKind] = useState("");
  const r = useApi<Item[]>("/review/items", { kind });
  return (
    <>
      <PageHead title="Extraction review" sub="Low-confidence values, conflicting sources, unmapped documents and processing problems. Values awaiting review are excluded from scores until resolved where they conflict." />
      <div className="seg" role="group" aria-label="Item type" style={{ flexWrap: "wrap" }}>{KINDS.map(([k, l]) => <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{l}</button>)}</div>
      <Async r={r}>{(items) => items.length === 0 ? <div className="cx-panel"><Empty title="The queue is clear">No open items of this type.</Empty></div> : (
        <div className="cx-stack">{items.map((it) => (
          <div key={it.id} className="cx-panel"><div className="bd cx-stack">
            <div className="cx-row" style={{ justifyContent: "space-between" }}>
              <div><Badge t={it.kind === "contradiction" || it.kind === "extraction_failure" ? "crit" : "warn"} text={label(it.kind)} /> <b style={{ marginLeft: 6 }}>{it.summary}</b></div>
              <span className="small muted">{date(it.created_at, true)}</span>
            </div>
            <div className="small t2">{it.company && <Link href={`/console/companies/${it.company.id}`}>{it.company.legal_name}</Link>}{it.document && <> · <Link href={`/console/documents/${it.document.id}`}>{it.document.title}</Link></>}</div>
            {it.data_point?.provenance.quote && <div className="cx-quote">{it.data_point.provenance.quote}</div>}
            {it.detail.problems && <ul className="small" style={{ margin: 0 }}>{it.detail.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <Resolve it={it} done={r.reload} />
            <div><ActionButton className="btn ghost sm" run={async () => { const why = window.prompt("Reason for dismissing"); if (!why) return; await api.post(`/review/items/${it.id}/resolve`, { resolution: why, dismiss: true }); r.reload(); }}>Dismiss</ActionButton></div>
          </div></div>))}</div>)}</Async>
    </>
  );
}
