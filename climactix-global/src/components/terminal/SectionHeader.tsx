import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionHeaderProps {
  label: string;
  title: string;
  action?: ReactNode;
  className?: string;
}

export default function SectionHeader({ label, title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between mb-5", className)}>
      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">{label}</div>
        <h2 className="text-base font-bold text-gray-900 tracking-tight">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
