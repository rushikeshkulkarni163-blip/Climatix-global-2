"use client";

import { useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
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

interface YearRow {
  year: string;
  scope1: number;
  scope2: number;
  scope3: number;
  benchmark: number;
}

const FULL_DATA: YearRow[] = [
  { year: "2018", scope1: 420, scope2: 310, scope3: 980, benchmark: 1850 },
  { year: "2019", scope1: 410, scope2: 305, scope3: 960, benchmark: 1820 },
  { year: "2020", scope1: 380, scope2: 280, scope3: 870, benchmark: 1760 },
  { year: "2021", scope1: 395, scope2: 270, scope3: 900, benchmark: 1740 },
  { year: "2022", scope1: 370, scope2: 245, scope3: 860, benchmark: 1700 },
  { year: "2023", scope1: 350, scope2: 220, scope3: 820, benchmark: 1660 },
  { year: "2024", scope1: 330, scope2: 200, scope3: 790, benchmark: 1610 },
  { year: "2025", scope1: 312, scope2: 184, scope3: 760, benchmark: 1580 },
  { year: "2026", scope1: 298, scope2: 170, scope3: 735, benchmark: 1550 },
];

const RANGES = [
  { key: "all", label: "All" },
  { key: "5y", label: "5Y" },
  { key: "3y", label: "3Y" },
];

export default function EmissionsTrajectoryV4() {
  const [range, setRange] = useState("all");
  const [compareBenchmark, setCompareBenchmark] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    if (range === "5y") return FULL_DATA.slice(-5);
    if (range === "3y") return FULL_DATA.slice(-3);
    return FULL_DATA;
  }, [range]);

  return (
    <Card title="Emissions Trajectory" description="Scope 1 / 2 / 3 vs. sector benchmark" padding="md">
      <div className="flex flex-col gap-3" ref={containerRef}>
        <ChartToolbar
          ranges={RANGES}
          activeRange={range}
          onRangeChange={setRange}
          compareLabel="Sector benchmark"
          compareActive={compareBenchmark}
          onToggleCompare={() => setCompareBenchmark((v) => !v)}
          onExportCsv={() => exportCsv("emissions-trajectory", data)}
          onExportPng={() => containerRef.current && exportPng("emissions-trajectory", containerRef.current)}
        />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scope1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B3D91" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#0B3D91" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="scope2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E8E3E" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#1E8E3E" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="scope3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B45309" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#B45309" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#D9D9D9" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #D9D9D9", fontSize: 12, fontFamily: "var(--font-source-sans)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="scope1" name="Scope 1" stackId="s" stroke="#0B3D91" fill="url(#scope1)" />
            <Area type="monotone" dataKey="scope2" name="Scope 2" stackId="s" stroke="#1E8E3E" fill="url(#scope2)" />
            <Area type="monotone" dataKey="scope3" name="Scope 3" stackId="s" stroke="#B45309" fill="url(#scope3)" />
            {compareBenchmark && (
              <Area type="monotone" dataKey="benchmark" name="Sector benchmark" stroke="#6B7280" strokeDasharray="4 3" fill="none" />
            )}
            <Brush dataKey="year" height={20} stroke="#0B3D91" travellerWidth={8} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
