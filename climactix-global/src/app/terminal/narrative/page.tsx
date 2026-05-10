"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Radio, ExternalLink, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import DataPanel from "@/components/terminal/DataPanel";
import MetricCard from "@/components/terminal/MetricCard";

// ── Static reference data (monthly sentiment distribution — NLP pipeline output) ──

const ESG_SENTIMENT_SERIES = [
  { date: "Jan", positive: 42, negative: 28, neutral: 30 },
  { date: "Feb", positive: 48, negative: 24, neutral: 28 },
  { date: "Mar", positive: 38, negative: 36, neutral: 26 },
  { date: "Apr", positive: 52, negative: 22, neutral: 26 },
  { date: "May", positive: 45, negative: 30, neutral: 25 },
  { date: "Jun", positive: 58, negative: 18, neutral: 24 },
  { date: "Jul", positive: 44, negative: 32, neutral: 24 },
  { date: "Aug", positive: 61, negative: 16, neutral: 23 },
  { date: "Sep", positive: 39, negative: 38, neutral: 23 },
  { date: "Oct", positive: 54, negative: 24, neutral: 22 },
];

// Fetched live from intelligence engine narrative API
interface TopicPulseItem {
  topic: string;
  mentions_7d: number;
  sentiment: number;
  trend: "up" | "down" | "flat";
}

interface RegulatoryEvent {
  region: string;
  regulation: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effective: string;
  status?: string;
}

const FALLBACK_TOPIC_PULSE: TopicPulseItem[] = [
  { topic: "Net Zero",        mentions_7d: 2840, sentiment: 0.42,  trend: "up"   },
  { topic: "CSRD",            mentions_7d: 1920, sentiment: 0.28,  trend: "up"   },
  { topic: "Carbon Markets",  mentions_7d: 1640, sentiment: 0.18,  trend: "flat" },
  { topic: "Greenwashing",    mentions_7d: 1380, sentiment: -0.48, trend: "up"   },
  { topic: "ESG Backlash",    mentions_7d: 1210, sentiment: -0.62, trend: "up"   },
  { topic: "Clean Energy",    mentions_7d: 1100, sentiment: 0.71,  trend: "up"   },
  { topic: "Carbon Tax",      mentions_7d: 980,  sentiment: -0.24, trend: "down" },
  { topic: "SBTi",            mentions_7d: 840,  sentiment: 0.54,  trend: "flat" },
  { topic: "Biodiversity",    mentions_7d: 720,  sentiment: 0.32,  trend: "up"   },
  { topic: "Climate Litigation", mentions_7d: 690, sentiment: -0.55, trend: "up" },
];

const FALLBACK_REGULATORY: RegulatoryEvent[] = [
  { region: "EU",    regulation: "CSRD Phase 2 Expansion",      impact: "HIGH",   effective: "2026-01", status: "Enacted" },
  { region: "US",    regulation: "SEC Climate Disclosure Rule",  impact: "HIGH",   effective: "2026-06", status: "Litigation" },
  { region: "UK",    regulation: "IFRS S1/S2 Mandatory Adoption",impact: "MEDIUM", effective: "2025-12", status: "Consultation" },
  { region: "IN",    regulation: "BRSR Core Mandatory",          impact: "MEDIUM", effective: "2026-04", status: "Enacted" },
  { region: "AU",    regulation: "Treasury Climate Disclosure",  impact: "HIGH",   effective: "2026-07", status: "Enacted" },
  { region: "CN",    regulation: "GHG Emission Registry Phase 3",impact: "HIGH",   effective: "2025-12", status: "Enacted" },
];

const NEWS_FEED = [
  {
    id: 1,
    source: "Financial Times",
    headline: "BlackRock Expands Climate Risk Factor to Entire Equity Universe",
    summary: "The world's largest asset manager announces integration of NGFS scenario data into all equity valuations, affecting $9.4T AUM.",
    tags: ["Investor Risk", "NGFS", "Portfolio"],
    sentiment: 0.62,
    time: "2h ago",
    url: "#",
  },
  {
    id: 2,
    source: "Reuters",
    headline: "EU Carbon Price Hits 5-Year High at €72.40 After Emissions Surge",
    summary: "European carbon allowances surged to their highest level since Q1 2022 as industrial output rebounds and energy transition costs climb.",
    tags: ["Carbon Markets", "EU-ETS", "Transition Risk"],
    sentiment: -0.28,
    time: "4h ago",
    url: "#",
  },
  {
    id: 3,
    source: "Bloomberg",
    headline: "Shell Faces Greenwashing Legal Challenge Over Net Zero Claims",
    summary: "NGO coalition files complaint citing lack of Scope 3 reduction pathway in Shell's 2024 sustainability report. SBTi validation cited as insufficient.",
    tags: ["Greenwashing", "Legal Risk", "Oil & Gas"],
    sentiment: -0.74,
    time: "6h ago",
    url: "#",
  },
  {
    id: 4,
    source: "The Guardian",
    headline: "IPCC: Only 6 Countries on 1.5°C-Consistent Pathways",
    summary: "Latest IPCC rapid assessment finds the vast majority of G20 economies remain misaligned with Paris Agreement temperature targets.",
    tags: ["Physical Risk", "IPCC", "Policy"],
    sentiment: -0.81,
    time: "8h ago",
    url: "#",
  },
  {
    id: 5,
    source: "S&P Global",
    headline: "Green Bond Market on Track for Record $650B Issuance in 2025",
    summary: "Sustainable debt issuance surges as institutional mandates tighten and sovereign green bond programs expand in 18 new jurisdictions.",
    tags: ["Green Finance", "Bonds", "Capital Markets"],
    sentiment: 0.78,
    time: "12h ago",
    url: "#",
  },
  {
    id: 6,
    source: "ESG Investor",
    headline: "SEC Climate Rule Faces Court Setback — Implementation Delayed",
    summary: "Federal appeals court grants stay on SEC mandatory climate disclosure rule, creating regulatory uncertainty for US-listed companies.",
    tags: ["Regulatory", "Disclosure", "US Policy"],
    sentiment: -0.45,
    time: "1d ago",
    url: "#",
  },
];

const COMPANY_COVERAGE = [
  { company: "Tesla", sector: "EV", mentions: 1840, esgSentiment: 0.54, riskSignal: "POSITIVE" },
  { company: "ExxonMobil", sector: "Oil & Gas", mentions: 1620, esgSentiment: -0.62, riskSignal: "NEGATIVE" },
  { company: "Ørsted", sector: "Renewables", mentions: 980, esgSentiment: 0.71, riskSignal: "POSITIVE" },
  { company: "Shell", sector: "Oil & Gas", mentions: 1410, esgSentiment: -0.58, riskSignal: "NEGATIVE" },
  { company: "Siemens Energy", sector: "Industrials", mentions: 780, esgSentiment: 0.38, riskSignal: "NEUTRAL" },
  { company: "Glencore", sector: "Mining", mentions: 890, esgSentiment: -0.44, riskSignal: "NEGATIVE" },
];

const MENTION_TREND = [
  { week: "W1", esg: 1240, climate: 980, greenwash: 210 },
  { week: "W2", esg: 1480, climate: 1120, greenwash: 340 },
  { week: "W3", esg: 1180, climate: 1040, greenwash: 280 },
  { week: "W4", esg: 1620, climate: 1380, greenwash: 420 },
  { week: "W5", esg: 1540, climate: 1290, greenwash: 380 },
  { week: "W6", esg: 1820, climate: 1540, greenwash: 510 },
  { week: "W7", esg: 1680, climate: 1420, greenwash: 460 },
  { week: "W8", esg: 2100, climate: 1740, greenwash: 620 },
];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg px-3 py-2">
      <div className="text-[9px] font-bold text-gray-500 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px]">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-bold text-gray-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NarrativeIntelligencePage() {
  const [activeTab, setActiveTab]   = useState<"feed" | "topics" | "regulatory">("feed");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [topicPulse, setTopicPulse] = useState<TopicPulseItem[]>(FALLBACK_TOPIC_PULSE);
  const [regulatory, setRegulatory] = useState<RegulatoryEvent[]>(FALLBACK_REGULATORY);
  const [loading, setLoading]       = useState(true);
  const [asOf, setAsOf]             = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/terminal/narrative", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { ok?: boolean; pulse?: { topics?: TopicPulseItem[] }; calendar?: { events?: RegulatoryEvent[] }; asOf?: string }) => {
        if (d.ok) {
          if (d.pulse?.topics?.length)    setTopicPulse(d.pulse.topics);
          if (d.calendar?.events?.length) setRegulatory(d.calendar.events as RegulatoryEvent[]);
          if (d.asOf) setAsOf(d.asOf);
        }
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  const allTags = Array.from(new Set(NEWS_FEED.flatMap((n) => n.tags)));
  const filteredNews = selectedTags.length
    ? NEWS_FEED.filter((n) => selectedTags.some((t) => n.tags.includes(t)))
    : NEWS_FEED;

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
            NARRATIVE INTELLIGENCE / SIGNAL LAYER
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            ESG Narrative & Regulatory Intelligence Monitor
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            NLP Sentiment Analysis · Media Monitoring · Regulatory Signals · Topic Pulse
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-400" : "bg-emerald-500 animate-pulse"}`} />
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
              {loading ? "Connecting…" : asOf ? `Live · ${new Date(asOf).toLocaleTimeString()}` : "Intelligence Engine"}
            </span>
          </div>
          <div className="flex gap-1">
            {(["feed", "topics", "regulatory"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  activeTab === tab
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {tab === "feed" ? "News Feed" : tab === "topics" ? "Topic Pulse" : "Regulatory"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="ESG Mentions (7d)" value="14,280" sub="+22% WoW" trend="up" change="+2,580" />
        <MetricCard label="Avg Sentiment Score" value="+0.18" sub="Slightly positive" trend="up" change="+0.06" />
        <MetricCard label="Greenwash Signals" value="84" sub="High severity" trend="up" change="+12 this week" upIsBad />
        <MetricCard label="Regulatory Events" value="7" sub="30-day window" trend="up" change="4 enacted" />
      </div>

      {/* Sentiment trend always visible */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <DataPanel label="SENTIMENT ENGINE" title="ESG Media Sentiment Distribution — 2025">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ESG_SENTIMENT_SERIES} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="positive" name="Positive" stroke="#10B981" strokeWidth={2} fill="url(#posGrad)" dot={false} />
                  <Area type="monotone" dataKey="negative" name="Negative" stroke="#EF4444" strokeWidth={2} fill="url(#negGrad)" dot={false} />
                  <Area type="monotone" dataKey="neutral" name="Neutral" stroke="#9CA3AF" strokeWidth={1} fill="none" dot={false} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <DataPanel label="MENTION VOLUME" title="Weekly ESG Media Volume by Category">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MENTION_TREND} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="esg" name="ESG" stackId="a" fill="#0A1F44" maxBarSize={22} />
                  <Bar dataKey="climate" name="Climate" stackId="a" fill="#3B82F6" maxBarSize={22} />
                  <Bar dataKey="greenwash" name="Greenwash" stackId="a" fill="#EF4444" maxBarSize={22} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
        </div>
      </div>

      {/* ── NEWS FEED TAB ── */}
      {activeTab === "feed" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            {/* Tag filter */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Filter:</span>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                  className={`px-2.5 py-1 text-[9px] font-bold border transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-gray-900 text-white border-gray-900"
                      : "text-gray-500 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <DataPanel label="LIVE INTELLIGENCE FEED" title={`${filteredNews.length} articles matching`} noPad>
              <div className="divide-y divide-gray-100">
                {filteredNews.map((article) => (
                  <div key={article.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-1 flex-shrink-0 self-stretch ${
                        article.sentiment > 0.3 ? "bg-emerald-400" :
                        article.sentiment < -0.3 ? "bg-red-400" : "bg-gray-300"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {article.source}
                          </span>
                          <span className="text-[9px] text-gray-300">{article.time}</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-800 mb-1 leading-snug">{article.headline}</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{article.summary}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {article.tags.map((t) => (
                            <span key={t} className="text-[8px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 uppercase tracking-widest">
                              {t}
                            </span>
                          ))}
                          <div className="ml-auto flex items-center gap-1 text-[9px] font-bold">
                            <span className={article.sentiment > 0 ? "text-emerald-600" : "text-red-500"}>
                              {article.sentiment > 0 ? "+" : ""}{article.sentiment.toFixed(2)} sentiment
                            </span>
                            <ExternalLink className="w-3 h-3 text-gray-300" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Company ESG coverage */}
            <DataPanel label="COMPANY COVERAGE" title="ESG Sentiment by Company" noPad>
              <div className="divide-y divide-gray-100">
                {COMPANY_COVERAGE.map((c) => (
                  <div key={c.company} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-gray-800">{c.company}</div>
                      <div className="text-[9px] text-gray-400">{c.sector} · {c.mentions.toLocaleString()} mentions</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-bold flex items-center gap-1 ${
                        c.esgSentiment > 0.3 ? "text-emerald-600" :
                        c.esgSentiment < -0.3 ? "text-red-600" : "text-amber-600"
                      }`}>
                        {c.esgSentiment > 0 ? <TrendingUp className="w-3 h-3" /> : c.esgSentiment < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {c.esgSentiment > 0 ? "+" : ""}{c.esgSentiment.toFixed(2)}
                      </div>
                      <div className={`text-[8px] font-bold ${
                        c.riskSignal === "POSITIVE" ? "text-emerald-500" :
                        c.riskSignal === "NEGATIVE" ? "text-red-500" : "text-gray-400"
                      }`}>{c.riskSignal}</div>
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
        </div>
      )}

      {/* ── TOPICS TAB ── */}
      {activeTab === "topics" && (
        <DataPanel label="TOPIC PULSE ENGINE" title="Real-Time ESG Topic Analysis" noPad>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Topic", "Mentions (7d)", "Sentiment Score", "Trend", "Signal"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topicPulse.map((t) => (
                  <tr key={t.topic} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{t.topic}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{t.mentions_7d.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-100">
                          <div
                            className={`h-1.5 ${t.sentiment > 0 ? "bg-emerald-400" : "bg-red-400"}`}
                            style={{ width: `${Math.abs(t.sentiment) * 100}%`, marginLeft: t.sentiment < 0 ? `${(1 - Math.abs(t.sentiment)) * 100}%` : 0 }}
                          />
                        </div>
                        <span className={`font-bold ${t.sentiment > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {t.sentiment > 0 ? "+" : ""}{t.sentiment.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.trend === "up" ? <TrendingUp className="w-4 h-4 text-gray-600" /> :
                       t.trend === "down" ? <TrendingDown className="w-4 h-4 text-gray-400" /> :
                       <Minus className="w-4 h-4 text-gray-300" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                        t.sentiment > 0.4 ? "text-emerald-700 bg-emerald-50 border border-emerald-200" :
                        t.sentiment < -0.4 ? "text-red-700 bg-red-50 border border-red-200" :
                        "text-amber-700 bg-amber-50 border border-amber-200"
                      }`}>
                        {t.sentiment > 0.4 ? "Bullish" : t.sentiment < -0.4 ? "Bearish" : "Mixed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      )}

      {/* ── REGULATORY TAB ── */}
      {activeTab === "regulatory" && (
        <DataPanel label="REGULATORY INTELLIGENCE" title="Active & Upcoming Climate Regulations" noPad>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Region", "Regulation", "Impact", "Effective Date", "Status", "Action"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regulatory.map((r) => (
                  <tr key={r.regulation} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-bold text-gray-900 bg-gray-100 px-2 py-1">{r.region}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{r.regulation}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                        r.impact === "HIGH" ? "text-red-700 bg-red-50 border border-red-200" :
                        "text-amber-700 bg-amber-50 border border-amber-200"
                      }`}>{r.impact}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-600">{r.effective}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                        r.status === "Enacted" ? "text-emerald-700 bg-emerald-50 border border-emerald-200" :
                        r.status === "Litigation" ? "text-red-700 bg-red-50 border border-red-200" :
                        r.status === "Proposed" ? "text-blue-700 bg-blue-50 border border-blue-200" :
                        "text-amber-700 bg-amber-50 border border-amber-200"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-[9px] font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest">
                        Assess Impact →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      )}

    </div>
  );
}
