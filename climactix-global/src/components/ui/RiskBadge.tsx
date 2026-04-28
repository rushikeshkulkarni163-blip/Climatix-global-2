import { cn, getRiskBgClass } from "@/lib/utils";
import type { ClimateRiskScore } from "@/types";

interface RiskBadgeProps {
  rating: ClimateRiskScore["riskRating"];
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function RiskBadge({ rating, size = "md", className }: RiskBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-2xs tracking-widest",
    md: "px-3 py-1 text-xs tracking-widest",
    lg: "px-4 py-1.5 text-sm tracking-wider",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-bold uppercase border",
        getRiskBgClass(rating),
        sizeClasses[size],
        className
      )}
      aria-label={`Risk rating: ${rating}`}
    >
      {rating}
    </span>
  );
}
