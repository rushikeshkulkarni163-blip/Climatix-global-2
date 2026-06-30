import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ds-border bg-ds-surface px-6 py-12 text-center",
        className
      )}
    >
      <Icon size={28} className="text-ds-muted" aria-hidden="true" />
      <div>
        <p className="font-ds-heading text-[15px] font-bold text-ds-text">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm font-ds-body text-[13px] text-ds-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
