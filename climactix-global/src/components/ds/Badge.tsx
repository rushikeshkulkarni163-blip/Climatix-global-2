"use client";

import { cn } from "@/lib/utils";

export type RatingGrade = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC";
export type StatusKind = "success" | "warning" | "critical" | "info" | "neutral";

const RATING_STATUS: Record<RatingGrade, StatusKind> = {
  AAA: "success",
  AA: "success",
  A: "success",
  BBB: "warning",
  BB: "warning",
  B: "critical",
  CCC: "critical",
};

const STATUS_CLASSES: Record<StatusKind, string> = {
  success: "bg-ds-success-bg text-ds-success border-ds-success/30",
  warning: "bg-ds-warning-bg text-ds-warning border-ds-warning/30",
  critical: "bg-ds-critical-bg text-ds-critical border-ds-critical/30",
  info: "bg-ds-accent-bg text-ds-accent border-ds-accent/30",
  neutral: "bg-ds-surface text-ds-text2 border-ds-border",
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
  lg: "px-3 py-1.5 text-[12px]",
};

interface BadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}

interface RatingBadgeProps extends BadgeProps {
  rating: RatingGrade;
}

interface StatusBadgeProps extends BadgeProps {
  status: StatusKind;
  label: string;
}

export function RatingBadge({ rating, size = "md", className }: RatingBadgeProps) {
  return (
    <span
      role="status"
      aria-label={`Rating: ${rating}`}
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-ds-heading font-bold uppercase tracking-wide",
        STATUS_CLASSES[RATING_STATUS[rating]],
        SIZE_CLASSES[size],
        className
      )}
    >
      {rating}
    </span>
  );
}

export default function Badge({ status, label, size = "md", className }: StatusBadgeProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-ds-body font-medium uppercase tracking-wide",
        STATUS_CLASSES[status],
        SIZE_CLASSES[size],
        className
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
