"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import RiskGauge from "@/components/charts/RiskGauge";
import RiskBadge from "@/components/ui/RiskBadge";
import type { ClimateRiskScore, AssessmentFormData } from "@/types";
import { SECTOR_CONFIGS, WARMING_SCENARIOS } from "@/lib/scoring/sectorConfig";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

const REPORT_SECTIONS = [
  { id: "cover", label: "Cover Page", icon: "📄" },
  { id: "executive", label: "Executive Summary", icon: "📋" },
  { id: "methodology", label: "Methodology", icon: "🔬" },
  { id: "physical", label: "Physical Risk (2 pages)", icon: "🌊" },
  { id: "transition", label: "Transition Risk (2 pages)", icon: "⚡" },
  { id: "esg", label: "ESG Performance", icon: "🌿" },
  { id: "scenarios", label: "Scenario Analysis (2 pages)", icon: "🔭" },
  { id: "financial", label: "Financial Materiality", icon: "💰" },
  { id: "recommendations", label: "Recommendations", icon: "✅" },
  { id: "appendix", label: "Appendices (A–E)", icon: "📎" },
];

const DEMO_SCORE: ClimateRiskScore = {
  overall: 62,
  physicalRisk: { acute: 58, chronic: 45, score: 51 },
  transitionRisk: { policy: 72, technology: 68, market: 55, reputation: 48, score: 62 },
  esgScore: { environmental: 60, social: 45, governance: 38, score: 52 },
  vulnerabilityIndex: 64,
  adaptationCapacity: 37,
  riskRating: "HIGH",
  confidence: 78,
};

const DEMO_FORM: AssessmentFormData = {
  companyProfile: {
    organizationName: "Demo Corporation",
    industry: "energy-oil-gas",
    subSector: "Upstream E&P",
    country: "United States",
    countryCode: "USA",
    revenueRange: "100m-1b",
    employeeCount: "1001-10000",
    latitude: 40.71,
    longitude: -74.01,
  },
  emissions: {
    scope1: 45000,
    scope2: 28000,
    scope3: 180000,
    useEstimate: false,
    fossilFuelPercent: 78,
    renewablePercent: 22,
    energyIntensity: 350,
    emissionsTrend: "stable",
  },
  physicalAssets: {
    assetTypes: ["manufacturing", "coastal"],
    floodZone: false,
    coastalProximity: true,
    wildfireZone: false,
    waterStressRegion: true,
    heatStressDays: 18,
    waterStressIndex: 0.55,
  },
  esgGovernance: {
    climatePolicy: "developing",
    netZeroYear: 2050,
    boardOversight: false,
    tcfdDisclosure: true,
    cdpDisclosure: false,
    carbonOffsets: true,
    supplyChainEsg: false,
  },
  scenario: {
    timeHorizon: 2050,
    warmingScenario: "2.0",
    reportType: "technical",
    units: "metric",
  },
};

type GenerationStatus = "idle" | "preparing" | "generating" | "done" | "error";

export default function ReportPage() {
  const [score, setScore] = useState<ClimateRiskScore>(DEMO_SCORE);
  const [form, setForm] = useState<AssessmentFormData>(DEMO_FORM);
  const [hasCustom, setHasCustom] = useState(false);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState("");

  useEffect(() => {
    try {
      const storedForm = localStorage.getItem("cg_form");
      const storedScore = localStorage.getItem("cg_score");
      if (storedForm && storedScore) {
        setForm(JSON.parse(storedForm) as AssessmentFormData);
        setScore(JSON.parse(storedScore) as ClimateRiskScore);
        setHasCustom(true);
      }
    } catch {}
  }, []);

  const sector = SECTOR_CONFIGS[form.companyProfile.industry];
  const scenario = WARMING_SCENARIOS[form.scenario.warmingScenario];
  const totalEmissions = form.emissions.scope1 + form.emissions.scope2 + form.emissions.scope3;

  async function handleGenerate() {
    setStatus("preparing");
    setProgress(0);

    try {
      // Simulate section-by-section progress
      for (let i = 0; i < REPORT_SECTIONS.length; i++) {
        setCurrentSection(REPORT_SECTIONS[i].label);
        setProgress(Math.round(((i + 1) / REPORT_SECTIONS.length) * 85));
        await new Promise((r) => setTimeout(r, 200));
      }

      setStatus("generating");
      setCurrentSection("Compiling PDF...");
      setProgress(90);

      const { generateClimateReport } = await import("@/lib/report-generator/generateReport");

      await generateClimateReport({
        companyName: form.companyProfile.organizationName || "Organization",
        sector: sector.label,
        date: formatDate(),
        horizon: form.scenario.timeHorizon,
        scenario: form.scenario.warmingScenario,
        reportType: form.scenario.reportType,
        riskScore: score,
        formData: form,
      });

      setProgress(100);
      setCurrentSection("Complete!");
      setStatus("done");
    } catch (err) {
      console.error("Report generation error:", err);
      setStatus("error");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-teal flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="section-title mb-0">PDF Report Generator</h1>
            <p className="text-gray-500 text-sm">TCFD-aligned disclosure report — 9 sections, ~12 pages</p>
          </div>
        </div>
      </div>

      {!hasCustom && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Using demo data.{" "}
            <Link href="/risk-analysis" className="font-semibold underline">
              Run your own assessment
            </Link>{" "}
            to generate a personalized report.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Preview Card */}
          <div className="card">
            <h2 className="font-bold text-brand-navy mb-4 flex items-center gap-2">
              <span>📋</span> Report Configuration
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Organization", value: form.companyProfile.organizationName || "Demo Corporation" },
                { label: "Industry", value: sector.label },
                { label: "Country", value: form.companyProfile.country },
                { label: "Time Horizon", value: String(form.scenario.timeHorizon) },
                { label: "Warming Scenario", value: `${form.scenario.warmingScenario}°C (${scenario.rcp})` },
                { label: "Report Type", value: form.scenario.reportType.charAt(0).toUpperCase() + form.scenario.reportType.slice(1) },
                { label: "Total Emissions", value: `${(totalEmissions / 1000).toFixed(1)}k tCO₂e` },
                { label: "Risk Rating", value: score.riskRating },
              ].map(({ label, value }) => (
                <div key={label} className="bg-brand-bg rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                  <div className="text-sm font-semibold text-brand-navy">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Sections */}
          <div className="card">
            <h2 className="font-bold text-brand-navy mb-4">📄 Report Sections (All Included)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REPORT_SECTIONS.map(({ id, label, icon }) => (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    status === "done"
                      ? "border-green-200 bg-green-50"
                      : currentSection === label && status !== "idle"
                      ? "border-brand-teal bg-brand-bg"
                      : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <span className="text-lg">{icon}</span>
                  <span className="text-sm font-medium text-brand-navy flex-1">{label}</span>
                  {status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : currentSection === label && status !== "idle" ? (
                    <Loader2 className="w-4 h-4 text-brand-teal animate-spin" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* PDF Styling Info */}
          <div className="card bg-brand-navy text-white">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <span>🎨</span> Report Design System
            </h2>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { label: "Primary", color: "#0D5C63", name: "Deep Teal" },
                { label: "Accent", color: "#F4A261", name: "Warm Amber" },
                { label: "Danger", color: "#C1121F", name: "Deep Red" },
                { label: "Success", color: "#2D6A4F", name: "Forest Green" },
                { label: "Navy", color: "#1A2332", name: "Background" },
                { label: "Background", color: "#F0F7F4", name: "Light Mint" },
              ].map(({ label, color, name }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <div className="text-gray-300">{name}</div>
                    <div className="text-gray-500">{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400 space-y-1">
              <div>Font: Helvetica (jsPDF built-in)</div>
              <div>Format: A4 Portrait · Brand headers every page</div>
              <div>Footer: Confidential | climactix.global | Page numbers</div>
            </div>
          </div>
        </div>

        {/* Right: Score preview + Generate button */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-bold text-brand-navy mb-4 text-center">Risk Score Preview</h2>
            <RiskGauge score={score.overall} rating={score.riskRating} size="sm" />

            <div className="mt-4 space-y-2">
              {[
                { label: "Physical", value: score.physicalRisk.score, color: "#1A8F99" },
                { label: "Transition", value: score.transitionRisk.score, color: "#E07B3A" },
                { label: "ESG", value: score.esgScore.score, color: "#2D6A4F" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-bold" style={{ color }}>{value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
              <RiskBadge rating={score.riskRating} />
            </div>
          </div>

          {/* Generate Button */}
          <div className="card">
            {status === "idle" && (
              <button
                onClick={handleGenerate}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
              >
                <Download className="w-5 h-5" />
                Generate PDF Report
              </button>
            )}

            {(status === "preparing" || status === "generating") && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-brand-teal animate-spin" />
                  <div>
                    <div className="font-semibold text-brand-navy text-sm">Building your report…</div>
                    <div className="text-xs text-gray-400">{currentSection}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-teal transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-right text-xs text-gray-400">{progress}%</div>
              </div>
            )}

            {status === "done" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  <div>
                    <div className="font-semibold text-green-800">Report downloaded!</div>
                    <div className="text-xs text-green-600">Check your Downloads folder</div>
                  </div>
                </div>
                <button
                  onClick={() => { setStatus("idle"); setProgress(0); setCurrentSection(""); }}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Generate Again
                </button>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <div>
                    <div className="font-semibold text-red-800">Generation failed</div>
                    <div className="text-xs text-red-600">Check browser console for details</div>
                  </div>
                </div>
                <button
                  onClick={() => setStatus("idle")}
                  className="btn-secondary w-full"
                >
                  Try Again
                </button>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3 text-center">
              PDF generated client-side via jsPDF · No data sent to server
            </p>
          </div>

          {/* Quick nav */}
          <div className="card">
            <h3 className="font-semibold text-brand-navy text-sm mb-3">After your report</h3>
            <div className="space-y-2">
              <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-teal transition-colors p-2 rounded-lg hover:bg-brand-bg">
                <span>📊</span> View Interactive Dashboard
              </Link>
              <Link href="/portfolio" className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-teal transition-colors p-2 rounded-lg hover:bg-brand-bg">
                <span>🌐</span> Screen Portfolio Companies
              </Link>
              <Link href="/research" className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-teal transition-colors p-2 rounded-lg hover:bg-brand-bg">
                <span>🔬</span> Explore Research Data
              </Link>
              <Link href="/risk-analysis" className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-teal transition-colors p-2 rounded-lg hover:bg-brand-bg">
                <span>↩️</span> New Assessment
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
