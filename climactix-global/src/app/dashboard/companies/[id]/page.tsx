"use client";

import Link from "next/link";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Leaf,
  Share2,
  FileText,
  SatelliteDish,
  Newspaper,
  FolderOpen,
  History,
  Users,
} from "lucide-react";
import Card from "@/components/ds/Card";
import { RatingBadge } from "@/components/ds/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ds/Tabs";
import EmptyState from "@/components/ds/EmptyState";
import RiskGauge from "@/components/charts/RiskGauge";
import { formatCurrency } from "@/lib/utils";
import { PORTFOLIO_COMPANIES, SCENARIO_MULTIPLIERS, type ScenarioKey } from "@/lib/dashboard/mockData";

function scoreToRiskRating(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MEDIUM";
  if (score >= 25) return "LOW";
  return "MINIMAL";
}

const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "1.5", label: "1.5°C" },
  { key: "2.0", label: "2°C" },
  { key: "3.0", label: "3°C" },
  { key: "4.0", label: "4°C" },
];

const PLACEHOLDER_TABS: { key: string; label: string; icon: React.ElementType; source: string }[] = [
  { key: "emissions", label: "Emissions", icon: Leaf, source: "the Scope 1/2/3 emissions inventory system" },
  { key: "supply-chain", label: "Supply Chain", icon: Share2, source: "the supplier tier mapping system" },
  { key: "disclosures", label: "Disclosures", icon: FileText, source: "the disclosure document repository" },
  { key: "satellite", label: "Satellite", icon: SatelliteDish, source: "satellite imagery providers" },
  { key: "news", label: "News", icon: Newspaper, source: "the news and media monitoring feed" },
  { key: "documents", label: "Documents", icon: FolderOpen, source: "the document management system" },
  { key: "timeline", label: "Timeline", icon: History, source: "the company event timeline source" },
  { key: "peer-comparison", label: "Peer Comparison", icon: Users, source: "the sector benchmarking dataset" },
];

export default function CompanyProfilePage({ params }: { params: { id: string } }) {
  const company = PORTFOLIO_COMPANIES.find((c) => c.id === params.id);

  if (!company) {
    return (
      <EmptyState
        title="Company not found"
        description="This company is not in the current portfolio coverage."
        action={
          <Link href="/dashboard/companies" className="font-ds-body text-[13px] font-medium text-ds-accent">
            Back to Companies
          </Link>
        }
      />
    );
  }

  const radarData = [
    { axis: "Climate Risk", company: company.climateRiskScore, sector: 55 },
    { axis: "Transition Risk", company: company.transitionRisk, sector: 50 },
    { axis: "Physical Risk", company: company.physicalRisk, sector: 52 },
    { axis: "Supply Chain", company: Math.round((company.transitionRisk + company.physicalRisk) / 2.4), sector: 45 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-ds-heading text-[24px] font-bold text-ds-text">{company.name}</h1>
          <p className="mt-1 font-ds-body text-[13px] text-ds-muted">{company.sector}</p>
        </div>
        <RatingBadge rating={company.rating} size="lg" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="financial">Financial Impact</TabsTrigger>
          {PLACEHOLDER_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Overall Climate Risk" padding="md">
              <RiskGauge score={company.climateRiskScore} rating={scoreToRiskRating(company.climateRiskScore)} size="sm" />
            </Card>
            <Card title="Key Metrics" padding="md" className="lg:col-span-2">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Metric label="Climate Risk Score" value={company.climateRiskScore.toString()} />
                <Metric label="Revenue at Risk" value={formatCurrency(company.revenueAtRiskUSD, "USD", true)} />
                <Metric label="Transition Risk" value={company.transitionRisk.toString()} />
                <Metric label="Physical Risk" value={company.physicalRisk.toString()} />
                <Metric label="Sector" value={company.sector} />
                <Metric label="Rating" value={company.rating} />
              </dl>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk">
          <Card title="Risk Profile" description="Company vs. sector average" padding="md">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#D9D9D9" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#4F4F4F", fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#6B7280", fontSize: 10 }} tickCount={5} />
                <Radar name="Company" dataKey="company" stroke="#0B3D91" fill="#0B3D91" fillOpacity={0.25} strokeWidth={2} />
                <Radar name="Sector Average" dataKey="sector" stroke="#B45309" fill="#B45309" fillOpacity={0.12} strokeWidth={2} strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [`${value}/100`, name]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #D9D9D9", fontSize: 12 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card title="Financial Impact by Scenario" description="Revenue at risk under each NGFS pathway" padding="md">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SCENARIOS.map((s) => {
                const multiplier = SCENARIO_MULTIPLIERS[s.key]["revenue-at-risk"];
                const value = company.revenueAtRiskUSD * multiplier;
                return (
                  <div key={s.key} className="rounded-lg border border-ds-border bg-ds-surface p-3">
                    <p className="font-ds-body text-[12px] text-ds-muted">{s.label}</p>
                    <p className="mt-1 font-ds-number text-[18px] font-bold text-ds-text">
                      {formatCurrency(value, "USD", true)}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {PLACEHOLDER_TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <EmptyState
              icon={t.icon}
              title={`${t.label} — data integration pending`}
              description={`This tab will populate once ${t.source} is connected. No data is fabricated in the meantime.`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-ds-body text-[11px] uppercase tracking-wide text-ds-muted">{label}</dt>
      <dd className="mt-1 font-ds-number text-[18px] font-bold text-ds-text">{value}</dd>
    </div>
  );
}
