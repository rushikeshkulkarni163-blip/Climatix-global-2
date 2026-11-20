"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import CompanyPicker from "@/components/cxt/CompanyPicker";
import { UploadForm } from "@/components/cxt/Repository";
import { ActionButton, Alert, Async, Badge, FieldError, PageHead, Panel, Tabs, can, useApi, useMe, useToast } from "@/components/cxt/ui";
import { api, type CompanyBrief } from "@/lib/cxt/api";
import { date, label } from "@/lib/cxt/format";

interface Ref { sectors: { code: string; name: string }[]; connectors: { key: string; name: string; status: string; description: string; requires: string | null }[] }
interface Dup { cx_id: string; legal_name: string; reason: string; similarity: number }
interface Source { id: string; connector: string; url: string | null; label: string | null; status: string; last_checked_at: string | null; last_result: { candidates?: { url: string; label: string; period_hint: string | null; already_ingested?: boolean }[]; error?: string | null; requires?: string } }

function CreateCompany() {
  const ref = useApi<Ref>("/reference");
  const toast = useToast();
  const blank = { legal_name: "", common_name: "", registration_id: "", country: "India", sector_code: "", industry: "", website: "", headquarters: "" };
  const [f, setF] = useState(blank);
  const [dups, setDups] = useState<Dup[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; cx_id: string } | null>(null);
  const body = (allow = false) => ({ ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null])), legal_name: f.legal_name, country: f.country, allow_duplicate: allow });
  const submit = async (allow = false) => {
    setErr(null);
    try { const c = await api.post<{ id: string; cx_id: string }>("/companies", body(allow)); setCreated(c); setF(blank); setDups([]); toast(`Created ${c.cx_id}`); }
    catch (x) { const e = x as { message: string; body?: { duplicates?: Dup[] } }; setErr(e.message); if (e.body?.duplicates) setDups(e.body.duplicates); }
  };
  return (
    <Panel title="Create a company record">
      <form className="form g2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div style={{ gridColumn: "1 / -1" }}><FieldError error={err} />{created && <Alert kind="pos">Created <Link href={`/console/companies/${created.id}?tab=repository`}>{created.cx_id}</Link>. Add its reports from the profile or below.</Alert>}</div>
        <label className="f">Legal name<input className="in" required value={f.legal_name} onBlur={async () => { if (f.legal_name.length > 2) setDups((await api.post<{ duplicates: Dup[] }>("/companies/duplicates", body())).duplicates); }} onChange={(e) => setF({ ...f, legal_name: e.target.value })} /></label>
        <label className="f">Common name<input className="in" value={f.common_name} onChange={(e) => setF({ ...f, common_name: e.target.value })} /></label>
        <label className="f">CIN or registration identifier <span className="hint">CIN is validated against the MCA format</span><input className="in" value={f.registration_id} onChange={(e) => setF({ ...f, registration_id: e.target.value })} /></label>
        <label className="f">Country<input className="in" required value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></label>
        <label className="f">Sector<select className="in" value={f.sector_code} onChange={(e) => setF({ ...f, sector_code: e.target.value })}><option value="">Unclassified</option>{ref.data?.sectors.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
        <label className="f">Industry<input className="in" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></label>
        <label className="f">Website<input className="in" type="url" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
        <label className="f">Headquarters<input className="in" value={f.headquarters} onChange={(e) => setF({ ...f, headquarters: e.target.value })} /></label>
        {dups.length > 0 && <div style={{ gridColumn: "1 / -1" }}><Alert kind="warn">Possible duplicates: {dups.map((d) => `${d.legal_name} (${d.cx_id}, ${d.reason})`).join("; ")}</Alert></div>}
        <div className="cx-row" style={{ gridColumn: "1 / -1" }}><button className="btn">Create company</button>
          {dups.some((d) => d.similarity >= 0.98 && d.reason !== "same registration identifier") && <button type="button" className="btn sec" onClick={() => submit(true)}>Create anyway (distinct entity)</button>}</div>
      </form>
    </Panel>
  );
}

function ImportCsv() {
  const file = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<{ created: { row: number; cx_id: string; legal_name: string }[]; skipped: { row: number; legal_name: string; reason: string }[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Panel title="Import companies from CSV" sub="Columns: legal_name, country (required); common_name, registration_id, registration_type, sector_code, industry, website, headquarters.">
      <div className="cx-stack">
        <FieldError error={err} />
        <div className="cx-row"><input ref={file} type="file" accept=".csv" className="in" style={{ maxWidth: 360, paddingTop: 6 }} />
          <ActionButton run={async () => { setErr(null); const f = file.current?.files?.[0]; if (!f) throw new Error("Choose a CSV file"); const fd = new FormData(); fd.set("file", f); setRes(await api.upload("/companies/import", fd)); }}>Import</ActionButton></div>
        {res && <><Alert kind="pos">{res.created.length} created, {res.skipped.length} skipped.</Alert>
          {res.skipped.length > 0 && <table className="t"><thead><tr><th>Row</th><th>Name</th><th>Reason</th></tr></thead><tbody>{res.skipped.map((s) => <tr key={s.row}><td>{s.row}</td><td>{s.legal_name}</td><td>{s.reason}</td></tr>)}</tbody></table>}</>}
      </div>
    </Panel>
  );
}

function Sources() {
  const [company, setCompany] = useState<CompanyBrief | null>(null);
  const ref = useApi<Ref>("/reference");
  const r = useApi<Source[]>(company ? `/companies/${company.id}/sources` : null);
  const [connector, setConnector] = useState("web_discovery");
  const [url, setUrl] = useState("");
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const toast = useToast();
  return (
    <div className="cx-stack">
      <Panel title="Public-source ingestion" sub="Register a company's investor-relations or sustainability page, discover the reports it links to and ingest the ones you select. Retrieval honours robots.txt and refuses non-public addresses.">
        <div className="cx-stack">
          <div className="cx-row"><CompanyPicker onPick={setCompany} placeholder="Choose a company" />{company && <b>{company.legal_name}</b>}</div>
          {company && <form className="cx-row" onSubmit={async (e) => { e.preventDefault(); try { await api.post(`/companies/${company.id}/sources`, { connector, url: url || undefined }); setUrl(""); r.reload(); } catch (x) { toast(x instanceof Error ? x.message : "Failed"); } }}>
            <select className="in" style={{ maxWidth: 260 }} value={connector} onChange={(e) => setConnector(e.target.value)}>{ref.data?.connectors.map((c) => <option key={c.key} value={c.key}>{c.name}{c.status !== "operational" ? " (not configured)" : ""}</option>)}</select>
            <input className="in" style={{ maxWidth: 420 }} type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn">Register source</button></form>}
          {ref.data && <table className="t small"><tbody>{ref.data.connectors.map((c) => <tr key={c.key}><td>{c.name}</td><td><Badge s={c.status} /></td><td className="t2">{c.requires ?? c.description}</td></tr>)}</tbody></table>}
        </div>
      </Panel>
      {company && <Async r={r}>{(rows) => <>{rows.map((s) => (
        <Panel key={s.id} title={s.url ?? s.label ?? label(s.connector)} sub={`${label(s.connector)} · checked ${date(s.last_checked_at, true)}`} action={<Badge s={s.status} />}>
          <div className="cx-stack">
            {s.last_result.requires && <Alert kind="warn">Not configured: {s.last_result.requires}</Alert>}
            {s.last_result.error && <Alert kind="crit">{s.last_result.error}</Alert>}
            <div className="cx-row">
              {s.connector === "web_discovery" && s.status !== "pending_configuration" && <ActionButton className="btn sec sm" run={async () => { await api.post(`/sources/${s.id}/discover`).catch((e) => { throw e; }); r.reload(); }}>Discover reports</ActionButton>}
              {s.connector === "public_url" && <ActionButton className="btn sm" run={async () => { await api.post(`/sources/${s.id}/ingest`, { urls: [s.url] }); r.reload(); }} done="Retrieval queued">Retrieve and ingest</ActionButton>}
            </div>
            {(s.last_result.candidates ?? []).length > 0 && (
              <>
                <table className="t"><tbody>{s.last_result.candidates!.map((c) => (
                  <tr key={c.url}><td><input type="checkbox" disabled={c.already_ingested} checked={(picked[s.id] ?? []).includes(c.url)} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked ? [...(picked[s.id] ?? []), c.url] : (picked[s.id] ?? []).filter((u) => u !== c.url) })} aria-label={`Select ${c.label}`} /></td>
                    <td>{c.label}<div className="small muted">{c.url}</div></td><td>{c.period_hint ?? ""}</td><td>{c.already_ingested && <Badge t="pos" text="Ingested" />}</td></tr>))}</tbody></table>
                <ActionButton className="btn sm" disabled={!(picked[s.id] ?? []).length} run={async () => { await api.post(`/sources/${s.id}/ingest`, { urls: picked[s.id] }); setPicked({ ...picked, [s.id]: [] }); r.reload(); }} done="Retrieval queued; documents appear in the repository once processed">Ingest selected</ActionButton>
              </>)}
          </div>
        </Panel>))}</>}</Async>}
    </div>
  );
}

export default function AdminCompanies() {
  const { me } = useMe();
  const [tab, setTab] = useState<"create" | "upload" | "sources" | "merge">("create");
  const [src, setSrc] = useState<CompanyBrief | null>(null); const [tgt, setTgt] = useState<CompanyBrief | null>(null); const [why, setWhy] = useState("");
  return (
    <>
      <PageHead title="Companies and ingestion" sub="Create company records, add reports and register public sources. Every upload starts extraction, classification, company mapping and assessment." />
      <Tabs tabs={[["create", "Create or import"], ["upload", "Upload reports"], ["sources", "Public sources"], ...(can(me, "company.merge") ? [["merge", "Merge duplicates"] as ["merge", string]] : [])]} value={tab} onChange={setTab} />
      {tab === "create" && <div className="cx-grid g2"><CreateCompany /><ImportCsv /></div>}
      {tab === "upload" && <Panel title="Upload a report without naming the company" sub="The company is identified from the document. Ambiguous documents go to the review queue."><UploadForm companyId={null} onDone={() => {}} /></Panel>}
      {tab === "sources" && <Sources />}
      {tab === "merge" && (
        <Panel title="Merge duplicate company records" sub="All documents, data, assessments, scores and portfolio memberships move to the surviving record. The merged record is kept as an alias and redirect; the action is audited and cannot be undone automatically.">
          <div className="cx-stack">
            <div className="cx-row"><span style={{ width: 120 }}>Merge</span><CompanyPicker onPick={setSrc} placeholder="Duplicate record" />{src && <b>{src.legal_name} ({src.cx_id})</b>}</div>
            <div className="cx-row"><span style={{ width: 120 }}>into</span><CompanyPicker onPick={setTgt} placeholder="Surviving record" />{tgt && <b>{tgt.legal_name} ({tgt.cx_id})</b>}</div>
            <label className="f">Reason<textarea className="in" value={why} onChange={(e) => setWhy(e.target.value)} /></label>
            <div><ActionButton className="btn danger" disabled={!src || !tgt || why.length < 10} confirm={src && tgt ? `Merge ${src.legal_name} into ${tgt.legal_name}?` : undefined}
              run={async () => { await api.post("/companies/merge", { source_id: src!.id, target_id: tgt!.id, reason: why }); window.location.href = `/console/companies/${tgt!.id}`; }}>Merge records</ActionButton></div>
          </div>
        </Panel>)}
    </>
  );
}
