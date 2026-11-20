"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api, type DocumentOut } from "@/lib/cxt/api";
import { bytes, date, label } from "@/lib/cxt/format";
import { Async, Badge, Empty, FieldError, useApi, useToast } from "./ui";

interface Repo { years: { fiscal_year: number | null; fy_label: string; documents: DocumentOut[] }[]; total: number; categories: string[] }
interface Ref { document_categories: { code: string; label: string }[]; upload: { max_mb: number; formats: string[] } }

export function UploadForm({ companyId, onDone, privateUpload }: { companyId: string | null; onDone: () => void; privateUpload?: boolean }) {
  const ref = useApi<Ref>("/reference");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();
  return (
    <form className="form g2" onSubmit={async (e) => {
      e.preventDefault(); setErr(null);
      const f = file.current?.files?.[0];
      if (!f) { setErr("Choose a file"); return; }
      const fd = new FormData(e.currentTarget);
      fd.set("file", f);
      setBusy(true);
      try {
        const r = await api.upload<DocumentOut>(companyId ? `/companies/${companyId}/documents` : "/documents", fd);
        toast(r.message ?? "Uploaded");
        (e.target as HTMLFormElement).reset();
        onDone();
      } catch (x) { setErr(x instanceof Error ? x.message : "Upload failed"); } finally { setBusy(false); }
    }}>
      <div style={{ gridColumn: "1 / -1" }}><FieldError error={err} /></div>
      <label className="f" style={{ gridColumn: "1 / -1" }}>Document
        <span className="hint">{ref.data ? `${ref.data.upload.formats.join(", ")} · up to ${ref.data.upload.max_mb} MB. ` : ""}Uploading starts extraction, classification and assessment.</span>
        <input ref={file} className="in" type="file" accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.tif,.tiff" style={{ paddingTop: 6 }} />
      </label>
      <label className="f">Category <span className="hint">Leave blank to classify automatically</span>
        <select className="in" name="category" defaultValue="">
          <option value="">Detect from content</option>
          {ref.data?.document_categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </label>
      <label className="f">Financial year <span className="hint">e.g. 2024-25; blank to detect</span><input className="in" name="fiscal_year" placeholder="2024-25" /></label>
      <div style={{ gridColumn: "1 / -1" }} className="cx-row">
        <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Upload and process"}</button>
        {privateUpload && <span className="small muted">Your uploads are private to your organisation and Climactix reviewers. They do not change the Public Data Score.</span>}
      </div>
    </form>
  );
}

export default function Repository({ companyId, canUpload, privateUpload }: { companyId: string; canUpload: boolean; privateUpload?: boolean }) {
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [history, setHistory] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const r = useApi<Repo>(`/companies/${companyId}/repository`, { year, category, q, include_history: history });
  const all = useApi<Repo>(`/companies/${companyId}/repository`);
  const years = all.data?.years.map((y) => y.fiscal_year).filter((y): y is number => !!y) ?? [];
  return (
    <div className="cx-stack">
      <div className="cx-row">
        <input className="in" style={{ maxWidth: 260 }} placeholder="Search documents" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search documents" />
        <select className="in" style={{ maxWidth: 180 }} value={year} onChange={(e) => setYear(e.target.value)} aria-label="Financial year">
          <option value="">All years</option>{years.map((y) => <option key={y} value={y}>FY{y - 1}-{String(y).slice(2)}</option>)}
        </select>
        <select className="in" style={{ maxWidth: 220 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>{all.data?.categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </select>
        <label className="small t2"><input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} /> Show superseded versions</label>
        {canUpload && <button className="btn sec sm" style={{ marginLeft: "auto" }} onClick={() => setShowUpload(!showUpload)}>{showUpload ? "Close" : "Add document"}</button>}
      </div>
      {showUpload && <div className="cx-panel"><div className="bd"><UploadForm companyId={companyId} privateUpload={privateUpload} onDone={() => { r.reload(); all.reload(); }} /></div></div>}
      <Async r={r}>{(d) => d.total === 0 ? (
        <div className="cx-panel"><Empty title={year || category || q ? "No documents match these filters" : "No reports on file"}>
          {year || category || q ? "Clear the filters to see every document." : "No disclosures have been ingested for this company yet."}</Empty></div>
      ) : (
        <>{d.years.map((y) => (
          <div key={y.fy_label} className="cx-panel">
            <div className="hd"><h3>{y.fy_label}</h3><span className="small muted">{y.documents.length} document(s)</span></div>
            <div className="bd flush cx-table-wrap"><table className="t">
              <thead><tr><th>Document</th><th>Type</th><th>Source</th><th>Extraction</th><th className="r">Size</th><th>Added</th></tr></thead>
              <tbody>{y.documents.map((doc) => (
                <tr key={doc.id}>
                  <td><Link href={`/console/documents/${doc.id}`}>{doc.title}</Link>
                    <div className="cx-row small" style={{ gap: 6, marginTop: 2 }}>
                      {doc.version_no > 1 && <Badge t="accent" text={`Version ${doc.version_no}`} />}
                      {doc.superseded && <Badge t="none" text="Superseded" />}
                      {doc.visibility === "private" && <Badge t="warn" text="Private" />}
                    </div></td>
                  <td>{doc.category_label}</td>
                  <td className="small">{doc.source_url ? <a href={doc.source_url} target="_blank" rel="noreferrer noopener">{new URL(doc.source_url).hostname}</a> : label(doc.source_type)}</td>
                  <td><Badge s={doc.status} />{doc.extraction_confidence !== null && <div className="small muted">confidence {doc.extraction_confidence.toFixed(0)}</div>}</td>
                  <td className="r small">{bytes(doc.size_bytes)}</td><td className="small">{date(doc.created_at)}</td>
                </tr>))}</tbody></table></div>
          </div>))}</>
      )}</Async>
    </div>
  );
}
