import { PageContainer } from "~/components/layout/page";
import {
  MatchCardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "~/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <Skeleton className="h-56 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-[74px] rounded-xl" />
        <Skeleton className="h-[74px] rounded-xl" />
        <Skeleton className="h-[74px] rounded-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MatchCardSkeleton />
          <MatchCardSkeleton />
          <MatchCardSkeleton />
        </div>
      </div>
    </PageContainer>
  );
}
