"use client";

import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Card from "@/components/ds/Card";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import { RatingBadge } from "@/components/ds/Badge";
import { formatCurrency } from "@/lib/utils";
import { PORTFOLIO_COMPANIES, type PortfolioCompany } from "@/lib/dashboard/mockData";

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };

const columns: DataTableColumn<PortfolioCompany>[] = [
  {
    key: "name",
    header: "Company",
    width: 220,
    accessor: (row) => row.name,
    sortValue: (row) => row.name,
  },
  {
    key: "sector",
    header: "Sector",
    width: 170,
    accessor: (row) => row.sector,
    sortValue: (row) => row.sector,
  },
  {
    key: "rating",
    header: "Rating",
    width: 100,
    accessor: (row) => <RatingBadge rating={row.rating} size="sm" />,
    sortValue: (row) => row.rating,
  },
  {
    key: "climateRiskScore",
    header: "Climate Risk",
    width: 120,
    align: "right",
    accessor: (row) => row.climateRiskScore,
    sortValue: (row) => row.climateRiskScore,
  },
  {
    key: "revenueAtRiskUSD",
    header: "Revenue at Risk",
    width: 150,
    align: "right",
    accessor: (row) => formatCurrency(row.revenueAtRiskUSD, "USD", true),
    sortValue: (row) => row.revenueAtRiskUSD,
  },
  {
    key: "trend",
    header: "Trend",
    width: 90,
    align: "right",
    accessor: (row) => {
      const Icon = TREND_ICON[row.trend];
      return (
        <span
          className="inline-flex items-center gap-1"
          style={{ color: row.trend === "up" ? "#DC2626" : row.trend === "down" ? "#1E8E3E" : "#6B7280" }}
        >
          <Icon size={13} />
        </span>
      );
    },
    sortValue: (row) => row.trend,
  },
];

export default function PortfolioTable() {
  const router = useRouter();

  return (
    <Card title="Portfolio Companies" description="Click a row to open the company profile" padding="md">
      <Table
        columns={columns}
        data={PORTFOLIO_COMPANIES}
        getRowId={(row) => row.id}
        exportFilename="portfolio-companies"
        onRowClick={(row) => router.push(`/dashboard/companies/${row.id}`)}
      />
    </Card>
  );
}
