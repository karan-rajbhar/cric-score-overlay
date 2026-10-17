import { cn } from "~/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}

/**
 * Skeleton for standard Match Card
 */
export function MatchCardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-3 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/50 pt-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}

/** Placeholder for <PageHeader>: title, description and one action. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-full rounded-lg sm:w-32" />}
    </div>
  );
}

/** Grid of generic list cards (clubs, teams, players, tournaments). */
export function CardGridSkeleton({
  count = 6,
  className = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
