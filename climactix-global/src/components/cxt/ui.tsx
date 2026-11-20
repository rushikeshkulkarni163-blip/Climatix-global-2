"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiError, api, type Me } from "@/lib/cxt/api";
import { label, statusTone, tone } from "@/lib/cxt/format";

/* ── Session context ──────────────────────────────────────────────── */

export const MeContext = createContext<{ me: Me | null; reload: () => void }>({ me: null, reload: () => {} });
export const useMe = () => useContext(MeContext);
export const can = (me: Me | null, permission: string) => !!me?.permissions.includes(permission);
export const entitled = (me: Me | null, feature: string) => !!me?.entitlements.includes(feature);

/* ── Data loading ─────────────────────────────────────────────────── */

export function useApi<T>(path: string | null, query?: Record<string, string | number | boolean | undefined | null>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const key = path ? path + JSON.stringify(query ?? {}) : null;
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api.get<T>(path, query);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
    } finally {
      if (n === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

/* ── Toast ────────────────────────────────────────────────────────── */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="cx-toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

/* ── Building blocks ──────────────────────────────────────────────── */

export function Panel({ title, action, children, flush, sub }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; flush?: boolean; sub?: React.ReactNode }) {
  return (
    <section className="cx-panel">
      {title !== undefined && (
        <div className="hd">
          <div>
            <h3>{title}</h3>
            {sub && <p className="small muted" style={{ marginTop: 2 }}>{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? "bd flush" : "bd"}>{children}</div>
    </section>
  );
}

export function Badge({ s, text, t }: { s?: string; text?: string; t?: string }) {
  const cls = t ?? (s ? statusTone(s) : "none");
  return <span className={`badge ${cls === "none" ? "" : cls}`}>{text ?? label(s)}</span>;
}

export function Synthetic({ on }: { on: boolean }) {
  return on ? <span className="badge syn" title="Created for demonstration and testing. Not a real organisation.">Synthetic</span> : null;
}

/** Score bar. `plain` draws a neutral bar for quantities that are not scores (e.g. shares),
 *  so status colour is only ever used to encode a score band. */
export function Bar({ value, benchmark, plain }: { value: number | null; benchmark?: number | null; plain?: boolean }) {
  const t = plain ? "" : tone(value);
  return (
    <div className={`cx-bar ${t}`} role="img" aria-label={value === null ? "Not scored" : `${value.toFixed(1)} of 100`}>
      {value !== null && <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />}
      {benchmark !== null && benchmark !== undefined && <span className="bench" style={{ left: `${benchmark}%` }} title={`Sector median ${benchmark}`} />}
    </div>
  );
}

export function Kpi({ label: l, value, unit, note, lead }: { label: string; value: React.ReactNode; unit?: string; note?: React.ReactNode; lead?: boolean }) {
  return (
    <div className={`cx-kpi${lead ? " lead" : ""}`}>
      <div className="eyebrow">{l}</div>
      <div className="v">{value}{unit && <small>{unit}</small>}</div>
      {note && <div className="n">{note}</div>}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="cx-stack" aria-busy="true" aria-label="Loading" style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="cx-skel" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="cx-state">
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: ApiError; retry?: () => void }) {
  const title = error.status === 402 ? "Not included in your subscription"
    : error.status === 403 ? "You do not have access to this"
    : error.status === 404 ? "Not found"
    : error.status === 0 ? "Service unavailable" : "Something went wrong";
  return (
    <div className="cx-state" role="alert">
      <h4>{title}</h4>
      <p>{error.message}</p>
      {retry && error.status !== 403 && error.status !== 404 && error.status !== 402 && <button className="btn sec sm" onClick={retry}>Try again</button>}
    </div>
  );
}

/** Render loading / error / content from a useApi() result. */
export function Async<T>({ r, children, rows }: { r: { data: T | null; error: ApiError | null; loading: boolean; reload: () => void }; children: (d: T) => React.ReactNode; rows?: number }) {
  if (r.error) return <ErrorState error={r.error} retry={r.reload} />;
  if (r.loading && !r.data) return <Loading rows={rows} />;
  if (!r.data) return <Loading rows={rows} />;
  return <>{children(r.data)}</>;
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warn" | "crit" | "pos"; children: React.ReactNode }) {
  return <div className={`cx-alert ${kind}`} role={kind === "crit" ? "alert" : undefined}>{children}</div>;
}

export function PageHead({ title, sub, eyebrow, actions }: { title: React.ReactNode; sub?: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="cx-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="sub measure">{sub}</p>}
      </div>
      {actions && <div className="cx-row">{actions}</div>}
    </header>
  );
}

/** A button that runs an async action, shows progress and reports errors. */
export function ActionButton({ run, children, className = "btn", confirm, done, disabled, title }: {
  run: () => Promise<unknown>; children: React.ReactNode; className?: string; confirm?: string; done?: string; disabled?: boolean; title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <button type="button" className={className} disabled={busy || disabled} title={title} onClick={async () => {
      if (confirm && !window.confirm(confirm)) return;
      setBusy(true);
      try {
        await run();
        if (done) toast(done);
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }}>
      {busy ? "Working…" : children}
    </button>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

export function FieldError({ error }: { error: string | null }) {
  return error ? <Alert kind="crit">{error}</Alert> : null;
}
