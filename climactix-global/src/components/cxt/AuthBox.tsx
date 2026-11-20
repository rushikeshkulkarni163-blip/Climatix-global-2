"use client";

export default function AuthBox({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="cx-auth">
      <div className="box">
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Climactix Global" />
          <div><b style={{ fontFamily: "var(--font-heading)" }}>Climactix Terminal</b><div className="small muted">Corporate sustainability intelligence</div></div>
        </div>
        <div><h2>{title}</h2>{sub && <p className="t2" style={{ marginTop: 4 }}>{sub}</p>}</div>
        {children}
      </div>
    </div>
  );
}
