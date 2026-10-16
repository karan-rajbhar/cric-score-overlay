import { PageContainer } from "~/components/layout/page";
import {
  MatchCardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "~/components/ui/skeleton";

export default function MatchesLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="h-9 w-full rounded-lg sm:max-w-xs" />
        <Skeleton className="h-10 w-full rounded-lg sm:w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    </PageContainer>
  );
}
