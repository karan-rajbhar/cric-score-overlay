import { ListPageSkeleton } from "~/components/ui/list-page-skeleton";

export default function SearchLoading() {
  return <ListPageSkeleton search sections={[3]} />;
}
