import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DataPanelProps {
  title?: string;
  label?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  noPad?: boolean;
}

export default function DataPanel({ title, label, children, action, className, noPad }: DataPanelProps) {
  return (
    <div className={cn("bg-white border border-gray-200", className)}>
      {(title || label || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {label && (
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em]">
                {label}
              </span>
            )}
            {title && (
              <span className="text-xs font-bold text-gray-800">{title}</span>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPad ? "" : "p-4"}>{children}</div>
    </div>
  );
}
