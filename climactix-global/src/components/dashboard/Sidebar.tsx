"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  ShieldAlert,
  FlaskConical,
  Share2,
  Globe2,
  SatelliteDish,
  Factory,
  FileText,
  FileBarChart,
  Landmark,
  Bell,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store";

export interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Briefcase, label: "Portfolio", href: "/portfolio" },
  { icon: Building2, label: "Companies", href: "/dashboard/companies" },
  { icon: ShieldAlert, label: "Risk Monitor", href: "/dashboard#risk-matrix" },
  { icon: FlaskConical, label: "Scenario Analysis", href: "/dashboard#scenario" },
  { icon: Share2, label: "Supply Chain", href: "/dashboard#supply-chain" },
  { icon: Globe2, label: "Climate Intelligence", href: "/dashboard#map" },
  { icon: SatelliteDish, label: "Satellite Analytics", href: "/dashboard/satellite-analytics" },
  { icon: Factory, label: "Carbon Exposure", href: "/dashboard/carbon-exposure" },
  { icon: FileText, label: "Disclosure", href: "/dashboard/disclosure" },
  { icon: FileBarChart, label: "Reports", href: "/report" },
  { icon: Landmark, label: "Regulations", href: "/dashboard/regulations" },
  { icon: Bell, label: "Alerts", href: "/dashboard/alerts" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5 p-2">
      {DASHBOARD_NAV_ITEMS.map(({ icon: Icon, label, href }) => {
        const basePath = href.split("#")[0];
        const active = pathname === basePath;
        return (
          <Link
            key={label}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 font-ds-body text-[14px] font-medium",
              "transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent",
              active
                ? "bg-ds-accent-bg text-ds-accent"
                : "text-ds-text2 hover:bg-ds-surface hover:text-ds-text"
            )}
          >
            <Icon size={17} className="flex-shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const collapsed = useDashboardStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDashboardStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "hidden xl:flex flex-shrink-0 flex-col border-r border-ds-border bg-white transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <div className="flex items-center gap-2 border-b border-ds-border px-3 py-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Climactix Global" className="h-7 w-auto flex-shrink-0" />
        {!collapsed && (
          <span className="font-ds-heading text-[11px] font-bold uppercase tracking-widest text-ds-muted">
            Dashboard
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />
      </div>

      <button
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center justify-center gap-2 border-t border-ds-border py-3 text-ds-muted transition-colors duration-150 hover:bg-ds-surface hover:text-ds-text"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
    </aside>
  );
}
