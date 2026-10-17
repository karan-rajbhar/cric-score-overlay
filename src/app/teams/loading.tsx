import { PageContainer } from "~/components/layout/page";
import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "~/components/ui/skeleton";

export default function TeamsLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="h-10 w-full rounded-lg sm:w-48" />
        <Skeleton className="h-9 w-full rounded-lg sm:max-w-sm" />
      </div>
      <CardGridSkeleton />
    </PageContainer>
  );
}
