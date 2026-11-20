"use client";

import { Fragment, useState } from "react";
import { Alert, Async, PageHead, Panel, useApi } from "@/components/cxt/ui";
import { date } from "@/lib/cxt/format";

interface Row { id: number; at: string; actor: string; role: string; action: string; entity_type: string | null; entity_id: string | null; company_id: string | null; detail: Record<string, unknown>; ip: string | null }

export default function Audit() {
  const [action, setAction] = useState(""); const [actor, setActor] = useState(""); const [offset, setOffset] = useState(0);
  const r = useApi<{ total: number; items: Row[] }>("/admin/audit", { action, actor, offset, limit: 100 });
  const v = useApi<{ ok: boolean; checked: number; broken_at: number | null }>("/admin/audit/verify");
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <PageHead title="Audit trail" sub="Every state-changing action, append-only. The database rejects edits and deletions, and entries are hash-chained so tampering is detectable." />
      <Async r={v}>{(x) => <Alert kind={x.ok ? "pos" : "crit"}>{x.ok ? `Hash chain verified across ${x.checked.toLocaleString()} entries.` : `Hash chain broken at entry ${x.broken_at}. Investigate immediately.`}</Alert>}</Async>
      <Panel>
        <div className="cx-row">
          <input className="in" style={{ maxWidth: 260 }} placeholder="Action prefix, e.g. score. or user." value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }} />
          <input className="in" style={{ maxWidth: 260 }} placeholder="Actor email" value={actor} onChange={(e) => { setActor(e.target.value); setOffset(0); }} />
        </div>
      </Panel>
      <Panel flush title={r.data ? `${r.data.total.toLocaleString()} entries` : "Entries"} action={r.data && (
        <div className="cx-row"><button className="btn sec sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Newer</button><button className="btn sec sm" disabled={offset + 100 >= r.data.total} onClick={() => setOffset(offset + 100)}>Older</button></div>)}>
        <Async r={r}>{(d) => (
          <div className="cx-table-wrap"><table className="t"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Address</th></tr></thead>
            <tbody>{d.items.map((x) => (
              <Fragment key={x.id}>
                <tr className="click" onClick={() => setOpen(open === x.id ? null : x.id)}>
                  <td className="small" style={{ whiteSpace: "nowrap" }}>{date(x.at, true)}</td><td>{x.actor}<div className="small muted">{x.role}</div></td>
                  <td><code>{x.action}</code></td><td className="small">{x.entity_type ?? "—"}<div className="muted">{x.entity_id?.slice(0, 8)}</div></td><td className="small">{x.ip ?? "—"}</td></tr>
                {open === x.id && <tr><td colSpan={5}><pre className="cx-page-text" style={{ maxHeight: 260 }}>{JSON.stringify(x.detail, null, 2)}</pre></td></tr>}
              </Fragment>))}</tbody></table></div>)}</Async>
      </Panel>
    </>
  );
}
