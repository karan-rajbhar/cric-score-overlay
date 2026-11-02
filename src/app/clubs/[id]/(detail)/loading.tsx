import { TabSkeleton } from "~/components/ui/on-demand-tabs";

/**
 * A tab opening. The page's own loading screen is one level up, above this
 * group's layout: a prefetch stops at the first one, so it must not run the
 * layout's reads.
 */
export default function Loading() {
  return <TabSkeleton />;
}
