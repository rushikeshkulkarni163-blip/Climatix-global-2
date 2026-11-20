"use client";

import { useState } from "react";
import { ActionButton, Alert, Async, Badge, FieldError, PageHead, Panel, useApi, useToast } from "@/components/cxt/ui";
import { api } from "@/lib/cxt/api";
import { date, label } from "@/lib/cxt/format";

interface Sub { id: string; organisation: string; organisation_type: string; plan: string; status: string; starts_at: string; ends_at: string | null; days_remaining: number | null; entitlements: string[]; notes: string | null }
interface Org { id: string; name: string; org_type: string }

const PLANS: Record<string, string[]> = { company: ["company_annual"], bank: ["institutional_pilot", "institutional_enterprise"], investor: ["institutional_pilot", "institutional_enterprise"], insurance: ["institutional_pilot", "institutional_enterprise"], government: ["institutional_pilot", "institutional_enterprise"], climactix: ["internal"] };

export default function Subscriptions() {
  const subs = useApi<Sub[]>("/admin/subscriptions");
  const orgs = useApi<Org[]>("/admin/organisations");
  const toast = useToast();
  const [f, setF] = useState({ organisation_id: "", plan: "", ends_at: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const org = orgs.data?.find((o) => o.id === f.organisation_id);
  return (
    <>
      <PageHead title="Subscriptions" sub="Access entitlements and expiry. Institutional pilots run six months; company plans run twelve. No payment is collected here — no payment provider is configured." />
      <Alert kind="info">Subscriptions control what an organisation can see. They have no effect on any company's score.</Alert>
      <Panel title="Grant or renew access">
        <form className="form g2" onSubmit={async (e) => {
          e.preventDefault(); setErr(null);
          try { await api.post("/admin/subscriptions", { organisation_id: f.organisation_id, plan: f.plan, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : undefined, notes: f.notes || undefined }); toast("Subscription active"); subs.reload(); }
          catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
        }}>
          <div style={{ gridColumn: "1 / -1" }}><FieldError error={err} /></div>
          <label className="f">Organisation<select className="in" required value={f.organisation_id} onChange={(e) => { const t = orgs.data?.find((o) => o.id === e.target.value)?.org_type ?? ""; setF({ ...f, organisation_id: e.target.value, plan: PLANS[t]?.[0] ?? "" }); }}>
            <option value="">Choose…</option>{orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name} ({label(o.org_type)})</option>)}</select></label>
          <label className="f">Plan<select className="in" required value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>{(PLANS[org?.org_type ?? ""] ?? []).map((p) => <option key={p} value={p}>{label(p)}</option>)}</select></label>
          <label className="f">End date <span className="hint">Blank for the plan default (pilot six months, annual twelve)</span><input className="in" type="date" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></label>
          <label className="f">Notes<input className="in" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          <div><button className="btn">Activate</button><span className="small muted" style={{ marginLeft: 8 }}>Replaces the organisation's current subscription.</span></div>
        </form>
      </Panel>
      <Panel title="All subscriptions" flush>
        <Async r={subs}>{(rows) => (
          <div className="cx-table-wrap"><table className="t"><thead><tr><th>Organisation</th><th>Plan</th><th>Status</th><th>Period</th><th className="r">Days left</th><th>Features</th><th /></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id}><td>{s.organisation}<div className="small muted">{label(s.organisation_type)}</div></td><td>{label(s.plan)}</td><td><Badge s={s.status} /></td>
                <td className="small">{date(s.starts_at)} – {s.ends_at ? date(s.ends_at) : "open"}</td><td className="r num">{s.days_remaining ?? "—"}</td>
                <td className="small t2" style={{ maxWidth: 320 }}>{s.entitlements.map((e) => label(e)).join(", ")}</td>
                <td className="r">{s.status === "active" && <ActionButton className="btn danger sm" confirm={`Cancel ${s.organisation}'s subscription? Access ends immediately.`} run={async () => { await api.post(`/admin/subscriptions/${s.id}/cancel`); subs.reload(); }}>Cancel</ActionButton>}</td></tr>))}</tbody></table></div>)}</Async>
      </Panel>
    </>
  );
}
