import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Climactix Global — Intelligence Platform',
  description: 'Institutional Climate Risk Intelligence — Access Portal',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    }}>
      {/* Top bar */}
      <nav style={{
        borderBottom: '1px solid #1a1a1a',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#FF6600', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em' }}>
            CLIMACTIX
          </span>
          <span style={{ color: '#333', fontSize: 11 }}>|</span>
          <span style={{ color: '#444', fontSize: 10, letterSpacing: '0.12em' }}>
            INTELLIGENCE PLATFORM
          </span>
        </div>
        <span style={{ color: '#333', fontSize: 10, letterSpacing: '0.08em' }}>
          INSTITUTIONAL ACCESS
        </span>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #1a1a1a',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#333', fontSize: 10, letterSpacing: '0.08em' }}>
          © {new Date().getFullYear()} CLIMACTIX GLOBAL. ALL RIGHTS RESERVED.
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy Policy', 'Terms', 'Security', 'Support'].map((link) => (
            <a key={link} href="#" style={{ color: '#444', fontSize: 10, letterSpacing: '0.06em', textDecoration: 'none' }}>
              {link.toUpperCase()}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
