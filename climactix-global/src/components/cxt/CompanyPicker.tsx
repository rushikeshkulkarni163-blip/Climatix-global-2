"use client";

import { useState } from "react";
import type { CompanyBrief } from "@/lib/cxt/api";
import { useApi } from "./ui";

/** Type-ahead company selector backed by the company search API. */
export default function CompanyPicker({ onPick, exclude = [], placeholder = "Search for a company" }: { onPick: (c: CompanyBrief) => void; exclude?: string[]; placeholder?: string }) {
  const [q, setQ] = useState("");
  const r = useApi<{ items: CompanyBrief[] }>(q.trim().length >= 2 ? "/companies" : null, { q, limit: 8 });
  const items = (r.data?.items ?? []).filter((c) => !exclude.includes(c.id));
  return (
    <div style={{ position: "relative", maxWidth: 420, width: "100%" }}>
      <input className="in" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {q.trim().length >= 2 && (
        <div className="cx-panel" style={{ position: "absolute", left: 0, right: 0, top: 40, zIndex: 20, maxHeight: 280, overflow: "auto" }}>
          {r.loading && !r.data ? <div className="small muted" style={{ padding: 10 }}>Searching…</div>
            : items.length === 0 ? <div className="small muted" style={{ padding: 10 }}>No matching companies</div>
            : items.map((c) => (
              <button key={c.id} type="button" onClick={() => { onPick(c); setQ(""); }}
                style={{ all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-soft)" }}>
                <b>{c.legal_name}</b> <span className="small muted">{c.cx_id} · {c.sector ?? "Unclassified"}</span>
              </button>))}
        </div>)}
    </div>
  );
}
