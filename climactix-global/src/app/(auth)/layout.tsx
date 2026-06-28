import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Climactix Global — Intelligence Platform',
  description: 'Institutional Climate Risk Intelligence — Access Portal',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="v3-page" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <nav style={{
        borderBottom: '1px solid #1A1A1A',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Climactix Global" style={{ height: 44, width: 'auto' }} />
        </a>
        <span style={{ color: '#444', fontSize: 10, letterSpacing: '0.08em' }}>
          INSTITUTIONAL ACCESS
        </span>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #1A1A1A',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#444', fontSize: 10, letterSpacing: '0.08em' }}>
          © {new Date().getFullYear()} CLIMACTIX GLOBAL. ALL RIGHTS RESERVED.
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy Policy', 'Terms', 'Security', 'Support'].map((link) => (
            <a key={link} href="#" style={{ color: '#666', fontSize: 10, letterSpacing: '0.06em', textDecoration: 'none' }}>
              {link.toUpperCase()}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
