"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ds/Card";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import { RatingBadge } from "@/components/ds/Badge";
import { formatCurrency } from "@/lib/utils";
import { PORTFOLIO_COMPANIES, type PortfolioCompany } from "@/lib/dashboard/mockData";

const columns: DataTableColumn<PortfolioCompany>[] = [
  { key: "name", header: "Company", width: 240, accessor: (r) => r.name, sortValue: (r) => r.name },
  { key: "sector", header: "Sector", width: 180, accessor: (r) => r.sector, sortValue: (r) => r.sector },
  { key: "rating", header: "Rating", width: 100, accessor: (r) => <RatingBadge rating={r.rating} size="sm" />, sortValue: (r) => r.rating },
  { key: "climateRiskScore", header: "Climate Risk", width: 120, align: "right", accessor: (r) => r.climateRiskScore, sortValue: (r) => r.climateRiskScore },
  { key: "revenueAtRiskUSD", header: "Revenue at Risk", width: 150, align: "right", accessor: (r) => formatCurrency(r.revenueAtRiskUSD, "USD", true), sortValue: (r) => r.revenueAtRiskUSD },
];

export default function CompaniesPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-ds-heading text-[24px] font-bold text-ds-text">Companies</h1>
        <p className="mt-1 font-ds-body text-[13px] text-ds-muted">
          All portfolio holdings with climate risk intelligence. Select a company for its full profile.
        </p>
      </div>
      <Card padding="md">
        <Table
          columns={columns}
          data={PORTFOLIO_COMPANIES}
          getRowId={(r) => r.id}
          exportFilename="companies"
          onRowClick={(row) => router.push(`/dashboard/companies/${row.id}`)}
        />
      </Card>
    </div>
  );
}
