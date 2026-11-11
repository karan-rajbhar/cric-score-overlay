import { PageContainer } from "~/components/layout/page";
import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  LoadingScreen,
} from "~/components/ui/skeleton";

export default function PlayersLoading() {
  return (
    <LoadingScreen>
      <PageContainer>
        <PageHeaderSkeleton action={false} />
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <CardGridSkeleton count={9} />
      </PageContainer>
    </LoadingScreen>
  );
}
