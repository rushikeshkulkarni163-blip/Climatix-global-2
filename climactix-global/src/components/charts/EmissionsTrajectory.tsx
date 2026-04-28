"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

interface EmissionsTrajectoryProps {
  baseEmissions: number;
  timeHorizon?: number;
}

export default function EmissionsTrajectory({ baseEmissions, timeHorizon = 2050 }: EmissionsTrajectoryProps) {
  const years = [];
  for (let y = 2024; y <= timeHorizon; y += 2) {
    const t = (y - 2024) / (timeHorizon - 2024);
    years.push({
      year: y,
      bau: Math.round(baseEmissions * (1 + t * 0.25)),
      ndc: Math.round(baseEmissions * (1 - t * 0.45)),
      netZero: Math.round(Math.max(0, baseEmissions * (1 - t * 0.95))),
    });
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={years} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="bauGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#C1121F" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#C1121F" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="ndcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F4A261" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#F4A261" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="nzGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          label={{ value: "tCO₂e", angle: -90, position: "insideLeft", offset: 10, fill: "#6b7280", fontSize: 11 }}
        />
        <Tooltip
          formatter={(v: number, name: string) => [
            `${v.toLocaleString()} tCO₂e`,
            name,
          ]}
          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Area type="monotone" dataKey="bau" stroke="#C1121F" fill="url(#bauGrad)" strokeWidth={2} name="Business as Usual" />
        <Area type="monotone" dataKey="ndc" stroke="#F4A261" fill="url(#ndcGrad)" strokeWidth={2} name="NDC-Aligned" />
        <Area type="monotone" dataKey="netZero" stroke="#2D6A4F" fill="url(#nzGrad)" strokeWidth={2} name="Net Zero Pathway" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
