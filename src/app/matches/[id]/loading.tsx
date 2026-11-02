import { Skeleton } from "~/components/ui/skeleton";

/** The match page before its data: the same shape, so nothing jumps. */
export default function MatchDetailLoading() {
  return (
    <div className="-mx-4 -mt-5 min-h-screen sm:-mx-6 sm:-mt-8 lg:-mx-8">
      {/* Header */}
      <div className="container mx-auto px-4 pb-9 pt-3 sm:px-6 md:pb-4 md:pt-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="mx-auto mt-3 h-5 w-52" />
        </div>
      </div>

      {/* Tabs and content */}
      <div className="container mx-auto space-y-4 px-4 md:py-6">
        <div className="flex gap-1 pb-2 pt-1.5 sm:gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 flex-1 rounded-full md:h-9" />
          ))}
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
