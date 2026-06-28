'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const IAM_URL = process.env.NEXT_PUBLIC_IAM_URL || 'http://localhost:3100/api/v1';

const STEPS = ['ORGANIZATION', 'WORKSPACE', 'TEAM', 'ACTIVATE'];

const INDUSTRIES = [
  'Banking & Financial Services', 'Asset Management', 'Insurance',
  'Energy & Utilities', 'Oil & Gas', 'Manufacturing', 'Pharmaceuticals',
  'Real Estate', 'Technology', 'Telecommunications', 'Transportation & Logistics',
  'Mining & Metals', 'Agriculture', 'Retail & Consumer', 'Government & Public Sector',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    orgName: '', industry: '', country: '', employeeRange: '',
    workspaceSlug: '', climateNamespace: '',
    inviteEmails: ['', '', ''],
    enableSso: false, ssoProvider: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1A1A1A', border: '1px solid #262626',
    color: '#e0e0e0', padding: '12px 14px', fontSize: 13, borderRadius: 8,
    fontFamily: 'var(--font-body)', outline: 'none',
    transition: 'border-color 0.12s ease',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, color: '#666', letterSpacing: '0.12em',
    marginBottom: 8, fontFamily: 'var(--font-body)',
  };

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      // Send invites for non-empty emails
      const validEmails = form.inviteEmails.filter((e) => e.trim() && e.includes('@'));
      // In a real impl, this would call the org invite endpoint
      router.push('/dashboard');
    } catch {
      setError('Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const EMPLOYEE_RANGES = ['1–50', '51–200', '201–1,000', '1,001–10,000', '10,001–100,000', '100,000+'];

  return (
    <div style={{ width: '100%', maxWidth: 580, fontFamily: 'var(--font-body)' }}>
      <div style={{ background: '#111111', border: '1px solid #262626', padding: '40px 36px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, borderBottom: '1px solid #1a1a1a', paddingBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#0057FF', letterSpacing: '0.18em', marginBottom: 10 }}>CLIMACTIX GLOBAL</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '0.01em', marginBottom: 6, fontFamily: 'var(--font-head)' }}>
            ORGANIZATION SETUP
          </div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>
            Configure your climate intelligence workspace — step {step + 1} of {STEPS.length}
          </div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < step ? '#0057FF' : i === step ? '#1a1a1a' : '#1A1A1A',
                border: `1px solid ${i <= step ? '#0057FF' : '#262626'}`,
                fontSize: 10, color: i < step ? '#fff' : i === step ? '#0057FF' : '#333',
                fontWeight: 700,
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 8, color: i === step ? '#0057FF' : '#444', letterSpacing: '0.1em' }}>{s}</span>
              {i < STEPS.length - 1 && (
                <div style={{
                  position: 'absolute' as const, width: 'calc(25% - 28px)',
                  height: 1, background: i < step ? '#0057FF' : '#1a1a1a',
                  top: 14, left: `calc(${i * 25}% + 14px)`,
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Organization */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>ORGANIZATION LEGAL NAME</label>
              <input type="text" value={form.orgName}
                onChange={(e) => { setForm({ ...form, orgName: e.target.value, workspaceSlug: generateSlug(e.target.value) }); }}
                placeholder="Reliance Industries Ltd" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                onBlur={(e) => e.target.style.borderColor = '#262626'}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>INDUSTRY SECTOR</label>
                <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  style={{ ...inputStyle, appearance: 'none' as const }}>
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>COUNTRY / REGION</label>
                <input type="text" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="India" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                  onBlur={(e) => e.target.style.borderColor = '#262626'}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>EMPLOYEE COUNT RANGE</label>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                {EMPLOYEE_RANGES.map((range) => (
                  <button key={range} type="button" onClick={() => setForm({ ...form, employeeRange: range })}
                    style={{
                      padding: '8px 14px', background: form.employeeRange === range ? '#0a1a3d' : '#1A1A1A',
                      border: `1px solid ${form.employeeRange === range ? '#0057FF' : '#262626'}`,
                      color: form.employeeRange === range ? '#0057FF' : '#666',
                      fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', borderRadius: 8,
                    }}>
                    {range}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Workspace */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>WORKSPACE IDENTIFIER</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #262626', borderRadius: 8, overflow: 'hidden' }}>
                <span style={{ background: '#0A0A0A', padding: '12px 14px', fontSize: 12, color: '#444', borderRight: '1px solid #262626', whiteSpace: 'nowrap' as const }}>
                  climactix.global/
                </span>
                <input type="text" value={form.workspaceSlug}
                  onChange={(e) => setForm({ ...form, workspaceSlug: generateSlug(e.target.value) })}
                  placeholder="reliance-industries"
                  style={{ ...inputStyle, border: 'none', borderRadius: 0 }}
                />
              </div>
              <div style={{ fontSize: 10, color: '#444', marginTop: 6, letterSpacing: '0.06em' }}>
                Permanent workspace URL — cannot be changed after creation.
              </div>
            </div>

            <div>
              <label style={labelStyle}>CLIMATE DATA NAMESPACE</label>
              <input type="text" value={form.climateNamespace || `cx-${form.workspaceSlug}`}
                onChange={(e) => setForm({ ...form, climateNamespace: e.target.value })}
                placeholder="cx-reliance-industries"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                onBlur={(e) => e.target.style.borderColor = '#262626'}
              />
              <div style={{ fontSize: 10, color: '#444', marginTop: 6, letterSpacing: '0.06em' }}>
                Unique identifier for your climate intelligence data store.
              </div>
            </div>

            <div style={{ background: '#0A0A0A', border: '1px solid #1a1a1a', padding: '16px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#0057FF', letterSpacing: '0.12em', marginBottom: 10 }}>ENTERPRISE SSO</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
                <input type="checkbox" checked={form.enableSso}
                  onChange={(e) => setForm({ ...form, enableSso: e.target.checked })}
                  style={{ accentColor: '#0057FF' }}
                />
                <span style={{ fontSize: 11, color: '#999', letterSpacing: '0.06em' }}>ENABLE ENTERPRISE SSO / SAML</span>
              </label>
              {form.enableSso && (
                <select value={form.ssoProvider} onChange={(e) => setForm({ ...form, ssoProvider: e.target.value })}
                  style={{ ...inputStyle, marginTop: 8 }}>
                  <option value="">Select SSO provider...</option>
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OpenID Connect (OIDC)</option>
                  <option value="azure_ad">Microsoft Azure AD</option>
                  <option value="okta">Okta</option>
                  <option value="google_workspace">Google Workspace</option>
                </select>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Team */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em', lineHeight: 1.7 }}>
              Invite team members to your Climactix workspace. They'll receive an email with access instructions.
            </div>
            {form.inviteEmails.map((email, i) => (
              <div key={i}>
                <label style={labelStyle}>TEAM MEMBER {i + 1} EMAIL{i === 0 ? ' (OPTIONAL)' : ''}</label>
                <input type="email" value={email}
                  onChange={(e) => {
                    const newEmails = [...form.inviteEmails];
                    newEmails[i] = e.target.value;
                    setForm({ ...form, inviteEmails: newEmails });
                  }}
                  placeholder="analyst@company.com" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#0057FF'}
                  onBlur={(e) => e.target.style.borderColor = '#262626'}
                />
              </div>
            ))}
            <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.06em' }}>
              You can add more team members from your workspace settings after setup.
            </div>
          </div>
        )}

        {/* Step 3: Activate */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#0A0A0A', border: '1px solid #1a1a1a', padding: '20px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#0057FF', letterSpacing: '0.12em', marginBottom: 14 }}>WORKSPACE SUMMARY</div>
              {[
                { label: 'ORGANIZATION', value: form.orgName || '—' },
                { label: 'INDUSTRY', value: form.industry || '—' },
                { label: 'WORKSPACE URL', value: `climactix.global/${form.workspaceSlug || '—'}` },
                { label: 'DATA NAMESPACE', value: form.climateNamespace || `cx-${form.workspaceSlug}` || '—' },
                { label: 'ENTERPRISE SSO', value: form.enableSso ? (form.ssoProvider || 'Enabled') : 'Disabled' },
                { label: 'TEAM INVITES', value: `${form.inviteEmails.filter((e) => e.includes('@')).length} pending` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                          padding: '10px 0', borderBottom: '1px solid #111' }}>
                  <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#e0e0e0', maxWidth: 240, textAlign: 'right' as const, wordBreak: 'break-all' as const }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#0A0A0A', border: '1px solid #1a1a1a', padding: '14px', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.06em', lineHeight: 1.6 }}>
                By activating, your organization workspace will be provisioned with a dedicated climate intelligence namespace,
                isolated data store, and tenant-level access controls. Settings can be modified from the Admin Panel.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#1a0000', border: '1px solid #FF5B5B33', padding: '10px 14px',
                        fontSize: 11, color: '#FF8A8A', letterSpacing: '0.06em', borderRadius: 8, marginTop: 16 }}>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1 as any)} style={{
              flex: '0 0 auto', background: 'none', border: '1px solid #262626', color: '#666',
              padding: '12px 20px', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
              fontFamily: 'var(--font-body)', borderRadius: 8,
            }}>
              ← BACK
            </button>
          )}
          <button
            onClick={step === STEPS.length - 1 ? handleFinish : () => setStep(step + 1 as any)}
            disabled={loading}
            style={{
              flex: 1, background: loading ? '#1A2C5C' : '#0057FF', color: '#fff',
              border: 'none', padding: '13px 0', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase' as const,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)', borderRadius: 8,
            }}
          >
            {loading ? 'ACTIVATING...' : step === STEPS.length - 1 ? 'ACTIVATE WORKSPACE →' : 'CONTINUE →'}
          </button>
        </div>
      </div>
    </div>
  );
}
