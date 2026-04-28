import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse bg-gray-200 rounded-lg", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card space-y-4">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-32 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card">
      <Skeleton className="h-5 w-1/3 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card">
      <Skeleton className="h-5 w-1/4 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
