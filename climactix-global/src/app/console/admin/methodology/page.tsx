"use client";

import { useState } from "react";
import { ActionButton, Alert, Async, Badge, FieldError, PageHead, Panel, can, useApi, useMe, useToast } from "@/components/cxt/ui";
import { api } from "@/lib/cxt/api";
import { date } from "@/lib/cxt/format";

interface M { id: string; version: string; status: string; config_hash: string; change_note: string; created_at: string; approved_at: string | null; weights: { id: string; name: string; weight: number }[];
  config?: { pillars: { id: string; name: string; weight: number; description: string; indicators: { id: string; name: string; weight: number; rule: string }[] }[]; deductions: { id: string; reason: string; points_each: number; max: number }[]; min_pillar_coverage: number; min_indicator_coverage: number; confidence: { weights: Record<string, number> } } }

export default function Methodology() {
  const { me } = useMe();
  const manage = can(me, "methodology.manage");
  const toast = useToast();
  const r = useApi<M[]>("/admin/methodology");
  const [w, setW] = useState<Record<string, number>>({});
  const [ver, setVer] = useState(""); const [note, setNote] = useState(""); const [err, setErr] = useState<string | null>(null);
  return (
    <Async r={r}>{(rows) => {
      const cur = rows.find((m) => m.status === "approved");
      const cfg = cur?.config;
      const total = cfg ? cfg.pillars.reduce((a, p) => a + (w[p.id] ?? p.weight), 0) : 0;
      return (
        <>
          <PageHead title="Scoring methodology" sub="The Climactix Score is computed by a versioned, published methodology. Changing it creates a new version that a second Super Administrator must approve; earlier scores keep the version that produced them." />
          {cur && cfg && (
            <Panel title={`Approved methodology v${cur.version}`} sub={`Approved ${date(cur.approved_at)} · ${cur.change_note}`}>
              <div className="cx-stack">
                {cfg.pillars.map((p) => (
                  <div key={p.id}>
                    <div className="cx-row" style={{ justifyContent: "space-between" }}><b>{p.name}</b><span className="num">{p.weight}%</span></div>
                    <p className="small t2">{p.description}</p>
                    <table className="t small"><tbody>{p.indicators.map((i) => <tr key={i.id}><td>{i.name}</td><td className="muted">{i.rule.replace(/_/g, " ")}</td><td className="r">{i.weight}</td></tr>)}</tbody></table>
                  </div>))}
                <div><b>Deductions</b><ul className="small t2" style={{ margin: "4px 0 0", paddingLeft: 18 }}>{cfg.deductions.map((d) => <li key={d.id}>{d.reason}: {d.points_each} points each, at most {d.max}</li>)}</ul></div>
                <p className="small t2">An overall score requires {Math.round(cfg.min_pillar_coverage * 100)}% of pillar weight to be evidenced; a pillar requires {Math.round(cfg.min_indicator_coverage * 100)}% of its indicator weight. Data Confidence weights: {Object.entries(cfg.confidence.weights).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ")}.</p>
              </div>
            </Panel>)}
          {manage && cfg && (
            <Panel title="Propose new pillar weights" sub="Creates a draft. Drafts do not affect any score until approved.">
              <div className="cx-stack">
                <FieldError error={err} />
                <div className="form g2">{cfg.pillars.map((p) => (
                  <label key={p.id} className="f">{p.name}<input className="in" type="number" min={1} max={100} value={w[p.id] ?? p.weight} onChange={(e) => setW({ ...w, [p.id]: Number(e.target.value) })} /></label>))}</div>
                <Alert kind={total === 100 ? "info" : "crit"}>Weights total {total}%{total !== 100 ? " — they must total 100%" : ""}.</Alert>
                <div className="form g2">
                  <label className="f">New version<input className="in" placeholder="e.g. 1.1" value={ver} onChange={(e) => setVer(e.target.value)} /></label>
                  <label className="f">Change note <span className="hint">Why the methodology is changing</span><input className="in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
                </div>
                <div><ActionButton disabled={total !== 100} run={async () => {
                  setErr(null);
                  const next = JSON.parse(JSON.stringify(cfg));
                  next.pillars.forEach((p: { id: string; weight: number }) => { p.weight = w[p.id] ?? p.weight; });
                  try { await api.post("/admin/methodology", { version: ver, config: next, change_note: note }); r.reload(); toast("Draft created"); } catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
                }}>Create draft</ActionButton></div>
              </div>
            </Panel>)}
          <Panel title="Version history" flush>
            <table className="t"><thead><tr><th>Version</th><th>Status</th><th>Weights</th><th>Change note</th><th>Created</th><th /></tr></thead>
              <tbody>{rows.map((m) => (
                <tr key={m.id}><td className="num">{m.version}</td><td><Badge s={m.status} /></td><td className="small">{m.weights.map((x) => `${x.name.split(" ")[0]} ${x.weight}`).join(" · ")}</td><td className="small t2">{m.change_note}</td><td className="small">{date(m.created_at)}</td>
                  <td className="r">{manage && m.status === "draft" && <ActionButton className="btn sm" confirm={`Approve v${m.version}? Every assessed company will be re-scored under it; existing scores are kept.`} run={async () => { const out = await api.post<{ companies_queued_for_rescoring: number }>(`/admin/methodology/${m.id}/approve`); toast(`Approved; ${out.companies_queued_for_rescoring} companies queued for re-scoring`); r.reload(); }}>Approve</ActionButton>}</td></tr>))}</tbody></table>
          </Panel>
        </>);
    }}</Async>
  );
}
