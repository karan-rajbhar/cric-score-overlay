import { cn } from "~/lib/utils";

/**
 * Platform brand: cricket-ball mark (circle with seam) chalked onto a
 * scoreboard-green tile.
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
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M7.5 4.2c-2.2 4.8-2.2 10.8 0 15.6" />
        <path d="M16.5 4.2c2.2 4.8 2.2 10.8 0 15.6" />
        <path d="M12 3.2v1.6M12 19.2v1.6" strokeWidth="1.6" />
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
