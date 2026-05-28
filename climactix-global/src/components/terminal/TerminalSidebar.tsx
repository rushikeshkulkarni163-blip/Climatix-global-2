"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CloudLightning, Thermometer, ArrowLeftRight,
  Package, Fingerprint, BookOpen, FlaskConical, FileBarChart,
  Building2, Waves, Landmark, TerminalSquare, ChevronRight,
  AlertTriangle, Radio
} from "lucide-react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: "LIVE" | "NEW" | "BETA" | null;
  critical?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const MODULES: NavGroup[] = [
  {
    group: "COMMAND",
    items: [
      { icon: LayoutDashboard,  label: "Dashboard",            href: "/dashboard",            badge: "LIVE" },
      { icon: CloudLightning,   label: "Climate Risk",         href: "/terminal",             badge: null },
      { icon: Thermometer,      label: "Physical Exposure",    href: "/terminal/simulation",  badge: null },
      { icon: ArrowLeftRight,   label: "Transition Risk",      href: "/terminal/finance",     badge: null },
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      { icon: Fingerprint,      label: "Climate Identity",     href: "/climate-identity",     badge: "NEW" },
      { icon: Package,          label: "Supply Chain",         href: "/terminal/supply-chain",badge: null },
      { icon: BookOpen,         label: "Regulatory Intel",     href: "/terminal/narrative",   badge: null },
      { icon: FlaskConical,     label: "Scenario Engine",      href: "/terminal/simulation",  badge: null },
    ],
  },
  {
    group: "ANALYTICS",
    items: [
      { icon: FileBarChart,     label: "Reports",              href: "/report",               badge: null },
      { icon: Radio,            label: "Investor Terminal",    href: "/terminal/investor",    badge: null },
      { icon: AlertTriangle,    label: "Risk Propagation",     href: "/risk-propagation",     badge: "BETA" },
    ],
  },
  {
    group: "INFRASTRUCTURE",
    items: [
      { icon: Building2,        label: "Smart City Systems",   href: "/infrastructure/smart-city",  badge: null },
      { icon: Waves,            label: "Industrial Zones",     href: "/infrastructure/industrial",  badge: null },
      { icon: Landmark,         label: "Banking Intelligence", href: "/infrastructure/banking",      badge: null },
    ],
  },
  {
    group: "ADMIN",
    items: [
      { icon: TerminalSquare,   label: "Admin Command",        href: "/admin",                badge: null },
    ],
  },
];

const DOT_COLORS: Record<string, string> = {
  LIVE:  "#63C982",
  NEW:   "#4DA3FF",
  BETA:  "#D8913F",
};

export default function TerminalSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#0F1722] border-r border-[#1E2C3D]">
      {/* ── Logo ─────────────────────────────────── */}
      <div className="px-4 py-3.5 border-b border-[#1E2C3D]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center border border-[#253649]"
            style={{ background: "rgba(77,163,255,0.1)" }}
          >
            {/* CX monogram */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                fontWeight: 700,
                color: "#4DA3FF",
                letterSpacing: "0.05em",
              }}
            >
              CX
            </span>
          </div>
          <div className="leading-none">
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 700,
                color: "#DDE7F2",
                letterSpacing: "0.06em",
              }}
            >
              CLIMACTIX
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "7px",
                fontWeight: 600,
                color: "#3D506A",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              INTELLIGENCE OS
            </div>
          </div>
        </Link>
      </div>

      {/* ── Scenario context strip ────────────────── */}
      <div className="px-4 py-2 border-b border-[#1E2C3D] bg-[#0C1220]">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          ACTIVE SCENARIO
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#4DA3FF", fontWeight: 600, marginTop: "2px" }}>
          NGFS 2.0°C Orderly
        </div>
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <nav className="flex-1 py-2 overflow-y-auto scrollbar-hide">
        {MODULES.map(({ group, items }) => (
          <div key={group} className="mb-1">
            {/* Group Label */}
            <div
              className="px-4 py-1.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                fontWeight: 700,
                color: "#3D506A",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              {group}
            </div>

            {items.map(({ icon: Icon, label, href, badge }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-4 py-2 relative transition-all"
                  style={{
                    background:   active ? "#152235" : "transparent",
                    borderRight:  active ? "2px solid #4DA3FF" : "2px solid transparent",
                    color:        active ? "#DDE7F2" : "#62758C",
                    fontSize:     "11px",
                    fontWeight:   active ? 600 : 500,
                    letterSpacing:"0.01em",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "#111C2B";
                      (e.currentTarget as HTMLElement).style.color = "#8CA3BA";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "#62758C";
                    }
                  }}
                >
                  <Icon
                    size={13}
                    style={{ color: active ? "#4DA3FF" : "#3D506A", flexShrink: 0 }}
                  />
                  <span className="flex-1 truncate">{label}</span>

                  {badge && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "7px",
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        padding: "1px 5px",
                        border: `1px solid ${DOT_COLORS[badge]}33`,
                        color: DOT_COLORS[badge],
                        background: `${DOT_COLORS[badge]}11`,
                        flexShrink: 0,
                      }}
                    >
                      {badge}
                    </span>
                  )}

                  {active && (
                    <ChevronRight
                      size={10}
                      style={{ color: "#4DA3FF", flexShrink: 0 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── System Status ─────────────────────────── */}
      <div className="px-4 py-3 border-t border-[#1E2C3D]">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#63C982", animation: "pulse-dot 2s ease-in-out infinite" }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#63C982",
            }}
          >
            All Systems Nominal
          </span>
        </div>
        {[
          { label: "Data Feeds",  val: "14 Active" },
          { label: "Risk Models", val: "Running"   },
          { label: "Last Sync",   val: "12s ago"   },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between items-center mb-1">
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "#3D506A",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                fontWeight: 600,
                color: "#62758C",
              }}
            >
              {val}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
