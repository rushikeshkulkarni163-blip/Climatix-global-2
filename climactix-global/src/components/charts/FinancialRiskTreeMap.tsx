"use client";

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import type { ClimateRiskScore } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface FinancialRiskTreeMapProps {
  riskScore: ClimateRiskScore;
  revenue: number;
}

const RISK_COLORS = {
  physical: "#1A8F99",
  transition: "#E07B3A",
  esg: "#2D6A4F",
  stranded: "#C1121F",
};

export default function FinancialRiskTreeMap({ riskScore, revenue }: FinancialRiskTreeMapProps) {
  const data = [
    {
      name: "Physical Risk",
      size: Math.round((riskScore.physicalRisk.score / 100) * revenue * 0.12),
      fill: RISK_COLORS.physical,
      children: [
        { name: "Acute Weather", size: Math.round((riskScore.physicalRisk.acute / 100) * revenue * 0.07), fill: "#1A8F99" },
        { name: "Chronic Climate", size: Math.round((riskScore.physicalRisk.chronic / 100) * revenue * 0.05), fill: "#0D5C63" },
      ],
    },
    {
      name: "Transition Risk",
      size: Math.round((riskScore.transitionRisk.score / 100) * revenue * 0.15),
      fill: RISK_COLORS.transition,
      children: [
        { name: "Carbon Cost", size: Math.round((riskScore.transitionRisk.policy / 100) * revenue * 0.08), fill: "#E07B3A" },
        { name: "Tech Disruption", size: Math.round((riskScore.transitionRisk.technology / 100) * revenue * 0.04), fill: "#F4A261" },
        { name: "Market Shift", size: Math.round((riskScore.transitionRisk.market / 100) * revenue * 0.03), fill: "#FBBF24" },
      ],
    },
    {
      name: "ESG Risk",
      size: Math.round((riskScore.esgScore.score / 100) * revenue * 0.08),
      fill: RISK_COLORS.esg,
      children: [
        { name: "Environmental", size: Math.round((riskScore.esgScore.environmental / 100) * revenue * 0.04), fill: "#2D6A4F" },
        { name: "Social", size: Math.round((riskScore.esgScore.social / 100) * revenue * 0.02), fill: "#3D8C6A" },
        { name: "Governance", size: Math.round((riskScore.esgScore.governance / 100) * revenue * 0.02), fill: "#4DAE84" },
      ],
    },
    {
      name: "Stranded Assets",
      size: Math.round((riskScore.transitionRisk.technology / 100) * revenue * 0.18),
      fill: RISK_COLORS.stranded,
      children: [
        { name: "Fossil Assets", size: Math.round((riskScore.transitionRisk.technology / 100) * revenue * 0.12), fill: "#C1121F" },
        { name: "Infrastructure", size: Math.round((riskScore.transitionRisk.technology / 100) * revenue * 0.06), fill: "#E53935" },
      ],
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="#fff"
        content={<CustomContent />}
      >
        <Tooltip
          formatter={(v: number) => [formatCurrency(v, "USD", true), "Value at Risk"]}
          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}

function CustomContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  fill?: string;
  size?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, depth = 0, name = "", fill = "#ccc", size = 0 } = props;
  if (width < 30 || height < 20) return null;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 60 && height > 30 && (
        <>
          <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight={600}>
            {name}
          </text>
          {height > 45 && (
            <text x={x + 6} y={y + 30} fill="rgba(255,255,255,0.8)" fontSize={10}>
              {formatCurrency(size, "USD", true)}
            </text>
          )}
        </>
      )}
    </g>
  );
}
