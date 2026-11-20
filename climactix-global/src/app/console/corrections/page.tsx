"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionButton, Async, Badge, Empty, FieldError, PageHead, Panel, can, useApi, useMe, useToast } from "@/components/cxt/ui";
import { api, type CompanyBrief, type DataPointOut } from "@/lib/cxt/api";
import { date } from "@/lib/cxt/format";

interface Corr { id: string; company: CompanyBrief; subject: string; data_point_id: string | null; current_value: string | null; proposed_value: string; justification: string; status: string; decision_note: string | null; created_at: string; decided_at: string | null }

export default function Corrections() {
  const { me } = useMe();
  const toast = useToast();
  const decider = can(me, "correction.decide");
  const r = useApi<Corr[]>("/corrections");
  const pts = useApi<{ items: DataPointOut[] }>(!decider && me?.organisation.company_id ? `/companies/${me.organisation.company_id}/data-points` : null, { channel: "public" });
  const [f, setF] = useState({ data_point_id: "", subject: "", proposed_value: "", justification: "" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <PageHead title="Correction requests" sub={decider ? "Factual corrections requested by companies. Accepting one records a reviewer-verified value; the original extraction is kept." : "Ask Climactix to correct a factual error in your public record. You cannot edit the public record or its score yourself."} />
      {!decider && (
        <Panel title="New request">
          <form className="form g2" onSubmit={async (e) => {
            e.preventDefault(); setErr(null);
            try { await api.post("/corrections", { ...f, data_point_id: f.data_point_id || undefined }); toast("Request submitted"); setF({ data_point_id: "", subject: "", proposed_value: "", justification: "" }); r.reload(); }
            catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
          }}>
            <div style={{ gridColumn: "1 / -1" }}><FieldError error={err} /></div>
            <label className="f">Data point <span className="hint">Optional — the value you are disputing</span>
              <select className="in" value={f.data_point_id} onChange={(e) => { const d = pts.data?.items.find((x) => x.id === e.target.value); setF({ ...f, data_point_id: e.target.value, subject: d ? `${d.metric} ${d.fy_label ?? ""}` : f.subject }); }}>
                <option value="">General correction</option>
                {pts.data?.items.filter((d) => d.kind === "numeric").map((d) => <option key={d.id} value={d.id}>{d.metric} · {d.fy_label} · {d.value} {d.unit}</option>)}
              </select></label>
            <label className="f">Subject<input className="in" required minLength={3} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
            <label className="f">Correct value<input className="in" required value={f.proposed_value} onChange={(e) => setF({ ...f, proposed_value: e.target.value })} /></label>
            <label className="f">Justification <span className="hint">Cite the document and page that supports the correction</span><textarea className="in" required minLength={10} value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} /></label>
            <div><button className="btn">Submit request</button></div>
          </form>
        </Panel>)}
      <Panel flush title="Requests">
        <Async r={r}>{(rows) => rows.length === 0 ? <Empty title="No correction requests" /> : (
          <div className="cx-table-wrap"><table className="t"><thead><tr><th>Subject</th>{decider && <th>Company</th>}<th>Current</th><th>Proposed</th><th>Status</th><th>Raised</th>{decider && <th />}</tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}><td>{c.data_point_id ? <Link href={`/console/data-points/${c.data_point_id}`}>{c.subject}</Link> : c.subject}<div className="small t2">{c.justification}</div>{c.decision_note && <div className="small">Decision: {c.decision_note}</div>}</td>
                {decider && <td>{c.company.legal_name}</td>}<td>{c.current_value ?? "—"}</td><td>{c.proposed_value}</td><td><Badge s={c.status} /></td><td className="small">{date(c.created_at)}</td>
                {decider && <td>{c.status === "open" && <div className="cx-stack">
                  <ActionButton className="btn sm" run={async () => {
                    const note = window.prompt("Decision note (shown to the company)"); if (!note) return;
                    const v = c.data_point_id ? window.prompt("Corrected value in the normalised unit (leave blank to accept without changing a value)") : "";
                    await api.post(`/corrections/${c.id}/decide`, { decision: "accept", note, corrected_normalized_value: v ? Number(v.replace(/,/g, "")) : undefined }); r.reload();
                  }}>Accept</ActionButton>
                  <ActionButton className="btn danger sm" run={async () => { const note = window.prompt("Reason for rejecting"); if (!note) return; await api.post(`/corrections/${c.id}/decide`, { decision: "reject", note }); r.reload(); }}>Reject</ActionButton></div>}</td>}
              </tr>))}</tbody></table></div>)}</Async>
      </Panel>
    </>
  );
}
