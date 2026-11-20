"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton, Alert, Async, Badge, Empty, PageHead, Panel, useApi } from "@/components/cxt/ui";
import { api } from "@/lib/cxt/api";
import { date } from "@/lib/cxt/format";

interface Portal { company: { id: string; legal_name: string }; assessments: { id: string; version_no: number; status: string; fiscal_year: number; created_at: string; submitted_at: string | null }[]; notice: string }

export default function AssessmentPortal() {
  const r = useApi<Portal>("/portal");
  const router = useRouter();
  const now = new Date();
  const currentFy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;   // last completed April–March year
  const [fy, setFy] = useState(currentFy);
  return (
    <Async r={r}>{(p) => {
      const open = p.assessments.find((a) => ["draft", "submitted", "under_review", "returned"].includes(a.status));
      return (
        <>
          <PageHead title="Assessment portal" sub={`Submit sustainability information and evidence for ${p.company.legal_name}. Each submission is a separate, versioned assessment.`} />
          <Alert kind="info">{p.notice}</Alert>
          {open ? (
            <Panel title={`Version ${open.version_no} in progress`}>
              <div className="cx-row"><Badge s={open.status} /><span className="t2">FY{open.fiscal_year - 1}-{String(open.fiscal_year).slice(2)} · started {date(open.created_at)}</span>
                <Link className="btn" href={`/console/assessment/${open.id}`} style={{ marginLeft: "auto" }}>{open.status === "draft" || open.status === "returned" ? "Continue" : "View"}</Link></div>
            </Panel>
          ) : (
            <Panel title="Start a new assessment">
              <div className="cx-row">
                <label className="f">Reporting period
                  <select className="in" value={fy} onChange={(e) => setFy(Number(e.target.value))}>
                    {[0, 1, 2].map((i) => currentFy - i).map((y) => <option key={y} value={y}>FY{y - 1}-{String(y).slice(2)}</option>)}
                  </select>
                </label>
                <ActionButton className="btn" run={async () => { const a = await api.post<{ id: string }>("/assessments", { fiscal_year: fy }); router.push(`/console/assessment/${a.id}`); }}>Start assessment</ActionButton>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>If you have a scored assessment for the same period, its answers and evidence are carried into the new version for you to update.</p>
            </Panel>)}
          <Panel title="All versions" flush>
            {p.assessments.length === 0 ? <Empty title="No assessments yet">Start your first assessment above.</Empty> : (
              <table className="t"><thead><tr><th>Version</th><th>Period</th><th>Status</th><th>Started</th><th>Submitted</th></tr></thead>
                <tbody>{p.assessments.map((a) => (
                  <tr key={a.id}><td><Link href={`/console/assessment/${a.id}`}>v{a.version_no}</Link></td><td>FY{a.fiscal_year - 1}-{String(a.fiscal_year).slice(2)}</td><td><Badge s={a.status} /></td><td>{date(a.created_at)}</td><td>{date(a.submitted_at)}</td></tr>))}</tbody></table>)}
          </Panel>
        </>);
    }}</Async>
  );
}
