"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, LabelList
} from "recharts";
import type { ClimateRiskScore } from "@/types";

interface ESGScoreChartProps {
  esgScore: ClimateRiskScore["esgScore"];
}

export default function ESGScoreChart({ esgScore }: ESGScoreChartProps) {
  const data = [
    {
      dimension: "Environmental",
      company: esgScore.environmental,
      sectorMedian: 55,
      globalLeader: 25,
    },
    {
      dimension: "Social",
      company: esgScore.social,
      sectorMedian: 50,
      globalLeader: 22,
    },
    {
      dimension: "Governance",
      company: esgScore.governance,
      sectorMedian: 48,
      globalLeader: 20,
    },
    {
      dimension: "Overall ESG",
      company: esgScore.score,
      sectorMedian: 51,
      globalLeader: 22,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 5, right: 40, left: 20, bottom: 5 }}
        barSize={18}
        barGap={4}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} />
        <YAxis type="category" dataKey="dimension" tick={{ fontSize: 11, fill: "#6b7280" }} width={90} />
        <Tooltip
          formatter={(v: number, name: string) => [`${v}/100`, name]}
          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Bar dataKey="company" fill="#0D5C63" name="Your Company" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="company" position="right" style={{ fontSize: "10px", fill: "#0D5C63" }} />
        </Bar>
        <Bar dataKey="sectorMedian" fill="#F4A261" name="Sector Median" radius={[0, 4, 4, 0]} />
        <Bar dataKey="globalLeader" fill="#2D6A4F" name="Global Leader" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
