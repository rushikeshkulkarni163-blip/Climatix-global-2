"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Markets",
    href: "/dashboard",
    sub: ["Risk Dashboard", "Temperature Trends", "Air Quality", "Disaster Events", "Scenario Analysis"],
  },
  {
    label: "Climate Risk",
    href: "/risk-analysis",
    sub: ["Physical Risk", "Transition Risk", "ESG Scoring", "TCFD Assessment", "5-Step Risk Wizard"],
  },
  {
    label: "Industries",
    href: "/portfolio",
    sub: ["Energy & Utilities", "Financial Services", "Manufacturing", "Real Estate", "Agriculture", "Technology"],
  },
  {
    label: "Intelligence",
    href: "/research",
    sub: ["Climate Data Explorer", "Country Analysis", "Time Series", "Anomaly Detection"],
  },
  {
    label: "Reports",
    href: "/report",
    sub: ["Executive Summary", "Technical Report", "Investor Report", "TCFD Disclosure", "PDF Generation"],
  },
  {
    label: "Technology",
    href: "/",
    sub: ["Open Climate APIs", "NASA POWER", "World Bank Data", "OpenAQ", "UN SDG API"],
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDrop, setOpenDrop] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-[#1F1F1F]">
      {/* ── Main nav bar ── */}
      <nav>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-11">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <ClimactixLogo />
            <div className="leading-none">
              <div className="font-bold text-white text-sm tracking-tight leading-none">CLIMACTIX</div>
              <div className="text-[#4B5563] text-[9px] font-bold tracking-[0.18em] uppercase leading-none mt-0.5">
                GLOBAL
              </div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center">
            {NAV_ITEMS.map(({ label, href, sub }) => (
              <div
                key={label}
                className="relative"
                onMouseEnter={() => setOpenDrop(label)}
                onMouseLeave={() => setOpenDrop(null)}
              >
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-1 px-4 h-11 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2",
                    pathname === href || pathname.startsWith(href + "/")
                      ? "text-white border-white"
                      : "text-[#9CA3AF] border-transparent hover:text-white hover:border-[#333333]"
                  )}
                >
                  {label}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Link>

                {/* Dropdown */}
                {openDrop === label && (
                  <div className="absolute top-full left-0 w-52 bg-[#0D0D0D] border border-[#1F1F1F] py-1 z-50 shadow-2xl">
                    {sub.map((item) => (
                      <Link
                        key={item}
                        href={href}
                        className="block px-4 py-2 text-xs text-[#9CA3AF] hover:bg-[#161616] hover:text-white transition-colors"
                      >
                        {item}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              aria-label="Search"
              className="p-2 text-[#6B7280] hover:text-white transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
            <Link
              href="/dashboard"
              className="px-4 h-11 flex items-center text-xs font-semibold text-[#9CA3AF] hover:text-white transition-colors tracking-wider uppercase"
            >
              Log In
            </Link>
            <Link
              href="/risk-analysis"
              className="ml-1 px-4 py-1.5 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors active:scale-[0.98]"
            >
              Run Analysis
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-[#9CA3AF] hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#1F1F1F] bg-[#0A0A0A]">
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-6 py-3 text-xs font-bold uppercase tracking-widest border-l-2 transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "border-white text-white bg-[#111111]"
                  : "border-transparent text-[#9CA3AF] hover:border-white/30 hover:text-white"
              )}
            >
              {label}
            </Link>
          ))}
          <div className="px-6 py-4 border-t border-[#1F1F1F]">
            <Link
              href="/risk-analysis"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center bg-white text-black py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors"
            >
              Run Analysis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function ClimactixLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 36 36" fill="none" className="flex-shrink-0">
      <rect width="36" height="36" fill="#0A1F44" />
      <circle cx="18" cy="18" r="10" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="5" fill="none" stroke="#4472C4" strokeWidth="1.5" />
      <path d="M8 18 Q14 14 18 18 Q22 22 28 18" stroke="white" strokeWidth="1" fill="none" />
      <path d="M18 8 Q14 14 18 18 Q22 22 18 28" stroke="white" strokeWidth="1" fill="none" />
      <path d="M10 27 Q14 22 18 18 Q22 14 26 10" stroke="#F97316" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
