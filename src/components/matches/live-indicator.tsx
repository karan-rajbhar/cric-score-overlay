import { cn } from "~/lib/utils";

/** The app's single live marker: a small red dot plus the word "Live". */
export function LiveIndicator({
  className,
  label = "Live",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-500",
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse dark:bg-red-500"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
