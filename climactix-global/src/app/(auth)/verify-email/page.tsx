'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const IAM_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3100/api/v1';

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setMessage('No verification token provided.'); return; }

    fetch(`${IAM_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setState('success');
          setTimeout(() => router.push('/dashboard'), 2000);
        } else {
          setState('error');
          setMessage(data.message || 'Verification failed.');
        }
      })
      .catch(() => { setState('error'); setMessage('Network error. Please try again.'); });
  }, [token, router]);

  return (
    <div style={{ width: '100%', maxWidth: 420, fontFamily: 'IBM Plex Mono, monospace' }}>
      <div style={{ background: '#080808', border: '1px solid #2C2C2C', padding: '48px 36px', textAlign: 'center' }}>

        {state === 'verifying' && (
          <>
            <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.12em', marginBottom: 20 }}>
              VERIFYING EMAIL ADDRESS
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 8, height: 8, background: '#FF6600', borderRadius: '50%',
                  animation: `pulse ${0.6 + i * 0.2}s ease-in-out infinite alternate`,
                  opacity: 0.3 + i * 0.3,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#444', letterSpacing: '0.06em' }}>
              Validating your verification link...
            </div>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={{ fontSize: 40, color: '#FF6600', marginBottom: 20 }}>✓</div>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 12 }}>
              EMAIL VERIFIED
            </div>
            <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.06em', marginBottom: 20 }}>
              Your account is now active. Redirecting to your intelligence workspace...
            </div>
            <div style={{ width: '100%', height: 2, background: '#1a1a1a', borderRadius: 1 }}>
              <div style={{ height: '100%', background: '#FF6600', width: '100%', animation: 'progress 2s linear' }} />
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{ fontSize: 40, color: '#FF4444', marginBottom: 20 }}>✗</div>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 12 }}>
              VERIFICATION FAILED
            </div>
            <div style={{ background: '#1a0a00', border: '1px solid #FF660033', padding: '12px 16px',
                          fontSize: 11, color: '#FF9944', letterSpacing: '0.06em', marginBottom: 24, borderRadius: 2 }}>
              {message}
            </div>
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
              <button
                onClick={() => fetch(`${IAM_URL}/auth/resend-verification`, { method: 'POST', body: JSON.stringify({ email: '' }), headers: { 'Content-Type': 'application/json' } })}
                style={{ width: '100%', background: '#FF6600', color: '#000', border: 'none',
                          padding: '12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                          cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', borderRadius: 3 }}
              >
                RESEND VERIFICATION EMAIL
              </button>
              <Link href="/login" style={{ fontSize: 10, color: '#555', textDecoration: 'none', letterSpacing: '0.08em' }}>
                ← BACK TO SIGN IN
              </Link>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse { from { transform: scale(0.8); } to { transform: scale(1.2); } }
        @keyframes progress { from { width: 0; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
