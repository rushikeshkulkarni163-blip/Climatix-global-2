"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AuthBox from "@/components/cxt/AuthBox";
import { FieldError } from "@/components/cxt/ui";
import { api } from "@/lib/cxt/api";

function LoginForm() {
  const next = useSearchParams()?.get("next") || "/console";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState<{ email: string; full_name: string; role: string; organisation: string }[] | null>(null);
  useEffect(() => {
    api.get<{ users: { email: string; full_name: string; role: string; organisation: string }[] }>("/auth/dev-login")
      .then((r) => setDev(r.users)).catch(() => setDev(null));
  }, []);
  // A full page load after sign-in, so the console starts from the new session.
  const go = () => window.location.assign(next.startsWith("/console") ? next : "/console");
  return (
    <AuthBox title="Sign in" sub="Access is provided to registered institutional, company and Climactix users.">
      <form className="form" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try {
          await api.post("/auth/login", { email, password });
          go();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Sign-in failed");
        } finally { setBusy(false); }
      }}>
        <FieldError error={error} />
        <label className="f">Work email<input className="in" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="f">Password<input className="in" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="cx-row small"><Link href="/console/forgot-password">Forgot password?</Link></div>
      {dev && dev.length > 0 && (
        <div className="cx-stack" style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}>
          <div className="eyebrow">Local development — continue without a password</div>
          {dev.map((u) => (
            <button key={u.email} type="button" className="btn sec" style={{ justifyContent: "space-between" }} onClick={async () => {
              setError(null);
              try { await api.post("/auth/dev-login", { email: u.email }); go(); }
              catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
            }}>
              <span>{u.full_name}</span><span className="small muted">{u.organisation}</span>
            </button>))}
        </div>)}
      <p className="small muted">Accounts are created by invitation. Contact Climactix to arrange institutional pilot access.</p>
    </AuthBox>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
