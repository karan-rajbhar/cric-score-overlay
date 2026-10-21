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
        "inline-flex items-center gap-1.5 text-xs font-semibold text-live",
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-live motion-safe:animate-pulse"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
