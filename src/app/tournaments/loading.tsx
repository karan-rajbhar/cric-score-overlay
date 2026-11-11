import { PageContainer } from "~/components/layout/page";
import { CardGridSkeleton, PageHeaderSkeleton, LoadingScreen } from "~/components/ui/skeleton";

export default function TournamentsLoading() {
  return (
    <LoadingScreen>
      <PageContainer>
        <PageHeaderSkeleton />
        <CardGridSkeleton count={4} className="md:grid-cols-2" />
      </PageContainer>
    </LoadingScreen>
  );
}
