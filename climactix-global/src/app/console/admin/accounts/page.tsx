"use client";

import { useState } from "react";
import CompanyPicker from "@/components/cxt/CompanyPicker";
import { ActionButton, Alert, Async, Badge, FieldError, PageHead, Panel, useApi, useToast } from "@/components/cxt/ui";
import { api, type CompanyBrief } from "@/lib/cxt/api";
import { ROLE_LABEL, date, label } from "@/lib/cxt/format";

interface Org { id: string; name: string; org_type: string; country: string | null; status: string; company_id: string | null; users: number; subscription: { plan: string; ends_at: string | null } | null }
interface User { id: string; email: string; full_name: string; role: string; status: string; organisation_id: string; organisation: string; organisation_type: string; last_login_at: string | null; locked: boolean }

const ROLES_FOR: Record<string, string[]> = { climactix: ["super_admin", "data_analyst", "assessment_reviewer"], company: ["company_admin"], bank: ["bank_user"], insurance: ["insurance_user"], investor: ["investor_user"], government: ["government_user"] };

export default function Accounts() {
  const orgs = useApi<Org[]>("/admin/organisations");
  const users = useApi<User[]>("/admin/users");
  const toast = useToast();
  const [o, setO] = useState({ name: "", org_type: "bank", country: "India" });
  const [co, setCo] = useState<CompanyBrief | null>(null);
  const [inv, setInv] = useState({ email: "", full_name: "", organisation_id: "", role: "" });
  const [link, setLink] = useState<{ link: string; delivered: boolean; email: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const org = orgs.data?.find((x) => x.id === inv.organisation_id);
  return (
    <>
      <PageHead title="Organisations and users" sub="Each organisation is an isolated tenant: its portfolios, submissions and private documents are invisible to every other organisation." />
      <FieldError error={err} />
      {link && <Alert kind={link.delivered ? "pos" : "warn"}>{link.delivered ? `Invitation emailed to ${link.email}.` : `Email is not configured, so nothing was sent. Give ${link.email} this one-time link through a secure channel; it is shown only once:`}<div style={{ fontFamily: "monospace", wordBreak: "break-all", marginTop: 6 }}>{link.link}</div></Alert>}
      <div className="cx-grid g2">
        <Panel title="New organisation">
          <form className="form" onSubmit={async (e) => {
            e.preventDefault(); setErr(null);
            try { await api.post("/admin/organisations", { ...o, company_id: o.org_type === "company" ? co?.id : undefined }); setO({ ...o, name: "" }); setCo(null); orgs.reload(); toast("Organisation created"); }
            catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
          }}>
            <label className="f">Type<select className="in" value={o.org_type} onChange={(e) => setO({ ...o, org_type: e.target.value })}>{Object.keys(ROLES_FOR).filter((t) => t !== "climactix").map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
            {o.org_type === "company" && <label className="f">Company record<CompanyPicker onPick={(c) => { setCo(c); setO({ ...o, name: o.name || c.legal_name }); }} />{co && <span className="t2">{co.legal_name} ({co.cx_id})</span>}</label>}
            <label className="f">Name<input className="in" required value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} /></label>
            <label className="f">Country<input className="in" value={o.country} onChange={(e) => setO({ ...o, country: e.target.value })} /></label>
            <div><button className="btn">Create organisation</button></div>
          </form>
        </Panel>
        <Panel title="Invite a user">
          <form className="form" onSubmit={async (e) => {
            e.preventDefault(); setErr(null);
            try { const r = await api.post<{ invite_link: string; email_delivered: boolean; email: string }>("/admin/users/invite", inv); setLink({ link: r.invite_link, delivered: r.email_delivered, email: r.email }); setInv({ email: "", full_name: "", organisation_id: inv.organisation_id, role: inv.role }); users.reload(); }
            catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
          }}>
            <label className="f">Organisation<select className="in" required value={inv.organisation_id} onChange={(e) => { const t = orgs.data?.find((x) => x.id === e.target.value)?.org_type ?? ""; setInv({ ...inv, organisation_id: e.target.value, role: ROLES_FOR[t]?.[0] ?? "" }); }}>
              <option value="">Choose…</option>{orgs.data?.map((x) => <option key={x.id} value={x.id}>{x.name} ({label(x.org_type)})</option>)}</select></label>
            <label className="f">Role<select className="in" required value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}>{(ROLES_FOR[org?.org_type ?? ""] ?? []).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
            <label className="f">Full name<input className="in" required value={inv.full_name} onChange={(e) => setInv({ ...inv, full_name: e.target.value })} /></label>
            <label className="f">Email<input className="in" type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></label>
            <div><button className="btn">Send invitation</button></div>
          </form>
        </Panel>
      </div>
      <Panel title="Organisations" flush>
        <Async r={orgs}>{(rows) => (
          <div className="cx-table-wrap"><table className="t"><thead><tr><th>Name</th><th>Type</th><th className="r">Users</th><th>Subscription</th><th>Status</th><th /></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.id}><td>{x.name}</td><td>{label(x.org_type)}</td><td className="r">{x.users}</td><td>{x.subscription ? `${label(x.subscription.plan)}${x.subscription.ends_at ? ` · until ${date(x.subscription.ends_at)}` : ""}` : <span style={{ color: "var(--warning)" }}>None</span>}</td><td><Badge s={x.status} /></td>
                <td className="r">{x.org_type !== "climactix" && <ActionButton className="btn sec sm" confirm={x.status === "active" ? `Suspend ${x.name}? All its users are signed out immediately.` : undefined} run={async () => { await api.post(`/admin/organisations/${x.id}/status`, undefined, { status: x.status === "active" ? "suspended" : "active" }); orgs.reload(); }}>{x.status === "active" ? "Suspend" : "Reactivate"}</ActionButton>}</td></tr>))}</tbody></table></div>)}</Async>
      </Panel>
      <Panel title="Users" flush>
        <Async r={users}>{(rows) => (
          <div className="cx-table-wrap"><table className="t"><thead><tr><th>User</th><th>Organisation</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.id}><td>{u.full_name}<div className="small muted">{u.email}</div></td><td>{u.organisation}</td><td>{ROLE_LABEL[u.role]}</td>
                <td><Badge s={u.status} />{u.locked && <Badge t="warn" text="Locked" />}</td><td className="small">{date(u.last_login_at, true)}</td>
                <td className="r"><div className="cx-row" style={{ justifyContent: "flex-end", gap: 6 }}>
                  {u.status !== "disabled" && <ActionButton className="btn ghost sm" run={async () => { const r = await api.post<{ link: string }>(`/admin/users/${u.id}/reset-link`); setLink({ link: r.link, delivered: false, email: u.email }); }}>{u.status === "invited" ? "New invite link" : "Reset link"}</ActionButton>}
                  {u.status !== "invited" && <ActionButton className={u.status === "active" ? "btn danger sm" : "btn sec sm"} confirm={u.status === "active" ? `Revoke access for ${u.email}? Their sessions end immediately.` : undefined}
                    run={async () => { await api.post(`/admin/users/${u.id}/status`, undefined, { status: u.status === "active" ? "disabled" : "active" }); users.reload(); }}>{u.status === "active" ? "Revoke access" : "Restore access"}</ActionButton>}
                </div></td></tr>))}</tbody></table></div>)}</Async>
      </Panel>
    </>
  );
}
