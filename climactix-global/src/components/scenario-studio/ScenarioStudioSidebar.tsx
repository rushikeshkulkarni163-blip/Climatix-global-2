"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  Building2,
  Factory,
  Globe2,
  Cpu,
  Share2,
  Flame,
  TrendingDown,
  Coins,
  Landmark,
  ShieldAlert,
  FileBarChart,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

export const SCENARIO_STUDIO_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/scenario-studio" },
  { icon: FlaskConical, label: "Scenario Studio", href: "/scenario-studio/studio" },
  { icon: Building2, label: "Company Workspace", href: "/scenario-studio/companies" },
  { icon: Factory, label: "Asset Explorer", href: "/scenario-studio/assets" },
  { icon: Globe2, label: "GIS Viewer", href: "/scenario-studio/gis" },
  { icon: Cpu, label: "Risk Engine", href: "/scenario-studio/risk-engine" },
  { icon: Share2, label: "Supply Chain", href: "/scenario-studio/supply-chain" },
  { icon: Flame, label: "Physical Risk", href: "/scenario-studio/physical-risk" },
  { icon: TrendingDown, label: "Transition Risk", href: "/scenario-studio/transition-risk" },
  { icon: Coins, label: "Carbon Pricing", href: "/scenario-studio/carbon-pricing" },
  { icon: Landmark, label: "Financial Impact", href: "/scenario-studio/financial-impact" },
  { icon: ShieldAlert, label: "Climate VaR", href: "/scenario-studio/climate-var" },
  { icon: FileBarChart, label: "Reports", href: "/scenario-studio/reports" },
  { icon: Settings, label: "Settings", href: "/scenario-studio/settings" },
];

export default function ScenarioStudioSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[240px] flex-shrink-0 flex-col border-r border-ds-border bg-white lg:flex">
      <div className="flex items-center gap-2 border-b border-ds-border px-3 py-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Climactix Global" className="h-7 w-auto flex-shrink-0" />
        <span className="font-ds-heading text-[11px] font-bold uppercase tracking-widest text-ds-muted">
          Scenario Studio
        </span>
      </div>

      <nav aria-label="Scenario Studio" className="flex-1 overflow-y-auto p-2">
        {SCENARIO_STUDIO_NAV.map(({ icon: Icon, label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 font-ds-body text-[14px] font-medium",
                "transition-colors duration-150 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent",
                active ? "bg-ds-accent-bg text-ds-accent" : "text-ds-text2 hover:bg-ds-surface hover:text-ds-text"
              )}
            >
              <Icon size={17} className="flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
