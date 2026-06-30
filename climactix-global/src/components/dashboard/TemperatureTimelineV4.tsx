"use client";

import { useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ResponsiveContainer,
} from "recharts";
import Card from "@/components/ds/Card";
import ChartToolbar from "./ChartToolbar";
import { exportCsv, exportPng } from "@/lib/dashboard/exportChart";

interface MonthRow {
  month: string;
  current: number;
  scenario15: number | null;
}

function buildData(): MonthRow[] {
  const months: MonthRow[] = [];
  let base = 58;
  for (let i = 0; i < 24; i++) {
    base += Math.sin(i / 4) * 1.2 + 0.4;
    months.push({
      month: `M${i + 1}`,
      current: +base.toFixed(1),
      scenario15: null,
    });
  }
  const lastVal = months[months.length - 1].current;
  for (let i = 0; i < 12; i++) {
    months.push({
      month: `M${25 + i}`,
      current: null as unknown as number,
      scenario15: +(lastVal - i * 0.6).toFixed(1),
    });
  }
  return months;
}

const FULL_DATA = buildData();

const RANGES = [
  { key: "all", label: "All" },
  { key: "24m", label: "24M" },
  { key: "12m", label: "12M" },
];

export default function TemperatureTimelineV4() {
  const [range, setRange] = useState("all");
  const [showScenario, setShowScenario] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    if (range === "12m") return FULL_DATA.slice(-12);
    if (range === "24m") return FULL_DATA.slice(-24);
    return FULL_DATA;
  }, [range]);

  return (
    <Card title="Portfolio Climate Risk Trend" description="Historical score with 1.5°C scenario projection" padding="md">
      <div className="flex flex-col gap-3" ref={containerRef}>
        <ChartToolbar
          ranges={RANGES}
          activeRange={range}
          onRangeChange={setRange}
          compareLabel="1.5°C projection"
          compareActive={showScenario}
          onToggleCompare={() => setShowScenario((v) => !v)}
          onExportCsv={() => exportCsv("portfolio-risk-trend", data)}
          onExportPng={() => containerRef.current && exportPng("portfolio-risk-trend", containerRef.current)}
        />
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#D9D9D9" }} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #D9D9D9", fontSize: 12, fontFamily: "var(--font-source-sans)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="current" name="Climate Risk Score" stroke="#0B3D91" strokeWidth={2} dot={false} connectNulls={false} />
            {showScenario && (
              <Line
                type="monotone"
                dataKey="scenario15"
                name="1.5°C Projection"
                stroke="#1E8E3E"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
              />
            )}
            <Brush dataKey="month" height={20} stroke="#0B3D91" travellerWidth={8} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
