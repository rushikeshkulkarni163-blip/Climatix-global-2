"use client";

import Link from "next/link";
import { useState } from "react";
import { Async, Badge, Empty, PageHead, Panel, useApi } from "@/components/cxt/ui";
import type { CompanyBrief } from "@/lib/cxt/api";
import { date } from "@/lib/cxt/format";

export default function AssessmentQueue() {
  const [status, setStatus] = useState("");
  const r = useApi<{ id: string; company: CompanyBrief; version_no: number; status: string; fiscal_year: number; submitted_at: string | null }[]>("/review/assessments", { status });
  return (
    <>
      <PageHead title="Assessment review" sub="Company submissions awaiting evidence review. Accept or reject each answer's evidence, then validate to generate the Company Assessment Score." />
      <div className="seg" role="group" aria-label="Status">
        {[["", "Open"], ["submitted", "Submitted"], ["under_review", "Under review"], ["returned", "Returned"], ["scored", "Scored"]].map(([k, l]) => <button key={k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      <Panel flush>
        <Async r={r}>{(rows) => rows.length === 0 ? <Empty title="Nothing to review">No company assessments are in this state.</Empty> : (
          <table className="t"><thead><tr><th>Company</th><th>Version</th><th>Period</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id}><td><Link href={`/console/review/assessments/${a.id}`}>{a.company.legal_name}</Link><div className="small muted">{a.company.cx_id}</div></td>
                <td>v{a.version_no}</td><td>FY{a.fiscal_year - 1}-{String(a.fiscal_year).slice(2)}</td><td><Badge s={a.status} /></td><td>{date(a.submitted_at, true)}</td></tr>))}</tbody></table>)}</Async>
      </Panel>
    </>
  );
}
