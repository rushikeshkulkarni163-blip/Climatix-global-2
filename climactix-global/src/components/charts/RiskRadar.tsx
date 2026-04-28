"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip
} from "recharts";
import type { ClimateRiskScore } from "@/types";

interface RiskRadarProps {
  score: ClimateRiskScore;
  sectorAverage?: Partial<Record<string, number>>;
}

export default function RiskRadar({ score, sectorAverage }: RiskRadarProps) {
  const data = [
    {
      axis: "Physical\nAcute",
      company: score.physicalRisk.acute,
      sector: sectorAverage?.acute ?? 55,
    },
    {
      axis: "Physical\nChronic",
      company: score.physicalRisk.chronic,
      sector: sectorAverage?.chronic ?? 50,
    },
    {
      axis: "Policy\nRisk",
      company: score.transitionRisk.policy,
      sector: sectorAverage?.policy ?? 60,
    },
    {
      axis: "Technology\nRisk",
      company: score.transitionRisk.technology,
      sector: sectorAverage?.technology ?? 45,
    },
    {
      axis: "ESG\nScore",
      company: score.esgScore.score,
      sector: sectorAverage?.esg ?? 50,
    },
    {
      axis: "Market\nRisk",
      company: score.transitionRisk.market,
      sector: sectorAverage?.market ?? 40,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: "#6b7280", fontSize: 11 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "#9ca3af", fontSize: 10 }}
          tickCount={5}
        />
        <Radar
          name="Company"
          dataKey="company"
          stroke="#0D5C63"
          fill="#0D5C63"
          fillOpacity={0.25}
          strokeWidth={2}
          dot={{ fill: "#0D5C63", r: 4 }}
        />
        <Radar
          name="Sector Average"
          dataKey="sector"
          stroke="#F4A261"
          fill="#F4A261"
          fillOpacity={0.15}
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <Legend
          wrapperStyle={{ fontSize: "12px" }}
          formatter={(value) => (
            <span style={{ color: value === "Company" ? "#0D5C63" : "#F4A261", fontWeight: 600 }}>
              {value}
            </span>
          )}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${value}/100`,
            name,
          ]}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
