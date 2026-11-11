import { LoadingScreen, Skeleton } from "~/components/ui/skeleton";

/** The sign-in page while it loads: its title and the Google card (N32). */
export default function LoginLoading() {
  return (
    <LoadingScreen className="flex min-h-[65vh] w-full items-center justify-center py-4 sm:py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="space-y-4 rounded-xl bg-card p-6 shadow-soft ring-1 ring-border/40 dark:ring-border">
          <Skeleton className="mx-auto h-4 w-52" />
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    </LoadingScreen>
  );
}
