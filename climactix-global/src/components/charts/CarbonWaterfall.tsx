"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

interface CarbonWaterfallProps {
  annualEmissions: number;
  timeHorizon: number;
}

export default function CarbonWaterfall({ annualEmissions, timeHorizon }: CarbonWaterfallProps) {
  const years = timeHorizon - 2024;
  const globalBudget1_5 = 380_000_000;
  const companyShare = globalBudget1_5 * (annualEmissions / 36_000_000_000);
  const currentTrajectory = annualEmissions * years;
  const gap = currentTrajectory - companyShare;

  const data = [
    { name: "1.5°C Budget\n(your share)", value: companyShare / 1000, fill: "#2D6A4F" },
    { name: "BAU\nTrajectory", value: currentTrajectory / 1000, fill: "#C1121F" },
    { name: "Budget\nGap", value: Math.max(0, gap) / 1000, fill: "#F4A261" },
    {
      name: "Net Zero\nPath",
      value: Math.round((annualEmissions * years * 0.05) / 1000),
      fill: "#0D5C63",
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 30 }} barSize={50}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} interval={0} />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => `${v.toFixed(0)}kt`}
        />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(0)} ktCO₂e`, "Amount"]}
          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
        />
        <ReferenceLine y={companyShare / 1000} stroke="#2D6A4F" strokeDasharray="4 4" />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
