"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, Globe, BookOpen, CheckCircle2 } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  "Global Avg Temp Anomaly: +1.48°C",
  "Arctic Sea Ice Loss: -13%/decade",
  "CO₂ Concentration: 423 ppm",
  "Sea Level Rise: +3.7mm/yr",
  "Extreme Weather Events: +5× since 1970",
  "Global Carbon Budget Remaining: ~380 GtCO₂",
  "Renewable Energy Share: 30.3% global",
  "Climate Finance Gap: $4.3T/year needed",
];

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

const STATS = [
  { value: "10+", label: "Free APIs Integrated" },
  { value: "12", label: "Industry Sectors" },
  { value: "40+", label: "Climate Indicators" },
  { value: "9", label: "Report Sections" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="bg-white">

      {/* ── HERO ── */}
      <section className="bg-brand-blue">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[520px]">
            {/* Left */}
            <div className="py-20 lg:py-28 lg:pr-16 flex flex-col justify-center">
              <p className="section-label text-blue-300 mb-3">
                TCFD-ALIGNED CLIMATE INTELLIGENCE
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 text-balance">
                Climate Risk Intelligence<br />
                for a Changing World
              </h1>
              <p className="text-blue-200 text-lg leading-relaxed mb-10 max-w-xl">
                TCFD-aligned analysis for industries, investors &amp; researchers.
                Physical risk scoring, transition risk assessment, ESG benchmarking,
                and professional PDF reports — powered by open climate APIs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/risk-analysis" className="btn-primary bg-white text-brand-blue hover:bg-blue-50 border-white">
                  Start Risk Assessment <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/dashboard" className="btn-secondary border-white/50 text-white hover:bg-white/10">
                  View Dashboard
                </Link>
              </div>
            </div>

            {/* Right — visual panel */}
            <div className="hidden lg:flex flex-col justify-end bg-brand-blue-dark relative overflow-hidden">
              {/* Abstract grid lines */}
              <div className="absolute inset-0 opacity-10">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="absolute border-t border-white w-full" style={{ top: `${i * 14}%` }} />
                ))}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="absolute border-l border-white h-full" style={{ left: `${i * 20}%` }} />
                ))}
              </div>

              {/* Stats overlay */}
              <div className="relative z-10 p-12 grid grid-cols-2 gap-4">
                {STATS.map(({ value, label }) => (
                  <div key={label} className="bg-white/10 border border-white/20 p-5">
                    <div className="text-3xl font-bold text-white mb-1">{value}</div>
                    <div className="text-blue-300 text-xs uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>

              {/* Bottom accent */}
              <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-white to-transparent opacity-20" />
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE DATA TICKER ── */}
      <div className="bg-brand-blue-dark border-b border-brand-blue">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-brand-blue-mid px-5 py-2.5">
            <span className="text-white text-2xs font-bold uppercase tracking-widest">Live Data</span>
          </div>
          <div className="ticker-wrap flex-1 py-2.5 overflow-hidden">
            <div className="ticker-content flex gap-12">
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                <span key={i} className="text-blue-200 text-xs font-medium">
                  <span className="text-blue-400 mr-2">•</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── THREE PILLAR CTAs ── */}
      <section className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
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
              <div key={label} className="group p-10 hover:bg-brand-blue-tint transition-colors">
                <div className="w-10 h-10 bg-brand-blue flex items-center justify-center mb-5 group-hover:bg-brand-blue-dark transition-colors">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xs font-bold uppercase tracking-widest text-brand-blue-mid mb-2">{sub}</p>
                <h3 className="text-xl font-bold text-brand-blue mb-3">{label}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{desc}</p>
                <Link href={href} className="btn-ghost text-brand-blue text-sm font-bold">
                  {cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOPIC STRIP ── */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <span className="text-2xs font-bold uppercase tracking-widest text-gray-400 flex-shrink-0">Topics:</span>
            {TOPICS.map((t) => (
              <button key={t} className="topic-pill flex-shrink-0 text-xs">{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURED INSIGHTS ── */}
      <section className="section-pad border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="section-label">Featured Insights</p>
              <div className="rule-blue" />
              <h2 className="text-3xl font-bold text-brand-blue">
                Climate Intelligence for Decision-Makers
              </h2>
            </div>
            <Link href="/research" className="btn-ghost hidden md:flex">
              All Insights <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200">
            {FEATURED_INSIGHTS.map(({ category, title, desc, href }) => (
              <article key={title} className="bg-white p-6 group hover:bg-brand-blue-tint transition-colors">
                <p className="text-2xs font-bold uppercase tracking-widest text-brand-blue-mid mb-3">
                  {category}
                </p>
                <h3 className="text-base font-bold text-brand-blue mb-3 leading-snug group-hover:underline underline-offset-2">
                  {title}
                </h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-3">{desc}</p>
                <Link href={href} className="text-brand-blue text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all">
                  Read more <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ── */}
      <section className="section-pad bg-brand-blue-tint border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-10">
            <p className="section-label">Industries</p>
            <div className="rule-blue" />
            <h2 className="text-3xl font-bold text-brand-blue">
              Sector-Specific Climate Risk Analysis
            </h2>
            <p className="section-subtitle text-gray-500 mt-3">
              IPCC AR6-aligned risk weights for 12 industry sectors, from energy to tourism.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-300">
            {INDUSTRIES.map((ind) => (
              <Link
                key={ind}
                href="/risk-analysis"
                className="bg-white px-5 py-6 text-sm font-semibold text-brand-blue
                           hover:bg-brand-blue hover:text-white transition-colors text-center
                           border-b-2 border-transparent hover:border-brand-blue-mid"
              >
                {ind}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CASE STUDIES ── */}
      <section className="section-pad border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-10">
            <p className="section-label">Client Impact</p>
            <div className="rule-blue" />
            <h2 className="text-3xl font-bold text-brand-blue">Case Studies</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CASE_STUDIES.map(({ tag, title, desc, href }) => (
              <div key={title} className="border border-gray-200 group hover:border-brand-blue-mid hover:shadow-card-hover transition-all">
                {/* Blue top accent */}
                <div className="h-1 bg-brand-blue" />
                <div className="p-7">
                  <p className="text-2xs font-bold uppercase tracking-widest text-brand-blue-mid mb-3">{tag}</p>
                  <h3 className="text-lg font-bold text-brand-blue mb-3 leading-snug">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">{desc}</p>
                  <Link href={href} className="btn-ghost text-brand-blue text-xs font-bold">
                    Explore <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TCFD FRAMEWORK BAND ── */}
      <section className="bg-brand-blue section-pad">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-blue-300 text-2xs font-bold uppercase tracking-widest mb-3">
                Framework Alignment
              </p>
              <div className="w-12 border-t-2 border-blue-400 mb-5" />
              <h2 className="text-3xl font-bold text-white mb-5 leading-tight">
                Built on the TCFD Framework
              </h2>
              <p className="text-blue-200 text-base leading-relaxed mb-8">
                Our scoring engine follows the Task Force on Climate-related Financial Disclosures
                recommendations, aligned with IPCC AR6 scenario pathways and Paris Agreement targets.
              </p>
              <Link href="/risk-analysis" className="btn-primary bg-white text-brand-blue hover:bg-blue-50">
                Generate Disclosure Report <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                "Physical Risk — Acute & Chronic",
                "Transition Risk — 4 Dimensions",
                "ESG Scoring — E/S/G Weighted",
                "Scenario Analysis — RCP 2.6–8.5",
                "Financial Materiality Assessment",
                "Net Zero Pathway Alignment",
                "TCFD/CSRD Disclosure Readiness",
                "UN SDG Indicator Mapping",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
                  <span className="text-blue-200 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── REPORTS & DATA SOURCES ── */}
      <section className="section-pad border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Reports */}
            <div>
              <p className="section-label">Reports & Downloads</p>
              <div className="rule-blue" />
              <h2 className="text-2xl font-bold text-brand-blue mb-6">
                Professional PDF Climate Disclosures
              </h2>
              <div className="space-y-3">
                {[
                  { label: "Executive Summary", desc: "2–3 page high-level overview" },
                  { label: "Technical Report", desc: "Full 9-section TCFD disclosure" },
                  { label: "Investor Report", desc: "Formatted for institutional disclosure" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-center justify-between p-4 border border-gray-200 hover:border-brand-blue group transition-colors">
                    <div>
                      <div className="font-bold text-brand-blue text-sm">{label}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{desc}</div>
                    </div>
                    <Link href="/report" className="text-brand-blue text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Generate <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Data sources */}
            <div>
              <p className="section-label">Data Sources</p>
              <div className="rule-blue" />
              <h2 className="text-2xl font-bold text-brand-blue mb-6">
                10 Free APIs. Zero Paid Keys Required.
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Open-Meteo", type: "Temperature & Weather" },
                  { name: "NASA POWER", type: "Solar, Wind, Humidity" },
                  { name: "World Bank", type: "Country Emissions" },
                  { name: "OpenAQ", type: "Air Quality (PM2.5+)" },
                  { name: "ReliefWeb", type: "Disaster Events" },
                  { name: "UN SDG API", type: "Sustainability Goals" },
                  { name: "REST Countries", type: "Geographic Data" },
                  { name: "NOAA CDO", type: "Climate Observations" },
                ].map(({ name, type }) => (
                  <div key={name} className="bg-gray-50 border border-gray-200 px-4 py-3">
                    <div className="font-bold text-brand-blue text-sm">{name}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{type}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-brand-blue mb-2">
              Ready to assess your climate risk?
            </h2>
            <p className="text-gray-500 text-sm">
              Complete the 5-step wizard and generate a TCFD-aligned PDF report in minutes.
            </p>
          </div>
          <Link href="/risk-analysis" className="btn-primary flex-shrink-0">
            Start Your Assessment <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </div>
  );
}
