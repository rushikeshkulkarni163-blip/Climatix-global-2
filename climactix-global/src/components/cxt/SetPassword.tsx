"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthBox from "./AuthBox";
import { Alert, FieldError } from "./ui";
import { api } from "@/lib/cxt/api";

/** Shared by invitation acceptance and password reset: both consume a single-use token. */
export default function SetPassword({ mode }: { mode: "invite" | "reset" }) {
  const token = useSearchParams()?.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const invite = mode === "invite";
  if (!token) {
    return <AuthBox title="Link incomplete"><Alert kind="crit">This link has no token. Use the full link you were given.</Alert></AuthBox>;
  }
  return (
    <AuthBox title={invite ? "Activate your account" : "Choose a new password"}
      sub="Use at least 12 characters, including letters and digits. The link can be used once.">
      {done ? (
        <><Alert kind="pos">{done}</Alert><Link href="/console/login" className="btn">Sign in</Link></>
      ) : (
        <form className="form" onSubmit={async (e) => {
          e.preventDefault(); setError(null);
          if (pw !== pw2) { setError("The two passwords do not match"); return; }
          try {
            const r = await api.post<{ message: string }>(invite ? "/auth/invite/accept" : "/auth/password/reset",
              invite ? { token, password: pw, full_name: name || undefined } : { token, password: pw });
            setDone(r.message);
          } catch (err) { setError(err instanceof Error ? err.message : "Request failed"); }
        }}>
          <FieldError error={error} />
          {invite && <label className="f">Full name <span className="hint">Optional — confirm or correct the name on your invitation</span><input className="in" value={name} onChange={(e) => setName(e.target.value)} /></label>}
          <label className="f">New password<input className="in" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="f">Confirm password<input className="in" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          <button className="btn">{invite ? "Activate account" : "Update password"}</button>
        </form>
      )}
    </AuthBox>
  );
}
