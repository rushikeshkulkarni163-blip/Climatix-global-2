import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  change?: string;
  trend?: "up" | "down" | "flat";
  /** up = bad (red), down = good (green), or explicit color */
  upIsBad?: boolean;
  accent?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function MetricCard({
  label,
  value,
  sub,
  change,
  trend,
  upIsBad = false,
  className,
  size = "md",
}: MetricCardProps) {
  const trendColor = trend === "flat"
    ? "text-gray-400"
    : trend === "up"
    ? upIsBad ? "text-red-500" : "text-emerald-500"
    : upIsBad ? "text-emerald-500" : "text-red-500";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className={cn(
      "bg-white border border-gray-200 p-4 hover:border-gray-300 transition-colors",
      className
    )}>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-2">{label}</div>
      <div className={cn(
        "font-bold text-gray-900 leading-none mb-1",
        size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl"
      )}>
        {value}
      </div>
      {(change || sub) && (
        <div className="flex items-center gap-2 mt-1.5">
          {change && trend && (
            <div className={cn("flex items-center gap-1 text-[11px] font-semibold", trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {change}
            </div>
          )}
          {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
        </div>
      )}
    </div>
  );
}
