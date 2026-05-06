import { cn } from "@/lib/utils";

type Level = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";

const COLORS: Record<Level, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH:     "bg-orange-50 text-orange-700 border-orange-200",
  MEDIUM:   "bg-amber-50 text-amber-700 border-amber-200",
  LOW:      "bg-blue-50 text-blue-700 border-blue-200",
  MINIMAL:  "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const DOTS: Record<Level, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-500",
  MEDIUM:   "bg-amber-500",
  LOW:      "bg-blue-500",
  MINIMAL:  "bg-emerald-500",
};

export default function RiskBadgeT({ level }: { level: Level }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border",
      COLORS[level]
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", DOTS[level])} />
      {level}
    </span>
  );
}
