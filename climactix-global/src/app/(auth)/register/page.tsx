'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const IAM_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3100/api/v1';

const USER_TYPES = [
  { value: 'enterprise_client', label: 'Enterprise Client', desc: 'Corporate sustainability & ESG teams' },
  { value: 'investor', label: 'Institutional Investor', desc: 'Asset managers, PE, sovereign wealth' },
  { value: 'esg_analyst', label: 'ESG Analyst', desc: 'Independent analysts & advisors' },
  { value: 'government', label: 'Government / Regulator', desc: 'Policy bodies & regulatory agencies' },
  { value: 'auditor', label: 'Auditor / Verifier', desc: 'Third-party ESG assurance professionals' },
  { value: 'community', label: 'Community / Researcher', desc: 'Academia, NGOs, climate researchers' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    userType: '', organizationName: '', acceptedTerms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0a0a0a', border: '1px solid #2C2C2C',
    color: '#e0e0e0', padding: '12px 14px', fontSize: 13, borderRadius: 3,
    fontFamily: 'IBM Plex Mono, monospace', outline: 'none',
    transition: 'border-color 0.12s ease',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, color: '#666', letterSpacing: '0.12em',
    textTransform: 'uppercase' as const, marginBottom: 8,
    fontFamily: 'IBM Plex Mono, monospace',
  };

  function validateStep1() {
    if (!form.firstName.trim() || !form.lastName.trim()) return 'Full name required.';
    if (!form.email.includes('@')) return 'Valid email required.';
    if (form.password.length < 12) return 'Password must be at least 12 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!/[A-Z]/.test(form.password)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(form.password)) return 'Password must contain a number.';
    if (!/[^A-Za-z0-9]/.test(form.password)) return 'Password must contain a special character.';
    return null;
  }

  function handleNext() {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.userType) { setError('Please select your account type.'); return; }
    if (!form.acceptedTerms) { setError('You must accept the Terms of Service.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${IAM_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
          userType: form.userType,
          organizationName: form.organizationName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Registration failed.'); return; }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ width: '100%', maxWidth: 440, fontFamily: 'IBM Plex Mono, monospace' }}>
        <div style={{ background: '#080808', border: '1px solid #2C2C2C', padding: '40px 36px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 20 }}>✓</div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 12 }}>
            ACCOUNT CREATED
          </div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.7, marginBottom: 24 }}>
            A verification email has been sent to <span style={{ color: '#FF6600' }}>{form.email}</span>.
            Please verify your email to activate your account.
          </div>
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '14px', fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>
            Check your spam folder if you don't see it within 2 minutes.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 480, fontFamily: 'IBM Plex Mono, monospace' }}>
      <div style={{ background: '#080808', border: '1px solid #2C2C2C', padding: '40px 36px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, borderBottom: '1px solid #1a1a1a', paddingBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#FF6600', letterSpacing: '0.18em', marginBottom: 10 }}>
            CLIMACTIX GLOBAL
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '0.04em', marginBottom: 6 }}>
            REQUEST PLATFORM ACCESS
          </div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>
            Institutional-grade climate intelligence — step {step} of 2
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              flex: 1, height: 2,
              background: s <= step ? '#FF6600' : '#1a1a1a',
              transition: 'background 0.12s ease',
            }} />
          ))}
        </div>

        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Name row */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>First Name</label>
                <input type="text" required value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Ishaan" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#FF6600'}
                  onBlur={(e) => e.target.style.borderColor = '#2C2C2C'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Last Name</label>
                <input type="text" required value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Mehta" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#FF6600'}
                  onBlur={(e) => e.target.style.borderColor = '#2C2C2C'}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Work Email</label>
              <input type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="analyst@institution.com" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#FF6600'}
                onBlur={(e) => e.target.style.borderColor = '#2C2C2C'}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 12 chars, uppercase, number, special" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#FF6600'}
                onBlur={(e) => e.target.style.borderColor = '#2C2C2C'}
              />
              {/* Password strength */}
              {form.password && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {[
                    form.password.length >= 12,
                    /[A-Z]/.test(form.password),
                    /[0-9]/.test(form.password),
                    /[^A-Za-z0-9]/.test(form.password),
                  ].map((met, i) => (
                    <div key={i} style={{ flex: 1, height: 2, background: met ? '#FF6600' : '#1a1a1a', transition: 'background 0.12s' }} />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" required value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="••••••••••••" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#FF6600'}
                onBlur={(e) => e.target.style.borderColor = '#2C2C2C'}
              />
            </div>

            {error && (
              <div style={{ background: '#1a0a00', border: '1px solid #FF660033', padding: '10px 14px',
                            fontSize: 11, color: '#FF9944', letterSpacing: '0.06em', borderRadius: 2 }}>
                {error}
              </div>
            )}

            <button onClick={handleNext} style={{
              width: '100%', background: '#FF6600', color: '#000', border: 'none',
              padding: '13px 0', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase' as const, cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace', borderRadius: 3,
            }}>
              CONTINUE →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Account type */}
            <div>
              <label style={labelStyle}>Account Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {USER_TYPES.map((type) => (
                  <label key={type.value} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                    background: form.userType === type.value ? '#1a0d00' : '#0a0a0a',
                    border: `1px solid ${form.userType === type.value ? '#FF6600' : '#2C2C2C'}`,
                    cursor: 'pointer', borderRadius: 3, transition: 'all 0.12s ease',
                  }}>
                    <input type="radio" name="userType" value={type.value}
                      checked={form.userType === type.value}
                      onChange={(e) => setForm({ ...form, userType: e.target.value })}
                      style={{ accentColor: '#FF6600', marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#e0e0e0', letterSpacing: '0.06em' }}>
                        {type.label.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 10, color: '#555', marginTop: 2, letterSpacing: '0.04em' }}>
                        {type.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Organization name */}
            {['enterprise_client', 'investor', 'government', 'auditor'].includes(form.userType) && (
              <div>
                <label style={labelStyle}>Organization Name</label>
                <input type="text" value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  placeholder="Reliance Industries Ltd" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#FF6600'}
                  onBlur={(e) => e.target.style.borderColor = '#2C2C2C'}
                />
              </div>
            )}

            {/* Terms */}
            <label style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={form.acceptedTerms}
                onChange={(e) => setForm({ ...form, acceptedTerms: e.target.checked })}
                style={{ accentColor: '#FF6600', marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ fontSize: 10, color: '#666', letterSpacing: '0.06em', lineHeight: 1.6 }}>
                I AGREE TO THE{' '}
                <a href="#" style={{ color: '#FF6600', textDecoration: 'none' }}>TERMS OF SERVICE</a>
                {' '}AND{' '}
                <a href="#" style={{ color: '#FF6600', textDecoration: 'none' }}>PRIVACY POLICY</a>
              </span>
            </label>

            {error && (
              <div style={{ background: '#1a0a00', border: '1px solid #FF660033', padding: '10px 14px',
                            fontSize: 11, color: '#FF9944', letterSpacing: '0.06em', borderRadius: 2 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep(1)} style={{
                flex: '0 0 auto', background: 'none', border: '1px solid #2C2C2C', color: '#666',
                padding: '13px 20px', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace', borderRadius: 3,
              }}>
                ← BACK
              </button>
              <button type="submit" disabled={loading} style={{
                flex: 1, background: loading ? '#331a00' : '#FF6600', color: '#000',
                border: 'none', padding: '13px 0', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'IBM Plex Mono, monospace', borderRadius: 3,
              }}>
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <span style={{ fontSize: 11, color: '#444', letterSpacing: '0.06em' }}>ALREADY HAVE ACCESS? </span>
        <Link href="/login" style={{ fontSize: 11, color: '#FF6600', textDecoration: 'none', letterSpacing: '0.06em' }}>
          SIGN IN →
        </Link>
      </div>
    </div>
  );
}
