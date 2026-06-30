import { formatCurrency } from "@/lib/utils";
import type { KPIFormat } from "./mockData";

export function formatKPIValue(format: KPIFormat, value: number): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, "USD", true);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "index":
      return Math.round(value).toString();
    case "score":
    default:
      return Math.round(value).toString();
  }
}

export type KPIStatusKind = "success" | "warning" | "critical";

export function getKPIStatus(value: number, benchmark: number, upIsBad: boolean): KPIStatusKind {
  const ratio = benchmark === 0 ? 1 : value / benchmark;
  if (upIsBad) {
    if (ratio <= 1.0) return "success";
    if (ratio <= 1.2) return "warning";
    return "critical";
  }
  if (ratio >= 1.0) return "success";
  if (ratio >= 0.85) return "warning";
  return "critical";
}
