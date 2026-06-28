'use client';

import { useState } from 'react';
import Link from 'next/link';

const IAM_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3100/api/v1';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetch(`${IAM_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      setSent(true); // Always show success (prevents user enumeration)
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1A1A1A', border: '1px solid #262626',
    color: '#e0e0e0', padding: '12px 14px', fontSize: 13, borderRadius: 8,
    fontFamily: 'var(--font-body)', outline: 'none',
    transition: 'border-color 0.12s ease',
  };

  return (
    <div style={{ width: '100%', maxWidth: 420, fontFamily: 'var(--font-body)' }}>
      <div style={{ background: '#111111', border: '1px solid #262626', padding: '40px 36px' }}>

        <div style={{ marginBottom: 28, borderBottom: '1px solid #1a1a1a', paddingBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#0057FF', letterSpacing: '0.18em', marginBottom: 10 }}>CLIMACTIX GLOBAL</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '0.01em', marginBottom: 6, fontFamily: 'var(--font-head)' }}>
            {sent ? 'CHECK YOUR EMAIL' : 'RESET ACCESS'}
          </div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>
            {sent
              ? 'A password reset link has been sent if this email exists'
              : 'Enter your email to receive a secure reset link'}
          </div>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#666', letterSpacing: '0.12em', marginBottom: 8 }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@institution.com" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                onBlur={(e) => e.target.style.borderColor = '#262626'}
              />
            </div>

            {error && (
              <div style={{ background: '#1a0000', border: '1px solid #FF5B5B33', padding: '10px 14px',
                            fontSize: 11, color: '#FF8A8A', letterSpacing: '0.06em', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <div style={{ background: '#0A0A0A', border: '1px solid #1a1a1a', padding: '12px 14px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.08em', lineHeight: 1.6 }}>
                SECURITY NOTE: The reset link expires in 1 hour. All active sessions will be revoked on password change.
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', background: loading ? '#1A2C5C' : '#0057FF', color: '#fff',
              border: 'none', padding: '13px 0', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase' as const,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)', borderRadius: 8,
            }}>
              {loading ? 'SENDING...' : 'SEND RESET LINK'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, color: '#0057FF', marginBottom: 20 }}>✉</div>
            <div style={{ fontSize: 11, color: '#666', lineHeight: 1.8, letterSpacing: '0.06em', marginBottom: 24 }}>
              If an account exists for <span style={{ color: '#e0e0e0' }}>{email}</span>,
              a password reset link has been dispatched. The link expires in 1 hour.
            </div>
            <div style={{ background: '#1A1A1A', border: '1px solid #1a1a1a', padding: '14px', fontSize: 10, color: '#444', letterSpacing: '0.06em', borderRadius: 8 }}>
              Didn't receive it? Check your spam folder or contact{' '}
              <a href="mailto:support@climactix.global" style={{ color: '#0057FF', textDecoration: 'none' }}>
                support@climactix.global
              </a>
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
