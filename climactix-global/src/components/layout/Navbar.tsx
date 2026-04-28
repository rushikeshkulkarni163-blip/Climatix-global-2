"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Industries",
    href: "/portfolio",
    sub: ["Energy & Utilities", "Financial Services", "Manufacturing", "Real Estate", "Agriculture", "Technology"],
  },
  {
    label: "Solutions",
    href: "/risk-analysis",
    sub: ["Risk Assessment", "Portfolio Screening", "Scenario Analysis", "ESG Scoring", "PDF Reports"],
  },
  {
    label: "Insights",
    href: "/research",
    sub: ["Climate Data Explorer", "Country Analysis", "Time Series", "Anomaly Detection"],
  },
  {
    label: "Climate Intelligence",
    href: "/dashboard",
    sub: ["Risk Dashboard", "Temperature Trends", "Air Quality", "Disaster Events"],
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDrop, setOpenDrop] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-nav">
      {/* Top bar */}
      <div className="bg-brand-blue">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-8">
          <p className="text-white/70 text-2xs uppercase tracking-widest font-semibold">
            Climate Risk Intelligence Platform
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/70 text-2xs hover:text-white transition-colors uppercase tracking-wider">About</a>
            <a href="#" className="text-white/70 text-2xs hover:text-white transition-colors uppercase tracking-wider">Contact</a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <ClimactixLogo />
            <div className="leading-tight">
              <div className="font-bold text-brand-blue text-lg tracking-tight leading-none">CLIMACTIX</div>
              <div className="text-brand-blue-mid text-xs font-semibold tracking-widest uppercase leading-none">GLOBAL</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0">
            {NAV_ITEMS.map(({ label, href, sub }) => (
              <div
                key={label}
                className="relative group"
                onMouseEnter={() => setOpenDrop(label)}
                onMouseLeave={() => setOpenDrop(null)}
              >
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-1 px-4 py-5 text-sm font-semibold transition-colors border-b-2",
                    pathname.startsWith(href)
                      ? "text-brand-blue border-brand-blue"
                      : "text-gray-700 border-transparent hover:text-brand-blue hover:border-brand-blue"
                  )}
                >
                  {label}
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </Link>

                {/* Dropdown */}
                {openDrop === label && (
                  <div className="absolute top-full left-0 w-52 bg-white border border-gray-200 shadow-lg py-1 z-50">
                    {sub.map((item) => (
                      <Link
                        key={item}
                        href={href}
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-blue-tint hover:text-brand-blue transition-colors"
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
          <div className="hidden lg:flex items-center gap-3">
            <button aria-label="Search" className="p-2 text-gray-500 hover:text-brand-blue transition-colors">
              <Search className="w-4.5 h-4.5" />
            </button>
            <Link href="/risk-analysis" className="btn-primary py-2 px-5 text-xs">
              Get Report
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-gray-700 hover:text-brand-blue"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-6 py-3 text-sm font-semibold border-l-4 transition-colors",
                pathname.startsWith(href)
                  ? "border-brand-blue text-brand-blue bg-brand-blue-tint"
                  : "border-transparent text-gray-700 hover:border-brand-blue hover:text-brand-blue"
              )}
            >
              {label}
            </Link>
          ))}
          <div className="px-6 py-4 border-t border-gray-100">
            <Link href="/risk-analysis" className="btn-primary w-full justify-center text-xs">
              Get Report
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function ClimactixLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="flex-shrink-0">
      <rect width="36" height="36" fill="#00338D" />
      <circle cx="18" cy="18" r="10" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="5" fill="none" stroke="#4472C4" strokeWidth="1.5" />
      <path d="M8 18 Q14 14 18 18 Q22 22 28 18" stroke="white" strokeWidth="1" fill="none" />
      <path d="M18 8 Q14 14 18 18 Q22 22 18 28" stroke="white" strokeWidth="1" fill="none" />
      <path d="M10 27 Q14 22 18 18 Q22 14 26 10" stroke="#F4A261" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
