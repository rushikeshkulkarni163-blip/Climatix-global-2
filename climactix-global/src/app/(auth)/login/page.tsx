'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const IAM_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3100/api/v1';

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #1A1A1A inset; -webkit-text-fill-color: #e0e0e0; }
`;

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', rememberMe: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${IAM_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Login failed.'); return; }
      if (data.data?.mfaRequired) { setMfaChallenge(data.data.challengeId); return; }
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${IAM_URL}/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ challengeId: mfaChallenge, code: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Invalid code.'); return; }
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1A1A1A', border: '1px solid #262626',
    color: '#e0e0e0', padding: '12px 14px', fontSize: 13,
    fontFamily: 'var(--font-body)', outline: 'none', borderRadius: 8,
    transition: 'border-color 0.12s ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, color: '#666', letterSpacing: '0.12em',
    textTransform: 'uppercase' as const, marginBottom: 8, fontFamily: 'var(--font-body)',
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Panel */}
        <div style={{ background: '#111111', border: '1px solid #262626', padding: '40px 36px' }}>

          {/* Header */}
          <div style={{ marginBottom: 32, borderBottom: '1px solid #1a1a1a', paddingBottom: 24 }}>
            <div style={{ fontSize: 10, color: '#0057FF', letterSpacing: '0.18em', marginBottom: 10 }}>
              CLIMACTIX GLOBAL
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '0.01em', marginBottom: 6, fontFamily: 'var(--font-head)' }}>
              {mfaChallenge ? 'MFA VERIFICATION' : 'PLATFORM ACCESS'}
            </div>
            <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>
              {mfaChallenge
                ? 'Enter your authenticator code to continue'
                : 'Sign in to your intelligence workspace'}
            </div>
          </div>

          {!mfaChallenge ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Email */}
              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  ref={emailRef}
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="analyst@institution.com"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                  onBlur={(e) => e.target.style.borderColor = '#262626'}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                  <Link href="/forgot-password" style={{ fontSize: 10, color: '#0057FF', textDecoration: 'none', letterSpacing: '0.06em' }}>
                    FORGOT?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••••••"
                    style={{ ...inputStyle, paddingRight: 44 }}
                    onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                    onBlur={(e) => e.target.style.borderColor = '#262626'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                             background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em' }}
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
                  style={{ accentColor: '#0057FF', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 11, color: '#666', letterSpacing: '0.06em' }}>KEEP ME SIGNED IN (30 DAYS)</span>
              </label>

              {/* Error */}
              {error && (
                <div style={{ background: '#1a0000', border: '1px solid #FF5B5B33', padding: '10px 14px',
                              fontSize: 11, color: '#FF8A8A', letterSpacing: '0.06em', borderRadius: 8 }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', background: loading ? '#1A2C5C' : '#0057FF',
                  color: '#fff', border: 'none', padding: '13px 0',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase' as const, cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)', borderRadius: 8,
                  transition: 'background 0.12s ease',
                }}
              >
                {loading ? 'AUTHENTICATING...' : 'SIGN IN TO PLATFORM'}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
                <span style={{ fontSize: 10, color: '#444', letterSpacing: '0.08em' }}>OR CONTINUE WITH</span>
                <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
              </div>

              {/* SSO buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'GOOGLE', href: `${IAM_URL}/auth/google`, icon: '⬤' },
                  { label: 'MICROSOFT', href: `${IAM_URL}/auth/microsoft`, icon: '⬤' },
                  { label: 'LINKEDIN', href: `${IAM_URL}/auth/linkedin`, icon: '⬤' },
                ].map((sso) => (
                  <a key={sso.label} href={sso.href} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '10px 0', background: '#1A1A1A',
                    border: '1px solid #262626', color: '#999', textDecoration: 'none',
                    fontSize: 9, letterSpacing: '0.1em', borderRadius: 8,
                    transition: 'border-color 0.12s ease, color 0.12s ease',
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#0057FF'; (e.currentTarget as HTMLElement).style.color = '#0057FF'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#262626'; (e.currentTarget as HTMLElement).style.color = '#999'; }}
                  >
                    {sso.label}
                  </a>
                ))}
              </div>

              {/* Enterprise SSO */}
              <div style={{ textAlign: 'center', paddingTop: 4 }}>
                <a href="#enterprise-sso" style={{ fontSize: 10, color: '#555', textDecoration: 'none', letterSpacing: '0.08em' }}>
                  ENTERPRISE SSO / SAML →
                </a>
              </div>
            </form>
          ) : (
            /* MFA Form */
            <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#1A1A1A', border: '1px solid #262626', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', marginBottom: 8 }}>
                  AUTHENTICATOR CODE
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{
                    ...inputStyle, textAlign: 'center', fontSize: 28, letterSpacing: '0.4em',
                    fontWeight: 700, color: '#0057FF', border: 'none', background: 'transparent',
                    paddingLeft: 0, paddingRight: 0,
                  }}
                />
              </div>

              {error && (
                <div style={{ background: '#1a0000', border: '1px solid #FF5B5B33', padding: '10px 14px',
                              fontSize: 11, color: '#FF8A8A', letterSpacing: '0.06em', borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                style={{
                  width: '100%', background: (loading || mfaCode.length !== 6) ? '#1A2C5C' : '#0057FF',
                  color: '#fff', border: 'none', padding: '13px 0',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase' as const, cursor: (loading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)', borderRadius: 8,
                  transition: 'background 0.12s ease',
                }}
              >
                {loading ? 'VERIFYING...' : 'VERIFY & ACCESS'}
              </button>

              <button
                type="button"
                onClick={() => { setMfaChallenge(null); setMfaCode(''); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10, letterSpacing: '0.08em' }}
              >
                ← BACK TO LOGIN
              </button>
            </form>
          )}
        </div>

        {/* Register link */}
        {!mfaChallenge && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 11, color: '#444', letterSpacing: '0.06em' }}>NEW TO CLIMACTIX? </span>
            <Link href="/register" style={{ fontSize: 11, color: '#0057FF', textDecoration: 'none', letterSpacing: '0.06em' }}>
              REQUEST ACCESS →
            </Link>
          </div>
        )}

        {/* Security notice */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 10, color: '#2a2a2a', letterSpacing: '0.06em' }}>
            ⬤ TLS 1.3 ENCRYPTED · OWASP COMPLIANT · SOC 2 READY
          </span>
        </div>
      </div>
    </>
  );
}
