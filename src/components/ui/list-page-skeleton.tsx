import { PageContainer } from "~/components/layout/page";
import {
  LoadingScreen,
  PageHeaderSkeleton,
  Skeleton,
} from "~/components/ui/skeleton";

/** Rows of a list card while they load: avatar or icon, two lines. */
export function ListRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-border/40 dark:ring-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A narrow page of list sections (More, Search, Invites) while it loads:
 * its title, an optional search field, then sections of rows (N32).
 */
export function ListPageSkeleton({
  search = false,
  sections = [3, 2],
}: {
  search?: boolean;
  /** Rows in each section. */
  sections?: number[];
}) {
  return (
    <LoadingScreen>
      <PageContainer size="narrow">
        <PageHeaderSkeleton action={false} />
        {search && <Skeleton className="h-11 w-full rounded-full" />}
        {sections.map((rows, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <ListRowsSkeleton rows={rows} />
          </div>
        ))}
      </PageContainer>
    </LoadingScreen>
  );
}
