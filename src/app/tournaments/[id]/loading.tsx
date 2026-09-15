import { Skeleton } from "~/components/ui/skeleton";

export default function TournamentDetailLoading() {
  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Back button & Header */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64 sm:w-80" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="grid grid-cols-2 gap-2 border-b border-border pb-2 sm:grid-cols-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>

      {/* Standings Table Skeleton */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="space-y-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 text-xs">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-t border-border/40 py-3"
            >
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex w-48 items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-5 w-14 font-bold" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
