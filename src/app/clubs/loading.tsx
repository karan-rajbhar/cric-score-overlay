import { PageContainer } from "~/components/layout/page";
import { CardGridSkeleton, PageHeaderSkeleton } from "~/components/ui/skeleton";

export default function ClubsLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <CardGridSkeleton />
    </PageContainer>
  );
}
