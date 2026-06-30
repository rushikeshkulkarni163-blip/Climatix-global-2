"use client";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export default function Card({
  title,
  description,
  action,
  hoverable = false,
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-ds-card border border-ds-border rounded-lg",
        "transition-colors duration-150 ease-out",
        hoverable && "hover:border-ds-accent",
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          {title && (
            <div>
              <h3 className="font-ds-heading text-[18px] font-bold leading-tight text-ds-text">
                {title}
              </h3>
              {description && (
                <p className="mt-1 font-ds-body text-[13px] text-ds-muted">{description}</p>
              )}
            </div>
          )}
          {action}
        </div>
      )}
      <div className={PADDING_CLASSES[padding]}>{children}</div>
    </div>
  );
}
