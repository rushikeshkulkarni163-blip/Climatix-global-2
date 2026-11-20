"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, type Me } from "@/lib/cxt/api";
import { ROLE_LABEL } from "@/lib/cxt/format";
import { Loading, MeContext, ToastProvider, can, entitled } from "./ui";

const IMMERSIVE = ["/console/earth"];
const PUBLIC = ["/console/login", "/console/accept-invite", "/console/reset-password", "/console/forgot-password"];

type NavItem = { href: string; label: string; show: (me: Me) => boolean };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { group: "Intelligence", items: [
    { href: "/console", label: "Overview", show: () => true },
    { href: "/console/companies", label: "Company search", show: () => true },
    { href: "/console/earth", label: "Climate Arena (3D)", show: () => true },
    { href: "/console/compare", label: "Compare companies", show: (m) => entitled(m, "comparison") },
    { href: "/console/portfolios", label: "Portfolios", show: (m) => can(m, "portfolio.manage") },
    { href: "/console/sectors", label: "Sector intelligence", show: (m) => can(m, "sector.aggregate") },
    { href: "/console/admin/methodology", label: "Scoring methodology", show: (m) => !can(m, "admin.dashboard") },
  ] },
  { group: "Company", items: [
    { href: "/console/assessment", label: "Assessment portal", show: (m) => m.user.role === "company_admin" },
    { href: "/console/corrections", label: "Correction requests", show: (m) => m.user.role === "company_admin" || can(m, "correction.decide") },
  ] },
  { group: "Review", items: [
    { href: "/console/review", label: "Extraction review", show: (m) => can(m, "review.read") },
    { href: "/console/review/assessments", label: "Assessment review", show: (m) => can(m, "review.read") },
  ] },
  { group: "Administration", items: [
    { href: "/console/admin", label: "Processing dashboard", show: (m) => can(m, "admin.dashboard") },
    { href: "/console/admin/companies", label: "Companies and ingestion", show: (m) => can(m, "company.manage") },
    { href: "/console/admin/accounts", label: "Organisations and users", show: (m) => can(m, "admin.users") },
    { href: "/console/admin/subscriptions", label: "Subscriptions", show: (m) => can(m, "admin.subscriptions") },
    { href: "/console/admin/methodology", label: "Scoring methodology", show: (m) => can(m, "admin.dashboard") },
    { href: "/console/admin/audit", label: "Audit trail", show: (m) => can(m, "audit.read") },
  ] },
];

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/console";
  const router = useRouter();
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "anon" | "down">("loading");
  // Set only once /auth/me has actually answered for the current page; guards
  // against redirecting on the state left over from the sign-in page.
  const checked = useRef(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const reload = useCallback(async () => {
    checked.current = false;
    try {
      const m = await api.get<Me>("/auth/me");
      checked.current = true;
      setMe(m);
      setState("ok");
    } catch (e) {
      checked.current = true;
      setMe(null);
      setState(e instanceof ApiError && e.status === 401 ? "anon" : "down");
    }
  }, []);

  useEffect(() => {
    if (!isPublic) { setState("loading"); reload(); }
  }, [isPublic, reload]);
  useEffect(() => {
    if (!isPublic && state === "anon" && checked.current) router.replace(`/console/login?next=${encodeURIComponent(path)}`);
  }, [isPublic, state, path, router]);
  useEffect(() => setOpen(false), [path]);

  if (isPublic) {
    return <div className="cx"><ToastProvider>{children}</ToastProvider></div>;
  }
  if (state === "down") {
    return (
      <div className="cx"><div className="cx-auth"><div className="box">
        <h2>Terminal service unavailable</h2>
        <p className="t2">The Climactix Terminal API could not be reached. If you are running locally, start it with
          <code> uvicorn cxt.main:app --port 8100</code> in <code>terminal_platform/</code>.</p>
        <button className="btn" onClick={reload}>Try again</button>
      </div></div></div>
    );
  }
  if (state !== "ok" || !me) return <div className="cx"><Loading rows={6} /></div>;

  // Immersive modules render full-bleed but keep the authenticated session and RBAC context.
  if (IMMERSIVE.some((p) => path.startsWith(p))) {
    return (
      <div className="cx">
        <MeContext.Provider value={{ me, reload }}>
          <ToastProvider>{children}</ToastProvider>
        </MeContext.Provider>
      </div>
    );
  }

  const sub = me.subscription;
  return (
    <div className="cx">
      <MeContext.Provider value={{ me, reload }}>
        <ToastProvider>
          <div className="cx-shell">
            <aside className={`cx-rail${open ? " open" : ""}`} aria-label="Main navigation">
              <div className="cx-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Climactix Global" />
                <div><b>Climactix Terminal</b><span>Sustainability intelligence</span></div>
              </div>
              <nav className="cx-nav">
                {NAV.map((g) => {
                  const items = g.items.filter((i) => i.show(me));
                  if (!items.length) return null;
                  return (
                    <div key={g.group} style={{ display: "contents" }}>
                      <div className="grp">{g.group}</div>
                      {items.map((i) => {
                        const on = i.href === "/console" ? path === "/console" : path === i.href || (path.startsWith(i.href + "/") && !items.some((o) => o.href !== i.href && o.href.startsWith(i.href) && path.startsWith(o.href)));
                        return <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>{i.label}</Link>;
                      })}
                    </div>
                  );
                })}
              </nav>
              <div className="cx-who">
                <b>{me.user.full_name}</b>
                <div className="muted">{ROLE_LABEL[me.user.role]} · {me.organisation.name}</div>
                {sub && sub.days_remaining !== null && (
                  <div className="muted" style={{ marginTop: 4 }}>
                    {sub.plan === "institutional_pilot" ? "Pilot access" : "Subscription"}: {sub.days_remaining} days remaining
                  </div>
                )}
                {!sub && me.organisation.type !== "climactix" && <div style={{ marginTop: 4, color: "var(--warning)" }}>No active subscription</div>}
                <div className="cx-row" style={{ marginTop: 10 }}>
                  <Link href="/console/account" className="small">Account</Link>
                  <button className="btn ghost sm" onClick={async () => { await api.post("/auth/logout").catch(() => {}); router.replace("/console/login"); }}>Sign out</button>
                </div>
              </div>
            </aside>
            <div className="cx-main">
              <div className="cx-top">
                <button className="btn sec sm cx-burger" aria-label="Open navigation" onClick={() => setOpen(!open)}>Menu</button>
                <form role="search" onSubmit={(e) => { e.preventDefault(); router.push(`/console/companies?q=${encodeURIComponent(q)}`); }}>
                  <input className="in" placeholder="Search companies by name, CX ID or CIN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search companies" />
                </form>
                <span className="small muted" style={{ marginLeft: "auto" }}>{me.organisation.name}</span>
              </div>
              <main className="cx-page">{children}</main>
            </div>
          </div>
        </ToastProvider>
      </MeContext.Provider>
    </div>
  );
}
