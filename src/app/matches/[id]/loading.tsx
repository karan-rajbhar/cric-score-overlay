import { Skeleton } from "~/components/ui/skeleton";

export default function MatchDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky top sub-header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Scorecard Header */}
      <div className="border-b border-border bg-card/60">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="mx-auto mb-6 flex justify-center">
            <Skeleton className="h-4 w-52" />
          </div>

          <div className="flex items-center justify-between gap-4 sm:gap-8">
            {/* Team 1 */}
            <div className="flex flex-1 flex-col items-end gap-2 text-right">
              <Skeleton className="h-7 w-36 sm:w-44" />
              <Skeleton className="h-9 w-24 sm:w-28" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* VS Badge */}
            <div className="flex flex-col items-center justify-center px-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="mt-2 h-3 w-12" />
            </div>

            {/* Team 2 */}
            <div className="flex flex-1 flex-col items-start gap-2 text-left">
              <Skeleton className="h-7 w-36 sm:w-44" />
              <Skeleton className="h-9 w-24 sm:w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>

          {/* Result banner skeleton */}
          <div className="mx-auto mt-6 flex justify-center">
            <Skeleton className="h-6 w-72 rounded-full" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-b border-border bg-card/40">
        <div className="container mx-auto max-w-5xl px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 flex-shrink-0 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border/50 py-2"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
