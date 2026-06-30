"use client";

import * as RadixProgress from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  label?: string;
  variant?: "accent" | "success" | "warning" | "critical";
  className?: string;
}

const VARIANT_CLASSES = {
  accent: "bg-ds-accent",
  success: "bg-ds-success",
  warning: "bg-ds-warning",
  critical: "bg-ds-critical",
};

export default function Progress({ value, label, variant = "accent", className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between font-ds-body text-[12px] text-ds-text2">
          <span>{label}</span>
          <span className="font-medium text-ds-text">{Math.round(clamped)}%</span>
        </div>
      )}
      <RadixProgress.Root
        value={clamped}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-ds-surface"
      >
        <RadixProgress.Indicator
          className={cn("h-full transition-transform duration-200 ease-out", VARIANT_CLASSES[variant])}
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </RadixProgress.Root>
    </div>
  );
}
