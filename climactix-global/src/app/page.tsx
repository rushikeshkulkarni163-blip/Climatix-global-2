"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, TrendingUp, Globe, BookOpen, CheckCircle2 } from "lucide-react";
import LiveTicker from "@/components/live/LiveTicker";
import LiveMetricsBar from "@/components/live/LiveMetricsBar";
import AlertBanner from "@/components/live/AlertBanner";

// ── Globe (client-only — Three.js needs the DOM) ──────────
const GlobeComponent = dynamic(
  () => import("@/components/ui/GlobeComponent"),
  { ssr: false, loading: () => <GlobeFallback /> }
);

function GlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-48 h-48 rounded-full border border-[#1F1F1F] animate-pulse bg-[#0A1F44]/20" />
    </div>
  );
}

const FEATURED_INSIGHTS = [
  {
    category: "Physical Risk",
    title: "Rising Temperatures Reshape Industrial Asset Valuation",
    desc: "Heat stress days above 35°C are projected to double by 2040, materially affecting productivity and insurance costs across manufacturing and energy sectors.",
    href: "/research",
  },
  {
    category: "Transition Risk",
    title: "Carbon Pricing at $200/tCO₂ by 2050: Who Bears the Burden?",
    desc: "Our scenario analysis maps the financial exposure of 12 sectors under four IPCC-aligned carbon price trajectories from $50 to $200 per tonne.",
    href: "/dashboard",
  },
  {
    category: "ESG Governance",
    title: "TCFD Disclosure Gap: 68% of Companies Still Unprepared",
    desc: "Our cross-sector assessment reveals the governance maturity gap separating climate leaders from laggards in TCFD and CSRD compliance.",
    href: "/risk-analysis",
  },
  {
    category: "Portfolio Screening",
    title: "Stranded Asset Risk: The $2.7T Question for Investors",
    desc: "As clean-energy transition accelerates, portfolio managers face mounting pressure to identify and exit high-carbon holdings before regulatory exposure compounds.",
    href: "/portfolio",
  },
];

const INDUSTRIES = [
  "Energy & Utilities", "Oil & Gas", "Financial Services",
  "Manufacturing", "Real Estate", "Agriculture & Food",
  "Transportation", "Mining & Metals", "Technology",
  "Water & Waste", "Healthcare", "Tourism",
];

const TOPICS = [
  "ESG", "Climate Risk", "Net Zero", "Carbon Markets",
  "AI + Climate", "TCFD", "CSRD", "Scenario Analysis",
  "Physical Risk", "Transition Risk", "Water Stress", "Biodiversity",
];

const CASE_STUDIES = [
  {
    tag: "Energy Sector",
    title: "TCFD-Aligned Physical Risk Assessment for a European Utility",
    desc: "Comprehensive heat stress and flood exposure analysis across 47 generation assets in 12 countries using Open-Meteo and NASA POWER data.",
    href: "/risk-analysis",
  },
  {
    tag: "Investor Due Diligence",
    title: "Portfolio Climate Screen: €2.8B Infrastructure Fund",
    desc: "Portfolio-weighted Paris Alignment scoring across 23 holdings, identifying €340M in potential stranded asset exposure under 2°C scenarios.",
    href: "/portfolio",
  },
  {
    tag: "Research",
    title: "Cross-Country Water Stress Correlation Study: 40 Nations, 20 Years",
    desc: "Time-series analysis of water withdrawal intensity vs. agricultural output across emerging markets using World Bank and UN SDG APIs.",
    href: "/research",
  },
];

// STATS block replaced by live LiveMetricsBar component

const TCFD_ITEMS = [
  "Physical Risk — Acute & Chronic",
  "Transition Risk — 4 Dimensions",
  "ESG Scoring — E/S/G Weighted",
  "Scenario Analysis — RCP 2.6–8.5",
  "Financial Materiality Assessment",
  "Net Zero Pathway Alignment",
  "TCFD/CSRD Disclosure Readiness",
  "UN SDG Indicator Mapping",
];

// ── Page ──────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="bg-black text-white">

      {/* ══ ALERT BANNER (live climate alerts) ═══════════════ */}
      <AlertBanner maxVisible={1} autoHide autoHideMs={10000} />

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section className="border-b border-[#1F1F1F] bg-black bg-grid">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[560px]">

            {/* Left — editorial copy */}
            <div className="py-20 lg:py-24 lg:pr-14 flex flex-col justify-center border-r border-[#1F1F1F]">
              <p className="terminal-label mb-4">
                TCFD-ALIGNED CLIMATE INTELLIGENCE
              </p>
              <h1 className="text-4xl lg:text-5xl xl:text-[3.25rem] font-bold text-white leading-[1.08] tracking-tight mb-6 text-balance">
                Climate Risk Intelligence<br />
                for a Changing World
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed mb-10 max-w-lg">
                TCFD-aligned analysis for industries, investors &amp; researchers.
                Physical risk scoring, transition risk assessment, ESG benchmarking,
                and professional PDF reports — powered by open climate APIs.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/risk-analysis" className="btn-terminal-primary">
                  Start Risk Assessment <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/dashboard" className="btn-terminal-secondary">
                  View Dashboard
                </Link>
              </div>
            </div>

            {/* Right — 3D Globe panel */}
            <div className="hidden lg:block relative bg-[#020812] overflow-hidden">
              {/* Globe fills the panel */}
              <div className="absolute inset-0">
                <GlobeComponent />
              </div>

              {/* Risk indicator bar */}
              <div className="absolute top-5 left-5 right-5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="terminal-label">
                  GLOBAL CLIMATE RISK — ACTIVE MONITORING
                </span>
              </div>

              {/* Stats overlay — bottom (live data) */}
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <LiveMetricsBar layout="hero" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ LIVE DATA TICKER (dynamic — API-driven) ══════════ */}
      <LiveTicker />

      {/* ══ THREE PILLAR CTAs ════════════════════════════════ */}
      <section className="border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1F1F1F]">
            {[
              {
                icon: TrendingUp,
                label: "Industry Analysis",
                sub: "5-step TCFD risk assessment wizard",
                desc: "Physical, transition, and ESG risk dimensions with scenario analysis across 12 sectors.",
                href: "/risk-analysis",
                cta: "Start Assessment",
              },
              {
                icon: Globe,
                label: "Portfolio Screening",
                sub: "Investor-grade climate due diligence",
                desc: "Screen holdings against 1.5°C pathways. Identify red-flag companies and stranded asset exposure.",
                href: "/portfolio",
                cta: "Screen Portfolio",
              },
              {
                icon: BookOpen,
                label: "Research Tools",
                sub: "Multi-country data explorer",
                desc: "Fetch and compare climate indicators across countries using NASA, World Bank, and UN SDG APIs.",
                href: "/research",
                cta: "Explore Data",
              },
            ].map(({ icon: Icon, label, sub, desc, href, cta }) => (
              <div key={label} className="group p-8 hover:bg-[#0A0A0A] transition-colors">
                <div className="w-8 h-8 border border-[#2A2A2A] flex items-center justify-center mb-5 group-hover:border-[#444444] transition-colors">
                  <Icon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                </div>
                <p className="terminal-label mb-2">{sub}</p>
                <h3 className="text-base font-bold text-white mb-3">{label}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-6">{desc}</p>
                <Link href={href} className="t-link">
                  {cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TOPIC STRIP ══════════════════════════════════════ */}
      <div className="border-b border-[#1F1F1F] bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="terminal-label flex-shrink-0 mr-1">Topics:</span>
            {TOPICS.map((t) => (
              <button key={t} className="topic-pill flex-shrink-0">{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ FEATURED INSIGHTS ════════════════════════════════ */}
      <section className="section-pad border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">

          {/* Header row */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="t-section-label">Featured Insights</p>
              <div className="w-8 border-t border-[#2A2A2A] mb-4" />
              <h2 className="text-2xl font-bold text-white">
                Climate Intelligence for Decision-Makers
              </h2>
            </div>
            <Link href="/research" className="t-link hidden md:flex">
              All Insights <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Editorial grid — featured left, 3 stacked right */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-px bg-[#1F1F1F]">

            {/* Featured large card */}
            <article className="lg:col-span-2 bg-black p-7 group hover:bg-[#0A0A0A] transition-colors">
              <p className="terminal-label-active mb-3">{FEATURED_INSIGHTS[0].category}</p>
              <h3 className="text-xl font-bold text-white mb-4 leading-tight group-hover:text-gray-100">
                {FEATURED_INSIGHTS[0].title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {FEATURED_INSIGHTS[0].desc}
              </p>
              <Link href={FEATURED_INSIGHTS[0].href} className="t-link">
                Read analysis <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </article>

            {/* 3 smaller cards stacked */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#1F1F1F]">
              {FEATURED_INSIGHTS.slice(1).map(({ category, title, desc, href }) => (
                <article key={title} className="bg-black p-6 group hover:bg-[#0A0A0A] transition-colors">
                  <p className="terminal-label mb-2">{category}</p>
                  <h3 className="text-sm font-bold text-white mb-3 leading-snug">
                    {title}
                  </h3>
                  <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-3">{desc}</p>
                  <Link href={href} className="t-link text-[11px]">
                    Read more <ArrowRight className="w-3 h-3" />
                  </Link>
                </article>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ══ INDUSTRIES ════════════════════════════════════════ */}
      <section className="section-pad bg-[#0A0A0A] border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">

          <div className="mb-8">
            <p className="t-section-label">Industries</p>
            <div className="w-8 border-t border-[#2A2A2A] mb-4" />
            <h2 className="text-2xl font-bold text-white">
              Sector-Specific Climate Risk Analysis
            </h2>
            <p className="text-gray-500 text-sm mt-2">
              IPCC AR6-aligned risk weights for 12 industry sectors, from energy to tourism.
            </p>
          </div>

          {/* Horizontal industry nav */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[#1F1F1F]">
            {INDUSTRIES.map((ind) => (
              <Link
                key={ind}
                href="/risk-analysis"
                className="bg-[#0A0A0A] px-4 py-5 text-xs font-semibold text-gray-400
                           hover:bg-[#111111] hover:text-white transition-colors text-center
                           border-b-2 border-transparent hover:border-[#1D4ED8] group"
              >
                {ind}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CASE STUDIES ══════════════════════════════════════ */}
      <section className="section-pad border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">

          <div className="mb-8">
            <p className="t-section-label">Client Impact</p>
            <div className="w-8 border-t border-[#2A2A2A] mb-4" />
            <h2 className="text-2xl font-bold text-white">Case Studies</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1F1F1F]">
            {CASE_STUDIES.map(({ tag, title, desc, href }) => (
              <div key={title} className="bg-black group hover:bg-[#0A0A0A] transition-colors">
                <div className="h-px bg-[#0A1F44] group-hover:bg-[#1D4ED8] transition-colors" />
                <div className="p-7">
                  <p className="terminal-label mb-3">{tag}</p>
                  <h3 className="text-base font-bold text-white mb-3 leading-snug">{title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed mb-6">{desc}</p>
                  <Link href={href} className="t-link">
                    Explore <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TCFD FRAMEWORK / RISK PANEL ══════════════════════ */}
      <section className="section-pad bg-[#020812] border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="border border-[#0F2D5E] p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left — copy */}
              <div>
                <p className="terminal-label mb-3">Framework Alignment</p>
                <div className="w-8 border-t border-[#1D4ED8] mb-5" />
                <h2 className="text-2xl font-bold text-white mb-5 leading-tight">
                  Built on the TCFD Framework
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                  Our scoring engine follows the Task Force on Climate-related Financial Disclosures
                  recommendations, aligned with IPCC AR6 scenario pathways and Paris Agreement targets.
                </p>
                <Link href="/risk-analysis" className="btn-terminal-primary">
                  Generate Disclosure Report <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Right — data panel checklist */}
              <div className="border border-[#1F1F1F] bg-black p-6">
                <p className="terminal-label mb-4">COVERAGE MATRIX</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TCFD_ITEMS.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 py-2 border-b border-[#111111]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-xs">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ══ REPORTS & DATA SOURCES ════════════════════════════ */}
      <section className="section-pad border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* Reports panel */}
            <div>
              <p className="t-section-label">Reports &amp; Downloads</p>
              <div className="w-8 border-t border-[#2A2A2A] mb-5" />
              <h2 className="text-xl font-bold text-white mb-6">
                Professional PDF Climate Disclosures
              </h2>
              <div className="space-y-px">
                {[
                  { label: "Executive Summary", desc: "2–3 page high-level overview" },
                  { label: "Technical Report",  desc: "Full 9-section TCFD disclosure" },
                  { label: "Investor Report",   desc: "Formatted for institutional disclosure" },
                ].map(({ label, desc }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2A2A2A] group transition-colors"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{label}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{desc}</div>
                    </div>
                    <Link href="/report" className="t-link">
                      Generate <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Data sources panel */}
            <div>
              <p className="t-section-label">Data Sources</p>
              <div className="w-8 border-t border-[#2A2A2A] mb-5" />
              <h2 className="text-xl font-bold text-white mb-6">
                10 Free APIs. Zero Paid Keys Required.
              </h2>
              <div className="grid grid-cols-2 gap-px bg-[#1F1F1F]">
                {[
                  { name: "Open-Meteo",     type: "Temperature & Weather" },
                  { name: "NASA POWER",     type: "Solar, Wind, Humidity" },
                  { name: "World Bank",     type: "Country Emissions" },
                  { name: "OpenAQ",         type: "Air Quality (PM2.5+)" },
                  { name: "ReliefWeb",      type: "Disaster Events" },
                  { name: "UN SDG API",     type: "Sustainability Goals" },
                  { name: "REST Countries", type: "Geographic Data" },
                  { name: "NOAA CDO",       type: "Climate Observations" },
                ].map(({ name, type }) => (
                  <div key={name} className="bg-[#0A0A0A] px-4 py-3 hover:bg-[#111111] transition-colors">
                    <div className="font-bold text-white text-xs">{name}</div>
                    <div className="text-gray-500 text-[10px] mt-0.5">{type}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ BOTTOM CTA ════════════════════════════════════════ */}
      <section className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">
              Ready to assess your climate risk?
            </h2>
            <p className="text-gray-500 text-sm">
              Complete the 5-step wizard and generate a TCFD-aligned PDF report in minutes.
            </p>
          </div>
          <Link href="/risk-analysis" className="btn-terminal-primary flex-shrink-0">
            Start Your Assessment <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </div>
  );
}
