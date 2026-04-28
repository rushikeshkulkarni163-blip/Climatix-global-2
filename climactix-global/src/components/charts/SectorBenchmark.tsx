"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from "recharts";

interface SectorBenchmarkProps {
  companyScore: number;
  sectorMedian: number;
  bestInClass: number;
  metric?: string;
  unit?: string;
}

export default function SectorBenchmark({
  companyScore,
  sectorMedian,
  bestInClass,
  metric = "Carbon Intensity",
  unit = "tCO₂e/$M",
}: SectorBenchmarkProps) {
  const data = [
    { name: "Your Company", value: companyScore, color: "#0D5C63" },
    { name: "Sector Median", value: sectorMedian, color: "#F4A261" },
    { name: "Best in Class", value: bestInClass, color: "#2D6A4F" },
  ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barSize={48}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => `${v}`}
          label={{ value: unit, angle: -90, position: "insideLeft", offset: 10, fill: "#6b7280", fontSize: 11 }}
        />
        <Tooltip
          formatter={(v: number) => [`${v} ${unit}`, metric]}
          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
