"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { getScoreGradientColor, getRiskColor } from "@/lib/utils";
import type { ClimateRiskScore } from "@/types";

interface RiskGaugeProps {
  score: number;
  rating: ClimateRiskScore["riskRating"];
  label?: string;
  size?: "sm" | "md" | "lg";
}

export default function RiskGauge({ score, rating, label = "Overall Risk", size = "md" }: RiskGaugeProps) {
  const heights = { sm: 160, md: 220, lg: 280 };
  const fontSizes = { sm: "text-2xl", md: "text-4xl", lg: "text-5xl" };
  const height = heights[size];
  const color = getScoreGradientColor(score);

  const data = [{ value: score, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: "100%", height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="75%"
            innerRadius="65%"
            outerRadius="95%"
            startAngle={180}
            endAngle={0}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              background={{ fill: "#e5e7eb" }}
              dataKey="value"
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: "12%" }}>
          <span className={`font-bold ${fontSizes[size]}`} style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-gray-400 mt-1 font-medium">/ 100</span>
          <span
            className="mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border-2"
            style={{ color, borderColor: color, backgroundColor: `${color}15` }}
          >
            {rating}
          </span>
        </div>
      </div>

      {/* Scale labels */}
      <div className="flex justify-between w-full px-4 mt-1 text-xs text-gray-400">
        <span>0 MINIMAL</span>
        <span className="text-center">{label}</span>
        <span>100 CRITICAL</span>
      </div>

      {/* Color scale */}
      <div className="flex w-full h-2 rounded-full overflow-hidden mt-2 mx-4" style={{ maxWidth: "80%" }}>
        {[
          { pct: 20, color: "#0D5C63" },
          { pct: 20, color: "#2D6A4F" },
          { pct: 20, color: "#F4A261" },
          { pct: 20, color: "#E07B3A" },
          { pct: 20, color: "#C1121F" },
        ].map(({ pct, color: c }, i) => (
          <div key={i} style={{ width: `${pct}%`, backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}
