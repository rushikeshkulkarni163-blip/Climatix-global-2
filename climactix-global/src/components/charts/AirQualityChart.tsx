"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import type { AirQualityData } from "@/types";

interface AirQualityChartProps {
  current: AirQualityData;
}

function generateTrend(base: number, points: number): { time: string; value: number }[] {
  return Array.from({ length: points }, (_, i) => ({
    time: `${i + 1}h`,
    value: Math.max(0, base + (Math.random() - 0.5) * base * 0.4),
  }));
}

export default function AirQualityChart({ current }: AirQualityChartProps) {
  const data = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    pm25: Math.max(0, current.pm25 + (Math.random() - 0.5) * 10),
    pm10: Math.max(0, current.pm10 + (Math.random() - 0.5) * 15),
    no2: Math.max(0, current.no2 + (Math.random() - 0.5) * 8),
    aqi: Math.max(0, current.aqi + (Math.random() - 0.5) * 20),
  })).map((d) => ({
    ...d,
    pm25: +d.pm25.toFixed(1),
    pm10: +d.pm10.toFixed(1),
    no2: +d.no2.toFixed(1),
    aqi: +d.aqi.toFixed(0),
  }));

  const aqiColor = current.aqi < 50 ? "#2D6A4F" : current.aqi < 100 ? "#F4A261" : "#C1121F";

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "PM2.5", value: current.pm25, unit: "μg/m³", safe: 12 },
          { label: "PM10", value: current.pm10, unit: "μg/m³", safe: 20 },
          { label: "NO₂", value: current.no2, unit: "μg/m³", safe: 40 },
          { label: "AQI", value: current.aqi, unit: "", safe: 50 },
        ].map(({ label, value, unit, safe }) => (
          <div key={label} className="text-center">
            <div
              className="text-xl font-bold"
              style={{ color: value > safe * 2 ? "#C1121F" : value > safe ? "#F4A261" : "#2D6A4F" }}
            >
              {value.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">{label} {unit}</div>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280" }} interval={3} />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
          <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "11px" }} />
          <Legend wrapperStyle={{ fontSize: "10px" }} />
          <Line type="monotone" dataKey="pm25" stroke="#C1121F" strokeWidth={1.5} dot={false} name="PM2.5" />
          <Line type="monotone" dataKey="pm10" stroke="#F4A261" strokeWidth={1.5} dot={false} name="PM10" />
          <Line type="monotone" dataKey="no2" stroke="#0D5C63" strokeWidth={1.5} dot={false} name="NO₂" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
