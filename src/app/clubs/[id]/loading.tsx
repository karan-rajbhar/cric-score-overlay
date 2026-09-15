import { Skeleton } from "~/components/ui/skeleton";

export default function ClubDetailLoading() {
  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      {/* Back button */}
      <Skeleton className="h-8 w-28 rounded-lg" />

      {/* Club Hero Card */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-52 sm:w-64" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 border-b border-border pb-2 min-[540px]:grid-cols-3 sm:grid-cols-5">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="col-span-2 h-9 w-full rounded-lg min-[540px]:col-span-2 sm:col-span-1" />
      </div>

      {/* Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-4 rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-44" />
            <div className="flex justify-between border-t border-border/50 pt-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
