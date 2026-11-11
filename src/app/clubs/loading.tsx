import { PageContainer } from "~/components/layout/page";
import { CardGridSkeleton, PageHeaderSkeleton, LoadingScreen } from "~/components/ui/skeleton";

export default function ClubsLoading() {
  return (
    <LoadingScreen>
      <PageContainer>
        <PageHeaderSkeleton />
        <CardGridSkeleton />
      </PageContainer>
    </LoadingScreen>
  );
}
