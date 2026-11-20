"use client";

import { useState } from "react";
import { ActionButton, Async, Badge, FieldError, PageHead, Panel, useApi, useMe, useToast } from "@/components/cxt/ui";
import { api } from "@/lib/cxt/api";
import { ROLE_LABEL, date, label } from "@/lib/cxt/format";

type Sess = { id: string; created_at: string; last_seen_at: string; expires_at: string; ip: string | null; user_agent: string | null; current: boolean };

export default function AccountPage() {
  const { me } = useMe();
  const sessions = useApi<Sess[]>("/auth/sessions");
  const toast = useToast();
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [err, setErr] = useState<string | null>(null);
  if (!me) return null;
  return (
    <>
      <PageHead title="Account" sub={`${me.user.full_name} · ${ROLE_LABEL[me.user.role]} · ${me.organisation.name}`} />
      <div className="cx-grid g2">
        <Panel title="Access">
          <dl className="cx-kv">
            <dt>Email</dt><dd>{me.user.email}</dd>
            <dt>Organisation</dt><dd>{me.organisation.name} ({label(me.organisation.type)})</dd>
            <dt>Subscription</dt><dd>{me.subscription ? `${label(me.subscription.plan)} · ${me.subscription.ends_at ? `until ${date(me.subscription.ends_at)}` : "no end date"}` : "None active"}</dd>
            <dt>Features</dt><dd>{me.entitlements.length ? me.entitlements.map((e) => label(e)).join(", ") : "Directory access only"}</dd>
          </dl>
        </Panel>
        <Panel title="Change password">
          <form className="form" onSubmit={async (e) => {
            e.preventDefault(); setErr(null);
            try {
              const r = await api.post<{ other_sessions_revoked: number }>("/auth/password/change", { current_password: cur, new_password: nw });
              toast(`Password changed. ${r.other_sessions_revoked} other session(s) signed out.`);
              setCur(""); setNw(""); sessions.reload();
            } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
          }}>
            <FieldError error={err} />
            <label className="f">Current password<input className="in" type="password" required value={cur} onChange={(e) => setCur(e.target.value)} /></label>
            <label className="f">New password<input className="in" type="password" required value={nw} onChange={(e) => setNw(e.target.value)} /></label>
            <div><button className="btn">Change password</button></div>
          </form>
        </Panel>
      </div>
      <Panel title="Active sessions" flush>
        <Async r={sessions}>{(rows) => (
          <div className="cx-table-wrap"><table className="t"><thead><tr><th>Signed in</th><th>Last active</th><th>Expires</th><th>Address</th><th>Client</th><th /></tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id}>
                <td>{date(s.created_at, true)} {s.current && <Badge t="accent" text="This session" />}</td>
                <td>{date(s.last_seen_at, true)}</td><td>{date(s.expires_at, true)}</td><td>{s.ip ?? "—"}</td>
                <td className="small muted">{(s.user_agent ?? "").slice(0, 60)}</td>
                <td className="r">{!s.current && <ActionButton className="btn sec sm" run={async () => { await api.del(`/auth/sessions/${s.id}`); sessions.reload(); }} done="Session signed out">Sign out</ActionButton>}</td>
              </tr>))}</tbody></table></div>
        )}</Async>
      </Panel>
    </>
  );
}
