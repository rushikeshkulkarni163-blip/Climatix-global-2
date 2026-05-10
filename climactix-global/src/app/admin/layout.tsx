import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Climactix Global",
  robots: "noindex, nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Admin topbar */}
      <div className="bg-[#0A1F44] border-b border-[#1F1F1F] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-white/10 px-2 py-1">
            ADMIN
          </span>
          <span className="text-sm font-bold text-white">Climactix Global — Control Panel</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[9px] text-gray-400 uppercase tracking-wider">
            Content Management System
          </span>
          <a
            href="/"
            className="text-[9px] text-gray-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            ← Back to Site
          </a>
        </div>
      </div>

      {/* Admin sidebar + content */}
      <div className="flex min-h-[calc(100vh-49px)]">
        {/* Sidebar nav */}
        <nav className="w-52 flex-shrink-0 border-r border-[#1F1F1F] bg-[#0A0A0A] py-6">
          <div className="px-5 mb-6">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Navigation</p>
          </div>
          {ADMIN_NAV.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 px-5 py-3 text-xs text-gray-400 hover:text-white hover:bg-[#111] transition-colors"
            >
              <span>{icon}</span>
              <span>{label}</span>
            </a>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: "◈" },
  { href: "/admin/ticker", label: "Live Ticker", icon: "↻" },
  { href: "/admin/insights", label: "Insights", icon: "◉" },
  { href: "/admin/case-studies", label: "Case Studies", icon: "◎" },
  { href: "/admin/reports", label: "Reports", icon: "◧" },
  { href: "/admin/alerts", label: "Climate Alerts", icon: "⚠" },
  { href: "/admin/users", label: "Users", icon: "◎" },
  { href: "/admin/settings", label: "Settings", icon: "◈" },
];
