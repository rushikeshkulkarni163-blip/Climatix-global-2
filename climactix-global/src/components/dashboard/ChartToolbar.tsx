"use client";

import { Download, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RangeOption {
  key: string;
  label: string;
}

interface ChartToolbarProps {
  ranges: RangeOption[];
  activeRange: string;
  onRangeChange: (key: string) => void;
  compareLabel?: string;
  compareActive?: boolean;
  onToggleCompare?: () => void;
  onExportCsv: () => void;
  onExportPng: () => void;
}

export default function ChartToolbar({
  ranges,
  activeRange,
  onRangeChange,
  compareLabel,
  compareActive,
  onToggleCompare,
  onExportCsv,
  onExportPng,
}: ChartToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-ds-border bg-ds-surface p-1">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => onRangeChange(r.key)}
            className={cn(
              "rounded-md px-2.5 py-1 font-ds-body text-[12px] font-medium transition-colors duration-150",
              activeRange === r.key ? "bg-ds-accent text-white" : "text-ds-text2 hover:text-ds-text"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {compareLabel && onToggleCompare && (
          <label className="flex items-center gap-1.5 font-ds-body text-[12px] text-ds-text2">
            <input
              type="checkbox"
              checked={compareActive}
              onChange={onToggleCompare}
              className="h-3.5 w-3.5 accent-[#0B3D91]"
            />
            {compareLabel}
          </label>
        )}
        <button
          onClick={onExportCsv}
          aria-label="Export CSV"
          className="rounded-md p-1.5 text-ds-muted hover:bg-ds-surface hover:text-ds-text"
        >
          <Download size={14} />
        </button>
        <button
          onClick={onExportPng}
          aria-label="Export image"
          className="rounded-md p-1.5 text-ds-muted hover:bg-ds-surface hover:text-ds-text"
        >
          <ImageIcon size={14} />
        </button>
      </div>
    </div>
  );
}
