"use client";

import Link from "next/link";
import { useState } from "react";
import AuthBox from "@/components/cxt/AuthBox";
import { Alert, FieldError } from "@/components/cxt/ui";
import { api } from "@/lib/cxt/api";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ message: string; email_delivery_configured: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthBox title="Reset your password" sub="Enter the email address of your account.">
      {done ? (
        <>
          <Alert kind="pos">{done.message}</Alert>
          {!done.email_delivery_configured && (
            <Alert kind="warn">Email delivery is not configured on this installation, so no message was sent. Ask your Climactix administrator for a reset link.</Alert>
          )}
        </>
      ) : (
        <form className="form" onSubmit={async (e) => {
          e.preventDefault(); setError(null);
          try { setDone(await api.post("/auth/password/forgot", { email })); }
          catch (err) { setError(err instanceof Error ? err.message : "Request failed"); }
        }}>
          <FieldError error={error} />
          <label className="f">Work email<input className="in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn">Send reset instructions</button>
        </form>
      )}
      <Link href="/console/login" className="small">Back to sign in</Link>
    </AuthBox>
  );
}
