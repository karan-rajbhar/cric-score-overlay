import { cn } from "~/lib/utils";

/**
 * Platform brand: three stumps and a split bail chalked onto a
 * scoreboard-green tile. Same 32-unit grid as src/app/icon.svg
 * (source and alternatives in branding/).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-board text-board-foreground ring-1 ring-inset ring-board-line",
        className,
      )}
    >
      <svg
        viewBox="0 0 32 32"
        className="h-full w-full"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="8" y="10" width="4" height="16" rx="0.5" />
        <rect x="14" y="10" width="4" height="16" rx="0.5" />
        <rect x="20" y="10" width="4" height="16" rx="0.5" />
        <rect x="8" y="6" width="7" height="2" rx="0.5" />
        <rect x="17" y="6" width="7" height="2" rx="0.5" />
      </svg>
    </span>
  );
}

/** Wordmark; the trailing dot is the red ball. */
export function BrandWordmark() {
  return (
    <span className="flex items-baseline gap-1 font-score text-[22px] font-bold leading-none text-foreground">
      <span>CricScore</span>
      <span className="h-1.5 w-1.5 rounded-full bg-ruby" aria-hidden="true" />
    </span>
  );
}
