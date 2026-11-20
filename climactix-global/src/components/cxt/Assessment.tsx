"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, type DocumentOut, type ScoreOut } from "@/lib/cxt/api";
import { date, label } from "@/lib/cxt/format";
import { PillarBreakdown, ScoreHeadline } from "./Score";
import { UploadForm } from "./Repository";
import { ActionButton, Alert, Badge, ErrorState, FieldError, Loading, PageHead, Panel, useApi, useToast } from "./ui";

interface Question { id: string; section: string; text: string; type: string; unit?: string; prior?: boolean; required?: boolean; help?: string; options?: string[] }
interface Q { version: string; sections: { id: string; name: string }[]; questions: Question[] }
interface Answer { value: { value: unknown; prior_value?: number } | null; source_declaration: string | null; evidence_document: { id: string; title: string; status: string } | null; evidence_status: string; reviewer_comment: string | null }
export interface AssessmentOut {
  id: string; company: { id: string; legal_name: string; cx_id: string }; version_no: number; status: string; fiscal_year: number; editable: boolean;
  progress: { answered: number; total: number; percent: number; sections: { id: string; name: string; answered: number; total: number; percent: number }[]; missing_required: { question_id: string; text: string }[]; answers_without_source: { question_id: string; text: string }[]; evidence: Record<string, number>; can_submit: boolean };
  answers: Record<string, Answer>; history: { at: string; event: string; body: string | null; by: string | null; section: string | null }[]; score: ScoreOut | null;
}

type Draft = { value: string; prior: string; multi: string[]; source: string; evidence: string };

function toDraft(q: Question, a?: Answer): Draft {
  const v = a?.value?.value;
  return { value: Array.isArray(v) ? "" : v === undefined || v === null ? "" : String(v), prior: a?.value?.prior_value !== undefined ? String(a.value.prior_value) : "",
    multi: Array.isArray(v) ? (v as string[]) : [], source: a?.source_declaration ?? "", evidence: a?.evidence_document?.id ?? "" };
}

function payload(q: Question, d: Draft) {
  const blank = q.type === "multichoice" ? d.multi.length === 0 : d.value === "";
  const value = blank ? null : q.type === "multichoice" ? { value: d.multi } : { value: ["number", "percent", "year"].includes(q.type) ? Number(d.value) : d.value, ...(q.prior && d.prior !== "" ? { prior_value: Number(d.prior) } : {}) };
  return { value, source_declaration: d.source || null, evidence_document_id: d.evidence || null };
}

function Input({ q, d, set, disabled }: { q: Question; d: Draft; set: (d: Draft) => void; disabled: boolean }) {
  if (q.type === "yesno") return <select className="in" disabled={disabled} value={d.value} onChange={(e) => set({ ...d, value: e.target.value })}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select>;
  if (q.type === "choice") return <select className="in" disabled={disabled} value={d.value} onChange={(e) => set({ ...d, value: e.target.value })}><option value="">—</option>{q.options!.map((o) => <option key={o}>{o}</option>)}</select>;
  if (q.type === "multichoice") return <div className="cx-row">{q.options!.map((o) => <label key={o} className="small"><input type="checkbox" disabled={disabled} checked={d.multi.includes(o)} onChange={(e) => set({ ...d, multi: e.target.checked ? [...d.multi, o] : d.multi.filter((x) => x !== o) })} /> {o}</label>)}</div>;
  if (q.type === "text") return <textarea className="in" disabled={disabled} value={d.value} onChange={(e) => set({ ...d, value: e.target.value })} />;
  return (
    <div className="cx-row" style={{ flexWrap: "nowrap" }}>
      <input className="in" type="number" step="any" min={0} disabled={disabled} value={d.value} onChange={(e) => set({ ...d, value: e.target.value })} aria-label={`${q.text}, current year`} placeholder={q.prior ? "Current year" : ""} />
      {q.prior && <input className="in" type="number" step="any" min={0} disabled={disabled} value={d.prior} onChange={(e) => set({ ...d, prior: e.target.value })} aria-label={`${q.text}, previous year`} placeholder="Previous year" />}
      {q.unit && <span className="small muted" style={{ whiteSpace: "nowrap" }}>{q.unit}</span>}
    </div>
  );
}

export default function AssessmentView({ id, mode }: { id: string; mode: "company" | "reviewer" }) {
  const r = useApi<AssessmentOut>(`/assessments/${id}`);
  const qr = useApi<Q>("/questionnaire");
  const evidenceDocs = useApi<{ evidence_documents: DocumentOut[] }>(mode === "company" ? "/portal" : null);
  const toast = useToast();
  const [section, setSection] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (r.data && qr.data) {
      const d: Record<string, Draft> = {};
      qr.data.questions.forEach((q) => { d[q.id] = toDraft(q, r.data!.answers[q.id]); });
      setDrafts(d); setDirty(new Set());
      if (!section) setSection(qr.data.sections[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.data, qr.data]);

  const a = r.data, qs = qr.data;
  const questions = useMemo(() => qs?.questions.filter((q) => q.section === section) ?? [], [qs, section]);
  if (r.error) return <ErrorState error={r.error} retry={r.reload} />;
  if (qr.error) return <ErrorState error={qr.error} retry={qr.reload} />;
  if (!a || !qs) return <Loading rows={8} />;
  const editable = mode === "company" && a.editable;
  const reviewable = mode === "reviewer" && ["submitted", "under_review"].includes(a.status);
  const docs = (evidenceDocs.data?.evidence_documents ?? []).filter((d) => d.visibility === "private");

  const save = async () => {
    setErr(null);
    const answers: Record<string, unknown> = {};
    dirty.forEach((qid) => { answers[qid] = payload(qs.questions.find((q) => q.id === qid)!, drafts[qid]); });
    try { const out = await api.put<AssessmentOut>(`/assessments/${id}/answers`, { answers }); r.setData(out); toast("Answers saved"); }
    catch (x) { setErr(x instanceof Error ? x.message : "Save failed"); }
  };

  return (
    <>
      <PageHead eyebrow={<Link href={`/console/companies/${a.company.id}`}>{a.company.legal_name} · {a.company.cx_id}</Link>}
        title={`Company assessment v${a.version_no}`} sub={`FY${a.fiscal_year - 1}-${String(a.fiscal_year).slice(2)} · questionnaire ${qs.version}`}
        actions={<Badge s={a.status} />} />
      {mode === "company" && a.status === "returned" && <Alert kind="warn">Returned by the reviewer for changes. See the comments in the history below, update your answers and resubmit.</Alert>}
      {mode === "company" && ["submitted", "under_review"].includes(a.status) && <Alert kind="info">Submitted. Climactix reviewers are checking your evidence; answers are locked until the review finishes.</Alert>}
      <Alert kind="info">Every answer needs either an uploaded evidence document or a written statement of its source. Only answers whose evidence a reviewer accepts count towards the Company Assessment Score; other answers are recorded as company declarations. Your submission never changes the Public Data Score.</Alert>

      <div className="cx-grid g4">
        <div className="cx-kpi lead"><div className="eyebrow">Progress</div><div className="v">{a.progress.percent}%</div><div className="n">{a.progress.answered} of {a.progress.total} answered</div></div>
        <div className="cx-kpi"><div className="eyebrow">Missing required</div><div className="v">{a.progress.missing_required.length}</div><div className="n">{a.progress.missing_required.slice(0, 2).map((m) => m.text).join("; ") || "None"}</div></div>
        <div className="cx-kpi"><div className="eyebrow">Without a source</div><div className="v">{a.progress.answers_without_source.length}</div><div className="n">Add evidence or declare the source</div></div>
        <div className="cx-kpi"><div className="eyebrow">Evidence</div><div className="v">{a.progress.evidence.submitted + a.progress.evidence.accepted}</div><div className="n">{a.progress.evidence.accepted} accepted · {a.progress.evidence.rejected} rejected · {a.progress.evidence.declared_source} declared</div></div>
      </div>

      <div className="cx-grid" style={{ gridTemplateColumns: "220px minmax(0,1fr)" }}>
        <nav className="cx-panel" aria-label="Sections" style={{ alignSelf: "start" }}>
          {a.progress.sections.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{ all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-soft)", background: section === s.id ? "var(--accent-tint)" : undefined }}>
              <div style={{ fontWeight: 600, color: section === s.id ? "var(--accent)" : undefined }}>{s.name}</div>
              <div className="small muted">{s.answered} of {s.total} answered</div>
            </button>))}
        </nav>
        <div className="cx-stack">
          <FieldError error={err} />
          {questions.map((q) => {
            const d = drafts[q.id]; const ans = a.answers[q.id];
            if (!d) return null;
            const set = (nd: Draft) => { setDrafts({ ...drafts, [q.id]: nd }); setDirty(new Set(dirty).add(q.id)); };
            return (
              <div key={q.id} className="cx-panel"><div className="bd cx-stack">
                <div className="cx-row" style={{ justifyContent: "space-between" }}>
                  <div><b>{q.text}</b>{q.required && <span className="small" style={{ color: "var(--critical)" }}> required</span>}{q.help && <div className="small muted">{q.help}</div>}</div>
                  {ans?.value && <Badge s={ans.evidence_status} />}
                </div>
                <Input q={q} d={d} set={set} disabled={!editable} />
                {(editable || ans?.value) && (
                  <div className="form g2">
                    <label className="f">Evidence document
                      {editable ? (
                        <select className="in" value={d.evidence} onChange={(e) => set({ ...d, evidence: e.target.value })}>
                          <option value="">None</option>{docs.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
                        </select>) : <span className="t2" style={{ fontWeight: 400 }}>{ans?.evidence_document ? <Link href={`/console/documents/${ans.evidence_document.id}`}>{ans.evidence_document.title}</Link> : "None"}</span>}
                    </label>
                    <label className="f">Source declaration
                      {editable ? <input className="in" value={d.source} placeholder="e.g. Audited financial statements FY2024-25, note 12" onChange={(e) => set({ ...d, source: e.target.value })} />
                        : <span className="t2" style={{ fontWeight: 400 }}>{ans?.source_declaration ?? "—"}</span>}
                    </label>
                  </div>)}
                {ans?.reviewer_comment && <Alert kind={ans.evidence_status === "rejected" ? "crit" : "info"}>Reviewer: {ans.reviewer_comment}</Alert>}
                {reviewable && ans?.value && (
                  <div className="cx-row">
                    {ans.evidence_document ? <ActionButton className="btn sm" run={async () => { r.setData(await api.post<AssessmentOut>(`/assessments/${id}/answers/${q.id}/review`, { decision: "accept" })); }}>Accept evidence</ActionButton>
                      : <span className="small muted">No document attached: stays a company declaration and is not scored.</span>}
                    {ans.evidence_document && <ActionButton className="btn danger sm" run={async () => {
                      const reason = window.prompt("Reason for rejecting this evidence (shown to the company)");
                      if (!reason) return;
                      r.setData(await api.post<AssessmentOut>(`/assessments/${id}/answers/${q.id}/review`, { decision: "reject", comment: reason }));
                    }}>Reject</ActionButton>}
                  </div>)}
              </div></div>);
          })}
          {editable && (
            <div className="cx-row">
              <button className="btn sec" disabled={!dirty.size} onClick={save}>Save {dirty.size ? `(${dirty.size} changed)` : ""}</button>
              <ActionButton className="btn" disabled={dirty.size > 0} title={dirty.size ? "Save your changes first" : undefined}
                confirm="Submit this assessment for review? Answers are locked until the review is complete."
                run={async () => { r.setData(await api.post<AssessmentOut>(`/assessments/${id}/submit`)); }} done="Submitted for review">Submit for review</ActionButton>
              <button className="btn ghost" onClick={() => setShowUpload(!showUpload)}>{showUpload ? "Close upload" : "Upload evidence document"}</button>
            </div>)}
          {showUpload && editable && <Panel title="Upload evidence"><UploadForm companyId={a.company.id} privateUpload onDone={() => { evidenceDocs.reload(); setShowUpload(false); }} /></Panel>}
        </div>
      </div>

      {reviewable && (
        <Panel title="Complete the review">
          <div className="cx-stack">
            <label className="f">Comment to the company<textarea className="in" value={comment} onChange={(e) => setComment(e.target.value)} /></label>
            <div className="cx-row">
              <ActionButton className="btn" run={async () => { r.setData(await api.post<AssessmentOut>(`/assessments/${id}/validate`, { comment: comment || undefined })); }} done="Validated and scored">Validate and generate score</ActionButton>
              <ActionButton className="btn sec" run={async () => { if (comment.trim().length < 3) throw new Error("Write a comment explaining what needs to change"); r.setData(await api.post<AssessmentOut>(`/assessments/${id}/return`, { comment })); }} done="Returned to the company">Return for changes</ActionButton>
              <ActionButton className="btn ghost" run={async () => { if (comment.trim().length < 3) throw new Error("Write a comment first"); r.setData(await api.post<AssessmentOut>(`/assessments/${id}/comments`, { comment })); setComment(""); }}>Add comment only</ActionButton>
            </div>
          </div>
        </Panel>)}

      {a.score?.result && (
        <Panel title="Company Assessment Score" sub="Public evidence plus the company evidence accepted on review">
          <div className="cx-stack"><ScoreHeadline title="Company Assessment Score" s={a.score} /><PillarBreakdown s={a.score} /></div>
        </Panel>)}

      <Panel title="Submission history" flush>
        <table className="t"><tbody>{a.history.map((h, i) => (
          <tr key={i}><td className="small muted" style={{ whiteSpace: "nowrap" }}>{date(h.at, true)}</td><td><b>{label(h.event)}</b>{h.body && <div className="t2">{h.body}</div>}</td><td className="small muted">{h.by}</td></tr>))}</tbody></table>
      </Panel>
    </>
  );
}
