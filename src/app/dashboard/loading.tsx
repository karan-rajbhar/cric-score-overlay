import { PageContainer } from "~/components/layout/page";
import {
  LoadingScreen,
  MatchCardSkeleton,
  Skeleton,
} from "~/components/ui/skeleton";

/**
 * Home while it loads, shaped like Home (N32): the greeting with its round
 * buttons, the live card, then a section of match cards, so nothing jumps
 * when the page arrives.
 */
export default function DashboardLoading() {
  return (
    <LoadingScreen>
      <PageContainer>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-11 w-11 shrink-0 rounded-full md:hidden" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-full md:hidden" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-44" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        </div>
      </PageContainer>
    </LoadingScreen>
  );
}
