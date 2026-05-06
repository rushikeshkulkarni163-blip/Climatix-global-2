"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe, BarChart3, FileText, Briefcase, Link2,
  Radio, TrendingUp, Settings, ChevronRight, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODULES = [
  {
    group: "INTELLIGENCE",
    items: [
      { icon: Globe, label: "Risk Terminal", href: "/terminal", badge: null },
      { icon: BarChart3, label: "Simulation Lab", href: "/terminal/simulation", badge: "LIVE" },
      { icon: Briefcase, label: "Investor Dashboard", href: "/terminal/investor", badge: null },
    ],
  },
  {
    group: "ANALYSIS",
    items: [
      { icon: Link2, label: "Supply Chain", href: "/terminal/supply-chain", badge: null },
      { icon: Radio, label: "Narrative Intel", href: "/terminal/narrative", badge: "NEW" },
      { icon: TrendingUp, label: "Climate Finance", href: "/terminal/finance", badge: null },
    ],
  },
  {
    group: "OUTPUT",
    items: [
      { icon: FileText, label: "Disclosure Studio", href: "/terminal/disclosure", badge: null },
      { icon: Settings, label: "API & Config", href: "/terminal/config", badge: null },
    ],
  },
];

export default function TerminalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] flex-shrink-0 bg-[#0A0A0A] border-r border-[#1A1A1A] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1A1A1A]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-[#0A1F44] flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-[#F97316]" />
          </div>
          <div className="leading-none">
            <div className="text-white text-xs font-bold tracking-tight">CLIMACTIX</div>
            <div className="text-[#3A3A3A] text-[8px] font-bold tracking-[0.18em] uppercase mt-0.5">
              TERMINAL
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-hide">
        {MODULES.map(({ group, items }) => (
          <div key={group} className="mb-4">
            <div className="px-5 py-1.5">
              <span className="text-[9px] font-bold text-[#2A2A2A] uppercase tracking-[0.2em]">
                {group}
              </span>
            </div>
            {items.map(({ icon: Icon, label, href, badge }) => {
              const active = pathname === href || (href !== "/terminal" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2.5 text-xs font-semibold transition-all duration-150 group relative",
                    active
                      ? "bg-[#111111] text-white border-r-2 border-[#F97316]"
                      : "text-[#5A5A5A] hover:bg-[#0F0F0F] hover:text-[#9CA3AF]"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 flex-shrink-0",
                      active ? "text-[#F97316]" : "text-[#3A3A3A] group-hover:text-[#6B7280]"
                    )}
                  />
                  <span className="flex-1 tracking-wide">{label}</span>
                  {badge && (
                    <span className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 tracking-widest",
                      badge === "LIVE"
                        ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20"
                        : "bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20"
                    )}>
                      {badge}
                    </span>
                  )}
                  {active && (
                    <ChevronRight className="w-3 h-3 text-[#F97316] absolute right-2" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* System status */}
      <div className="px-5 py-4 border-t border-[#1A1A1A]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-widest">
            All Systems Nominal
          </span>
        </div>
        <div className="space-y-1.5">
          {[
            { label: "Data Feeds", val: "12 ACTIVE" },
            { label: "Risk Engine", val: "RUNNING" },
            { label: "Last Sync", val: "2m ago" },
          ].map(({ label, val }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-[9px] text-[#2A2A2A] uppercase tracking-widest">{label}</span>
              <span className="text-[9px] font-bold text-[#4A4A4A]">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
