import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  rows?: number;
}

export default function Skeleton({ className, rows = 1 }: SkeletonProps) {
  if (rows > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={cn("h-4 animate-pulse rounded-md bg-ds-surface", className)}
          />
        ))}
      </div>
    );
  }

  return <div className={cn("h-4 animate-pulse rounded-md bg-ds-surface", className)} />;
}
