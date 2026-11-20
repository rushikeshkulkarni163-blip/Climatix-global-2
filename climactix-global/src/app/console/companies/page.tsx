"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Async, Badge, Bar, Empty, PageHead, Panel, Synthetic, entitled, useApi, useMe } from "@/components/cxt/ui";
import type { CompanyBrief } from "@/lib/cxt/api";
import { date } from "@/lib/cxt/format";

interface ScreenRow extends CompanyBrief { score: number | null; score_status: string; confidence: number | null; confidence_band: string | null; latest_period: string | null; net_zero: { target_year: number; validation_status: string } | null; scored_at: string | null }
interface DirRow extends CompanyBrief { public_documents: number; public_score?: { overall: number | null; confidence: number; fy_label: string | null } | null }
interface Ref { sectors: { code: string; name: string }[] }

function Search() {
  const sp = useSearchParams();
  const router = useRouter();
  const { me } = useMe();
  const screening = entitled(me, "company_intelligence");
  const [q, setQ] = useState(sp?.get("q") ?? "");
  const [sector, setSector] = useState("");
  const [minScore, setMinScore] = useState("");
  const [minConf, setMinConf] = useState("");
  const [nz, setNz] = useState("");
  const [sort, setSort] = useState("score");
  useEffect(() => { setQ(sp?.get("q") ?? ""); }, [sp]);
  const ref = useApi<Ref>("/reference");
  const screen = useApi<{ total: number; items: ScreenRow[] }>(screening ? "/screen" : null,
    { q, sector, min_score: minScore, min_confidence: minConf, net_zero: nz === "" ? undefined : nz === "yes", sort, limit: 200 });
  const dir = useApi<{ total: number; items: DirRow[] }>(screening ? null : "/companies", { q, sector, limit: 100 });

  return (
    <>
      <PageHead title="Company search" sub={screening ? "Screen companies on the Public Data Score, data confidence, sector and Net Zero commitment. Scores describe disclosed information; they are not credit or investment decisions." : "Find companies in the Climactix directory."} />
      <Panel>
        <form className="cx-row" onSubmit={(e) => { e.preventDefault(); router.replace(`/console/companies?q=${encodeURIComponent(q)}`); }}>
          <input className="in" style={{ maxWidth: 320 }} placeholder="Name, CX ID or CIN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select className="in" style={{ maxWidth: 240 }} value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
            <option value="">All sectors</option>{ref.data?.sectors.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          {screening && <>
            <input className="in" style={{ maxWidth: 120 }} type="number" min={0} max={100} placeholder="Min score" value={minScore} onChange={(e) => setMinScore(e.target.value)} aria-label="Minimum score" />
            <input className="in" style={{ maxWidth: 150 }} type="number" min={0} max={100} placeholder="Min confidence" value={minConf} onChange={(e) => setMinConf(e.target.value)} aria-label="Minimum confidence" />
            <select className="in" style={{ maxWidth: 180 }} value={nz} onChange={(e) => setNz(e.target.value)} aria-label="Net zero target">
              <option value="">Any Net Zero status</option><option value="yes">Has Net Zero target</option><option value="no">No Net Zero target found</option>
            </select>
            <select className="in" style={{ maxWidth: 160 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="score">Sort by score</option><option value="confidence">Sort by confidence</option><option value="name">Sort by name</option>
            </select>
          </>}
        </form>
      </Panel>
      {screening ? (
        <Panel flush title={screen.data ? `${screen.data.total} companies` : "Companies"}>
          <Async r={screen}>{(d) => d.items.length === 0 ? <Empty title="No companies match">Adjust the filters, or ask Climactix to add the company to the database.</Empty> : (
            <div className="cx-table-wrap"><table className="t">
              <thead><tr><th>Company</th><th>Sector</th><th className="r">Score</th><th style={{ width: 120 }} /><th className="r">Confidence</th><th>Net Zero</th><th>Latest period</th></tr></thead>
              <tbody>{d.items.map((c) => (
                <tr key={c.id} className="click" onClick={() => router.push(`/console/companies/${c.id}`)}>
                  <td><Link href={`/console/companies/${c.id}`} onClick={(e) => e.stopPropagation()}>{c.legal_name}</Link> <Synthetic on={c.is_synthetic} /><div className="small muted">{c.cx_id}</div></td>
                  <td>{c.sector ?? "—"}</td>
                  <td className="r num">{c.score_status === "scored" ? c.score?.toFixed(1) : <Badge s={c.score_status === "not_assessed" ? "pending" : "insufficient_evidence"} text={c.score_status === "not_assessed" ? "Not assessed" : "Insufficient evidence"} />}</td>
                  <td><Bar value={c.score} /></td>
                  <td className="r">{c.confidence !== null ? <span className="num">{c.confidence.toFixed(0)}</span> : "—"}</td>
                  <td>{c.net_zero ? <>{c.net_zero.target_year}</> : <span className="muted">None found</span>}</td>
                  <td className="small">{c.latest_period ?? "—"}<div className="muted">{c.scored_at ? `scored ${date(c.scored_at)}` : ""}</div></td>
                </tr>))}</tbody></table></div>
          )}</Async>
        </Panel>
      ) : (
        <Panel flush title={dir.data ? `${dir.data.total} companies` : "Companies"}>
          <Async r={dir}>{(d) => d.items.length === 0 ? <Empty title="No companies match" /> : (
            <div className="cx-table-wrap"><table className="t">
              <thead><tr><th>Company</th><th>Sector</th><th>Country</th><th className="r">Public documents</th>{d.items[0]?.public_score !== undefined && <th className="r">Score</th>}</tr></thead>
              <tbody>{d.items.map((c) => (
                <tr key={c.id} className="click" onClick={() => router.push(`/console/companies/${c.id}`)}>
                  <td><Link href={`/console/companies/${c.id}`}>{c.legal_name}</Link> <Synthetic on={c.is_synthetic} /><div className="small muted">{c.cx_id}</div></td>
                  <td>{c.sector ?? "—"}</td><td>{c.country}</td><td className="r num">{c.public_documents}</td>
                  {c.public_score !== undefined && <td className="r num">{c.public_score?.overall?.toFixed(1) ?? "—"}</td>}
                </tr>))}</tbody></table></div>
          )}</Async>
        </Panel>
      )}
    </>
  );
}

export default function Page() { return <Suspense><Search /></Suspense>; }
