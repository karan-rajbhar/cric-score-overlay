import { Skeleton } from "~/components/ui/skeleton";

export default function PlayerDetailLoading() {
  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
      <Skeleton className="h-8 w-24 rounded-lg" />

      {/* Player Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      {/* Batting Stats Grid */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-xl border border-border bg-card p-4 text-center"
            >
              <Skeleton className="mx-auto h-7 w-12" />
              <Skeleton className="mx-auto h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Bowling Stats Grid */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-xl border border-border bg-card p-4 text-center"
            >
              <Skeleton className="mx-auto h-7 w-12" />
              <Skeleton className="mx-auto h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
