"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  label: string;
  side?: "top" | "bottom";
  className?: string;
  children: React.ReactNode;
}

export default function Tooltip({ label, side = "top", className, children }: TooltipProps) {
  const id = useId();

  return (
    <span className={cn("group relative inline-flex", className)}>
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-md",
          "bg-ds-text px-2 py-1 font-ds-body text-[11px] text-white opacity-0",
          "transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        )}
      >
        {label}
      </span>
    </span>
  );
}
