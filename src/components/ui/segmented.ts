import { cn } from "~/lib/utils";

/*
 * Class helpers for segmented filters (status filters, "My / All" toggles)
 * built from plain buttons or links. They match the look of <TabsList>.
 */
export const segmentedTrack =
  "no-scrollbar flex w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:inline-flex sm:w-auto";

export function segmentedItem(active: boolean, className?: string) {
  return cn(
    "flex min-h-9 flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors sm:min-h-8 sm:flex-none",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
    className,
  );
}
