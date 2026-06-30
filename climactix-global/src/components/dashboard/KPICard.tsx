"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import Card from "@/components/ds/Card";
import Badge from "@/components/ds/Badge";
import Dialog from "@/components/ds/Dialog";
import Tooltip from "@/components/ds/Tooltip";
import { formatKPIValue, getKPIStatus } from "@/lib/dashboard/format";
import type { KPIDefinition } from "@/lib/dashboard/mockData";

const STATUS_HEX: Record<string, string> = {
  success: "#1E8E3E",
  warning: "#B45309",
  critical: "#DC2626",
};

interface KPICardProps {
  kpi: KPIDefinition;
  multiplier: number;
}

export default function KPICard({ kpi, multiplier }: KPICardProps) {
  const [open, setOpen] = useState(false);
  const value = kpi.baseValue * multiplier;
  const sparkline = kpi.sparkline.map((v, i) => ({ i, v: i === kpi.sparkline.length - 1 ? value : v * multiplier }));
  const status = getKPIStatus(value, kpi.benchmark, kpi.upIsBad);
  const changePct = ((sparkline[sparkline.length - 1].v - sparkline[0].v) / sparkline[0].v) * 100;
  const trendUp = changePct > 0.5;
  const trendDown = changePct < -0.5;
  const TrendIcon = trendUp ? TrendingUp : trendDown ? TrendingDown : Minus;
  const trendIsBad = (trendUp && kpi.upIsBad) || (trendDown && !kpi.upIsBad);

  return (
    <>
      <Card
        hoverable
        padding="sm"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
        aria-label={`${kpi.label}: ${formatKPIValue(kpi.format, value)}. Click for details.`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-ds-body text-[12px] font-medium uppercase tracking-wide text-ds-muted">
            {kpi.label}
          </span>
          <Badge status={status} label={status} size="sm" />
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="font-ds-number text-[28px] font-bold leading-none tracking-tight text-ds-text">
            {formatKPIValue(kpi.format, value)}
          </span>
          <div className="h-9 w-20 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`spark-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STATUS_HEX[status]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={STATUS_HEX[status]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={STATUS_HEX[status]}
                  strokeWidth={1.5}
                  fill={`url(#spark-${kpi.id})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between font-ds-body text-[11px] text-ds-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <Tooltip label={`Benchmark: ${formatKPIValue(kpi.format, kpi.benchmark)}`}>
            <span className="flex items-center gap-1" style={{ color: trendIsBad ? "#DC2626" : "#1E8E3E" }}>
              <TrendIcon size={11} />
              {Math.abs(changePct).toFixed(1)}%
            </span>
          </Tooltip>
          <span>Confidence {kpi.confidence}%</span>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={kpi.label}
        description={`Current value ${formatKPIValue(kpi.format, value)} · Benchmark ${formatKPIValue(
          kpi.format,
          kpi.benchmark
        )} · Confidence ${kpi.confidence}%`}
      >
        <div className="flex flex-col gap-3">
          <p className="font-ds-body text-[13px] font-semibold text-ds-text2">Reasoning</p>
          <ul className="flex flex-col gap-2">
            {kpi.reasoning.map((line, i) => (
              <li key={i} className="flex gap-2 font-ds-body text-[14px] text-ds-text">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ds-accent" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    </>
  );
}
