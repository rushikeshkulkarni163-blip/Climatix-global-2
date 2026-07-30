"use client";

import Card from "@/components/ds/Card";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioFinancials } from "@/types/scenario-studio";

interface KPITileProps {
  label: string;
  value: string;
  accent?: boolean;
}

function KPITile({ label, value, accent }: KPITileProps) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 first:pl-0 last:pr-0">
      <span className="font-ds-body text-[11px] font-medium uppercase tracking-wide text-ds-muted">{label}</span>
      <span className={`font-ds-number text-[22px] font-bold ${accent ? "text-ds-accent" : "text-ds-text"}`}>{value}</span>
    </div>
  );
}

interface PortfolioKPIBarProps {
  portfolio: PortfolioFinancials;
}

function fmt(millions: number): string {
  return formatCurrency(millions * 1_000_000, "USD", true);
}

export default function PortfolioKPIBar({ portfolio }: PortfolioKPIBarProps) {
  return (
    <Card padding="none">
      <div className="grid grid-cols-2 divide-x divide-ds-border sm:grid-cols-3 lg:grid-cols-6">
        <KPITile label="Total revenue" value={fmt(portfolio.totalRevenueM)} />
        <KPITile label="Revenue at risk" value={fmt(portfolio.totalRevenueAtRiskM)} accent />
        <KPITile label="EBITDA at risk" value={fmt(portfolio.totalEbitdaAtRiskM)} accent />
        <KPITile label="Compliance cost" value={fmt(portfolio.totalComplianceCostM)} />
        <KPITile label="Climate VaR (95%)" value={fmt(portfolio.climateVaR95.valueAtRiskUsdM)} accent />
        <KPITile label="Asset value at risk" value={fmt(portfolio.totalAssetValueAtRiskM)} />
      </div>
    </Card>
  );
}
