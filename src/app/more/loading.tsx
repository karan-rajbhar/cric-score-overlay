import { ListPageSkeleton } from "~/components/ui/list-page-skeleton";

export default function MoreLoading() {
  return <ListPageSkeleton sections={[1, 4, 3]} />;
}
