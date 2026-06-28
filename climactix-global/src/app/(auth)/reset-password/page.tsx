'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const IAM_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3100/api/v1';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'MIN 12 CHARS', met: password.length >= 12 },
    { label: 'UPPERCASE', met: /[A-Z]/.test(password) },
    { label: 'NUMBER', met: /[0-9]/.test(password) },
    { label: 'SPECIAL CHAR', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.met).length;
  const colors = ['#FF5B5B', '#FF8844', '#FFCC00', '#0057FF'];

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {checks.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 2,
            background: i < score ? colors[score - 1] : '#1a1a1a',
            transition: 'background 0.12s ease',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px 12px' }}>
        {checks.map((c) => (
          <span key={c.label} style={{ fontSize: 9, color: c.met ? '#0057FF' : '#333', letterSpacing: '0.06em' }}>
            {c.met ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1A1A1A', border: '1px solid #262626',
    color: '#e0e0e0', padding: '12px 14px', fontSize: 13, borderRadius: 8,
    fontFamily: 'var(--font-body)', outline: 'none',
    transition: 'border-color 0.12s ease',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${IAM_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Reset failed.'); return; }
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 420, fontFamily: 'var(--font-body)' }}>
      <div style={{ background: '#111111', border: '1px solid #262626', padding: '40px 36px' }}>

        <div style={{ marginBottom: 28, borderBottom: '1px solid #1a1a1a', paddingBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#0057FF', letterSpacing: '0.18em', marginBottom: 10 }}>CLIMACTIX GLOBAL</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '0.01em', marginBottom: 6, fontFamily: 'var(--font-head)' }}>
            {success ? 'PASSWORD UPDATED' : 'SET NEW PASSWORD'}
          </div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>
            {success ? 'All sessions revoked. Redirecting to sign in...' : 'Create a strong new password for your account'}
          </div>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {!token && (
              <div style={{ background: '#1a0000', border: '1px solid #FF5B5B33', padding: '12px 14px',
                            fontSize: 11, color: '#FF8A8A', letterSpacing: '0.06em', borderRadius: 8 }}>
                Invalid or missing reset token. Please request a new password reset link.
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#666', letterSpacing: '0.12em', marginBottom: 8 }}>
                NEW PASSWORD
              </label>
              <input type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 12 characters" style={inputStyle}
                disabled={!token}
                onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                onBlur={(e) => e.target.style.borderColor = '#262626'}
              />
              {password && <PasswordStrength password={password} />}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#666', letterSpacing: '0.12em', marginBottom: 8 }}>
                CONFIRM NEW PASSWORD
              </label>
              <input type="password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••••" style={inputStyle}
                disabled={!token}
                onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                onBlur={(e) => e.target.style.borderColor = '#262626'}
              />
              {confirm && password !== confirm && (
                <div style={{ fontSize: 10, color: '#FF5B5B', marginTop: 6, letterSpacing: '0.06em' }}>
                  ✗ PASSWORDS DO NOT MATCH
                </div>
              )}
              {confirm && password === confirm && confirm.length > 0 && (
                <div style={{ fontSize: 10, color: '#0057FF', marginTop: 6, letterSpacing: '0.06em' }}>
                  ✓ PASSWORDS MATCH
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: '#1a0000', border: '1px solid #FF5B5B33', padding: '10px 14px',
                            fontSize: 11, color: '#FF8A8A', letterSpacing: '0.06em', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !token} style={{
              width: '100%', background: (loading || !token) ? '#1A2C5C' : '#0057FF', color: '#fff',
              border: 'none', padding: '13px 0', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase' as const,
              cursor: (loading || !token) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)', borderRadius: 8,
            }}>
              {loading ? 'UPDATING PASSWORD...' : 'SET NEW PASSWORD'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, color: '#0057FF', marginBottom: 20 }}>✓</div>
            <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.06em', lineHeight: 1.7 }}>
              Your password has been updated and all active sessions have been revoked for security.
              You will be redirected to sign in.
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link href="/login" style={{ fontSize: 11, color: '#0057FF', textDecoration: 'none', letterSpacing: '0.06em' }}>
          ← BACK TO SIGN IN
        </Link>
      </div>
    </div>
  );
}
