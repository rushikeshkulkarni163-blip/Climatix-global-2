"use client";

import Link from "next/link";
import { useState } from "react";
import { Async, Empty, FieldError, PageHead, Panel, useApi } from "@/components/cxt/ui";
import { api } from "@/lib/cxt/api";
import { date } from "@/lib/cxt/format";

export default function Portfolios() {
  const ws = useApi<{ portfolio_label: string | null }>("/workspace");
  const r = useApi<{ id: string; name: string; description: string | null; companies: number; created_at: string }[]>("/portfolios");
  const [name, setName] = useState(""); const [desc, setDesc] = useState(""); const [err, setErr] = useState<string | null>(null);
  const lbl = ws.data?.portfolio_label ?? "Portfolio";
  return (
    <>
      <PageHead title={`${lbl}s`} sub="Private to your organisation. No other institution can see which companies you hold or monitor." />
      <div className="cx-grid side">
        <Panel title={`Your ${lbl.toLowerCase()}s`} flush>
          <Async r={r}>{(rows) => rows.length === 0 ? <Empty title={`No ${lbl.toLowerCase()}s yet`}>Create one to monitor a set of companies.</Empty> : (
            <table className="t"><thead><tr><th>Name</th><th className="r">Companies</th><th>Created</th></tr></thead>
              <tbody>{rows.map((p) => <tr key={p.id}><td><Link href={`/console/portfolios/${p.id}`}>{p.name}</Link>{p.description && <div className="small muted">{p.description}</div>}</td><td className="r num">{p.companies}</td><td className="small">{date(p.created_at)}</td></tr>)}</tbody></table>)}</Async>
        </Panel>
        <Panel title={`New ${lbl.toLowerCase()}`}>
          <form className="form" onSubmit={async (e) => {
            e.preventDefault(); setErr(null);
            try { await api.post("/portfolios", { name, description: desc || undefined }); setName(""); setDesc(""); r.reload(); }
            catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
          }}>
            <FieldError error={err} />
            <label className="f">Name<input className="in" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="f">Description<textarea className="in" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
            <div><button className="btn">Create</button></div>
          </form>
        </Panel>
      </div>
    </>
  );
}
