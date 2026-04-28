"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Thermometer, Wind, Droplets, AlertTriangle, TrendingUp,
  BarChart3, Globe, Info
} from "lucide-react";
import RiskGauge from "@/components/charts/RiskGauge";
import RiskRadar from "@/components/charts/RiskRadar";
import TemperatureTimeline from "@/components/charts/TemperatureTimeline";
import EmissionsTrajectory from "@/components/charts/EmissionsTrajectory";
import SectorBenchmark from "@/components/charts/SectorBenchmark";
import CarbonWaterfall from "@/components/charts/CarbonWaterfall";
import AirQualityChart from "@/components/charts/AirQualityChart";
import ESGScoreChart from "@/components/charts/ESGScoreChart";
import DisasterMap from "@/components/charts/DisasterMap";
import FinancialRiskTreeMap from "@/components/charts/FinancialRiskTreeMap";
import { SkeletonChart } from "@/components/ui/SkeletonCard";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import RiskBadge from "@/components/ui/RiskBadge";
import type { ClimateRiskScore, AssessmentFormData, AirQualityData, DisasterEvent } from "@/types";
import { SECTOR_CONFIGS } from "@/lib/scoring/sectorConfig";
import Link from "next/link";

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
    organizationName: "Demo Corp",
    industry: "energy-oil-gas",
    subSector: "Upstream E&P",
    country: "United States",
    countryCode: "USA",
    revenueRange: "100m-1b",
    employeeCount: "1001-10000",
    latitude: 40.71,
    longitude: -74.01,
  },
  emissions: { scope1: 45000, scope2: 28000, scope3: 180000, useEstimate: false, fossilFuelPercent: 78, renewablePercent: 22, energyIntensity: 350, emissionsTrend: "stable" },
  physicalAssets: { assetTypes: ["manufacturing", "coastal"], floodZone: false, coastalProximity: true, wildfireZone: false, waterStressRegion: true, heatStressDays: 18, waterStressIndex: 0.55 },
  esgGovernance: { climatePolicy: "developing", netZeroYear: 2050, boardOversight: false, tcfdDisclosure: true, cdpDisclosure: false, carbonOffsets: true, supplyChainEsg: false },
  scenario: { timeHorizon: 2050, warmingScenario: "2.0", reportType: "technical", units: "metric" },
};

export default function DashboardPage() {
  const [score, setScore] = useState<ClimateRiskScore>(DEMO_SCORE);
  const [form, setForm] = useState<AssessmentFormData>(DEMO_FORM);
  const [hasCustom, setHasCustom] = useState(false);

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

  const { lat, longitude: lng } = { lat: form.companyProfile.latitude, longitude: form.companyProfile.longitude };

  const { data: tempData, isLoading: tempLoading } = useQuery({
    queryKey: ["temperature", lat, lng],
    queryFn: async () => {
      const res = await fetch(`/api/climate/temperature?lat=${lat}&lng=${lng}`);
      const json = await res.json() as { data: { daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] } } };
      const daily = json.data?.daily;
      const time = daily?.time ?? [];
      const tmax = daily?.temperature_2m_max ?? [];
      const tmin = daily?.temperature_2m_min ?? [];
      return {
        time,
        temperature2m: tmax.map((t, i) => (t + (tmin[i] ?? t)) / 2),
      };
    },
  });

  const { data: aqData, isLoading: aqLoading } = useQuery({
    queryKey: ["air-quality", lat, lng],
    queryFn: async () => {
      const res = await fetch(`/api/air-quality?lat=${lat}&lng=${lng}`);
      const json = await res.json() as { data: AirQualityData };
      return json.data;
    },
  });

  const { data: disasters, isLoading: disasterLoading } = useQuery({
    queryKey: ["disasters", form.companyProfile.countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/disasters?country=${form.companyProfile.countryCode}`);
      const json = await res.json() as { data: DisasterEvent[] };
      return json.data ?? [];
    },
  });

  const sector = SECTOR_CONFIGS[form.companyProfile.industry];
  const totalEmissions = form.emissions.scope1 + form.emissions.scope2 + form.emissions.scope3;
  const revenue = { "under-1m": 500000, "1m-10m": 5000000, "10m-100m": 50000000, "100m-1b": 500000000, "over-1b": 5000000000 }[form.companyProfile.revenueRange] ?? 50000000;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="section-title">Climate Risk Dashboard</h1>
          <p className="text-gray-500 text-sm">
            {hasCustom ? form.companyProfile.organizationName : "Demo Mode"} · {form.companyProfile.country} · {sector.label}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <RiskBadge rating={score.riskRating} />
          {!hasCustom && (
            <Link href="/risk-analysis" className="btn-primary text-sm py-2">
              Run Your Assessment
            </Link>
          )}
        </div>
      </div>

      {!hasCustom && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
          <Info className="w-4 h-4 flex-shrink-0" />
          Showing demo data. <Link href="/risk-analysis" className="font-semibold underline">Run your own assessment</Link> to see your real risk profile.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Overall Risk Score", value: `${score.overall}/100`, icon: TrendingUp, color: "text-orange-600" },
          { label: "Carbon Intensity", value: `${((form.emissions.scope1 + form.emissions.scope2) / Math.max(revenue / 1e6, 1)).toFixed(0)} tCO₂e/$M`, icon: BarChart3, color: "text-brand-teal" },
          { label: "ESG Score", value: `${score.esgScore.score}/100`, icon: Globe, color: "text-green-600" },
          { label: "Total Emissions", value: `${(totalEmissions / 1000).toFixed(1)}k tCO₂e`, icon: Thermometer, color: "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card card-hover">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* 1. Risk Gauge */}
        <ErrorBoundary>
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-4">Composite Risk Score</h3>
            <RiskGauge score={score.overall} rating={score.riskRating} />
          </div>
        </ErrorBoundary>

        {/* 2. Risk Radar */}
        <ErrorBoundary>
          <div className="card md:col-span-1">
            <h3 className="font-bold text-brand-navy mb-2">Risk Dimensions Radar</h3>
            <p className="text-xs text-gray-400 mb-2">Company vs. Sector Average</p>
            <RiskRadar score={score} />
          </div>
        </ErrorBoundary>

        {/* 3. Temperature Timeline */}
        <ErrorBoundary>
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-2">Temperature Timeline & Projections</h3>
            <p className="text-xs text-gray-400 mb-2">Historical + 3 scenario paths · {form.companyProfile.country}</p>
            {tempLoading ? (
              <SkeletonChart />
            ) : (
              <TemperatureTimeline data={tempData ?? { time: [], temperature2m: [] }} />
            )}
          </div>
        </ErrorBoundary>

        {/* 4. Emissions Trajectory */}
        <ErrorBoundary>
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-2">Emissions Trajectory</h3>
            <p className="text-xs text-gray-400 mb-2">BAU vs. NDC vs. Net Zero · to {form.scenario.timeHorizon}</p>
            <EmissionsTrajectory baseEmissions={totalEmissions || 100000} timeHorizon={form.scenario.timeHorizon} />
          </div>
        </ErrorBoundary>

        {/* 5. Sector Benchmark */}
        <ErrorBoundary>
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-2">Carbon Intensity Benchmark</h3>
            <p className="text-xs text-gray-400 mb-2">vs. {sector.label}</p>
            <SectorBenchmark
              companyScore={(form.emissions.scope1 + form.emissions.scope2) / Math.max(revenue / 1e6, 1)}
              sectorMedian={sector.carbonIntensityBenchmark}
              bestInClass={Math.round(sector.carbonIntensityBenchmark * 0.3)}
            />
          </div>
        </ErrorBoundary>

        {/* 6. Carbon Budget Waterfall */}
        <ErrorBoundary>
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-2">Carbon Budget Analysis</h3>
            <p className="text-xs text-gray-400 mb-2">vs. 1.5°C global carbon budget · to {form.scenario.timeHorizon}</p>
            <CarbonWaterfall annualEmissions={totalEmissions || 100000} timeHorizon={form.scenario.timeHorizon} />
          </div>
        </ErrorBoundary>

        {/* 7. Air Quality */}
        <ErrorBoundary>
          <div className="card md:col-span-1">
            <h3 className="font-bold text-brand-navy mb-2">Air Quality Monitoring</h3>
            <p className="text-xs text-gray-400 mb-2">24-hour trend · operational location</p>
            {aqLoading ? (
              <SkeletonChart />
            ) : aqData ? (
              <AirQualityChart current={aqData} />
            ) : (
              <div className="text-gray-400 text-center py-8">No air quality data</div>
            )}
          </div>
        </ErrorBoundary>

        {/* 8. ESG Score Breakdown */}
        <ErrorBoundary>
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-2">ESG Score Breakdown</h3>
            <p className="text-xs text-gray-400 mb-2">vs. Sector Median & Global Leaders</p>
            <ESGScoreChart esgScore={score.esgScore} />
          </div>
        </ErrorBoundary>

        {/* 9. Disaster Exposure Map */}
        <ErrorBoundary>
          <div className="card">
            <h3 className="font-bold text-brand-navy mb-2">Disaster Event Exposure</h3>
            <p className="text-xs text-gray-400 mb-2">{form.companyProfile.country} · Recent events</p>
            {disasterLoading ? (
              <SkeletonChart />
            ) : (
              <DisasterMap disasters={disasters ?? []} country={form.companyProfile.countryCode} />
            )}
          </div>
        </ErrorBoundary>

        {/* 10. Financial Risk Treemap */}
        <ErrorBoundary>
          <div className="card xl:col-span-2">
            <h3 className="font-bold text-brand-navy mb-2">Financial Risk Treemap</h3>
            <p className="text-xs text-gray-400 mb-2">Value at risk by category ($)</p>
            <FinancialRiskTreeMap riskScore={score} revenue={revenue} />
          </div>
        </ErrorBoundary>

      </div>

      {/* Data sources footer */}
      <div className="mt-8 text-center text-xs text-gray-400">
        Data sources: Open-Meteo · NASA POWER · OpenAQ · ReliefWeb · World Bank · UN SDG · REST Countries
      </div>
    </div>
  );
}
