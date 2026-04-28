"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import type { TemperatureData } from "@/types";

interface TemperatureTimelineProps {
  data: TemperatureData;
  showProjections?: boolean;
}

export default function TemperatureTimeline({ data, showProjections = true }: TemperatureTimelineProps) {
  const historicalData = data.time.slice(-60).map((t, i) => ({
    date: t,
    actual: data.temperature2m[data.temperature2m.length - 60 + i],
  }));

  const lastTemp = historicalData[historicalData.length - 1]?.actual ?? 20;
  const futureYears = [2025, 2030, 2035, 2040, 2045, 2050];
  const projections = futureYears.map((yr, i) => ({
    date: String(yr),
    actual: null,
    rcp26: +(lastTemp + i * 0.08).toFixed(2),
    rcp45: +(lastTemp + i * 0.18).toFixed(2),
    rcp85: +(lastTemp + i * 0.38).toFixed(2),
  }));

  const allData = [
    ...historicalData.map((d) => ({ ...d, rcp26: null, rcp45: null, rcp85: null })),
    ...projections,
  ];

  const displayData = allData.filter((_, i) => i % 5 === 0 || allData.length - 1 === i);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={displayData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => v.length > 7 ? v.slice(0, 7) : v}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => `${v}°C`}
        />
        <Tooltip
          formatter={(v: number, name: string) => [`${v?.toFixed(1)}°C`, name]}
          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <ReferenceLine y={lastTemp} stroke="#6b7280" strokeDasharray="3 3" label={{ value: "Baseline", fill: "#6b7280", fontSize: 10 }} />

        <Line
          type="monotone"
          dataKey="actual"
          stroke="#0D5C63"
          strokeWidth={2}
          dot={false}
          name="Historical"
          connectNulls={false}
        />
        {showProjections && (
          <>
            <Line type="monotone" dataKey="rcp26" stroke="#2D6A4F" strokeWidth={2} strokeDasharray="6 3" dot={false} name="1.5°C (RCP 2.6)" connectNulls={false} />
            <Line type="monotone" dataKey="rcp45" stroke="#F4A261" strokeWidth={2} strokeDasharray="6 3" dot={false} name="2°C (RCP 4.5)" connectNulls={false} />
            <Line type="monotone" dataKey="rcp85" stroke="#C1121F" strokeWidth={2} strokeDasharray="6 3" dot={false} name="4°C (RCP 8.5)" connectNulls={false} />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
