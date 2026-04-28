"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import WizardProgress from "@/components/forms/WizardProgress";
import Step1Profile from "@/components/forms/Step1Profile";
import Step2Emissions from "@/components/forms/Step2Emissions";
import Step3Assets from "@/components/forms/Step3Assets";
import Step4ESG from "@/components/forms/Step4ESG";
import Step5Scenario from "@/components/forms/Step5Scenario";
import { calculateRiskScore } from "@/lib/scoring/riskEngine";
import type { AssessmentFormData, ClimateRiskScore } from "@/types";
import RiskGauge from "@/components/charts/RiskGauge";
import RiskBadge from "@/components/ui/RiskBadge";
import { formatNumber } from "@/lib/utils";

const STEPS = [
  { label: "Company Profile", icon: "🏢" },
  { label: "Emissions & Energy", icon: "💨" },
  { label: "Physical Assets", icon: "🏗️" },
  { label: "ESG & Governance", icon: "📊" },
  { label: "Scenarios", icon: "🔭" },
];

const DEFAULT_FORM: AssessmentFormData = {
  companyProfile: {
    organizationName: "",
    industry: "energy-oil-gas",
    subSector: "",
    country: "United States",
    countryCode: "USA",
    revenueRange: "100m-1b",
    employeeCount: "1001-10000",
    latitude: 40.71,
    longitude: -74.01,
  },
  emissions: {
    scope1: 0,
    scope2: 0,
    scope3: 0,
    useEstimate: false,
    fossilFuelPercent: 60,
    renewablePercent: 40,
    energyIntensity: 0,
    emissionsTrend: "stable",
  },
  physicalAssets: {
    assetTypes: ["manufacturing"],
    floodZone: false,
    coastalProximity: false,
    wildfireZone: false,
    waterStressRegion: false,
    heatStressDays: 0,
    waterStressIndex: 0.3,
  },
  esgGovernance: {
    climatePolicy: "developing",
    netZeroYear: null,
    boardOversight: false,
    tcfdDisclosure: false,
    cdpDisclosure: false,
    carbonOffsets: false,
    supplyChainEsg: false,
  },
  scenario: {
    timeHorizon: 2050,
    warmingScenario: "2.0",
    reportType: "technical",
    units: "metric",
  },
};

export default function RiskAnalysisPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AssessmentFormData>(DEFAULT_FORM);
  const [result, setResult] = useState<ClimateRiskScore | null>(null);
  const [loading, setLoading] = useState(false);

  const updateForm = <K extends keyof AssessmentFormData>(
    key: K,
    val: AssessmentFormData[K]
  ) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const score = calculateRiskScore(form);
      setResult(score);
      if (typeof window !== "undefined") {
        localStorage.setItem("cg_form", JSON.stringify(form));
        localStorage.setItem("cg_score", JSON.stringify(score));
      }
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return <ResultScreen result={result} form={form} onNewAssessment={() => { setResult(null); setStep(1); setForm(DEFAULT_FORM); }} onReport={() => router.push("/report")} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="section-title">Climate Risk Assessment</h1>
        <p className="section-subtitle">
          TCFD-aligned analysis in 5 steps — Step {step} of {STEPS.length}
        </p>
      </div>

      <WizardProgress currentStep={step} steps={STEPS} />

      <div className="card">
        <h2 className="text-lg font-bold text-brand-navy mb-1">
          {STEPS[step - 1].icon} {STEPS[step - 1].label}
        </h2>
        <p className="text-sm text-gray-400 mb-6 border-b border-gray-100 pb-4">
          {step === 1 && "Tell us about your organization and primary operations location."}
          {step === 2 && "Enter your greenhouse gas emissions data and energy profile."}
          {step === 3 && "Describe your physical asset exposure to climate hazards."}
          {step === 4 && "Rate your ESG governance maturity and disclosure commitments."}
          {step === 5 && "Choose the time horizon and warming scenario for your analysis."}
        </p>

        {step === 1 && <Step1Profile data={form.companyProfile} onChange={(d) => updateForm("companyProfile", d)} />}
        {step === 2 && <Step2Emissions data={form.emissions} industry={form.companyProfile.industry} onChange={(d) => updateForm("emissions", d)} />}
        {step === 3 && <Step3Assets data={form.physicalAssets} lat={form.companyProfile.latitude} lng={form.companyProfile.longitude} onChange={(d) => updateForm("physicalAssets", d)} />}
        {step === 4 && <Step4ESG data={form.esgGovernance} onChange={(d) => updateForm("esgGovernance", d)} />}
        {step === 5 && <Step5Scenario data={form.scenario} onChange={(d) => updateForm("scenario", d)} />}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculating...
              </>
            ) : step === 5 ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Calculate Risk Score
              </>
            ) : (
              <>
                Next Step <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  result,
  form,
  onNewAssessment,
  onReport,
}: {
  result: ClimateRiskScore;
  form: AssessmentFormData;
  onNewAssessment: () => void;
  onReport: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="section-title">Risk Assessment Complete</h1>
          <p className="text-gray-500">{form.companyProfile.organizationName || "Your organization"} — {form.companyProfile.country}</p>
        </div>
        <RiskBadge rating={result.riskRating} size="lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card md:col-span-1 flex flex-col items-center">
          <h2 className="font-bold text-brand-navy mb-4">Overall Risk Score</h2>
          <RiskGauge score={result.overall} rating={result.riskRating} />
          <div className="text-xs text-gray-400 mt-3">Confidence: {result.confidence}%</div>
        </div>

        <div className="card md:col-span-2 space-y-4">
          <h2 className="font-bold text-brand-navy">Risk Breakdown</h2>
          {[
            { label: "Physical Risk", value: result.physicalRisk.score, color: "#1A8F99" },
            { label: "Transition Risk", value: result.transitionRisk.score, color: "#E07B3A" },
            { label: "ESG Score", value: result.esgScore.score, color: "#2D6A4F" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="font-bold" style={{ color }}>{value}/100</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${value}%`, backgroundColor: color }}
                />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { label: "Vulnerability Index", value: result.vulnerabilityIndex },
              { label: "Adaptation Capacity", value: result.adaptationCapacity },
              { label: "Data Confidence", value: result.confidence },
            ].map(({ label, value }) => (
              <div key={label} className="bg-brand-bg rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-brand-teal">{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Physical Acute", value: result.physicalRisk.acute, icon: "⚡" },
          { label: "Physical Chronic", value: result.physicalRisk.chronic, icon: "📈" },
          { label: "Policy Risk", value: result.transitionRisk.policy, icon: "📋" },
          { label: "Technology Risk", value: result.transitionRisk.technology, icon: "🔧" },
          { label: "Market Risk", value: result.transitionRisk.market, icon: "📊" },
          { label: "Reputation Risk", value: result.transitionRisk.reputation, icon: "🏆" },
          { label: "Environmental", value: result.esgScore.environmental, icon: "🌿" },
          { label: "Governance", value: result.esgScore.governance, icon: "🏛️" },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card p-3 text-center">
            <div className="text-xl mb-1">{icon}</div>
            <div className={`text-lg font-bold ${value > 60 ? "text-red-600" : value > 40 ? "text-amber-600" : "text-green-600"}`}>
              {value}
            </div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick={onReport} className="btn-primary flex-1 flex items-center justify-center gap-2">
          Generate Full PDF Report
        </button>
        <button onClick={onNewAssessment} className="btn-secondary flex-1">
          New Assessment
        </button>
      </div>
    </div>
  );
}
