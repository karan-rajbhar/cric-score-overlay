import { cn } from "~/lib/utils";

/**
 * Platform brand: three stumps and a split bail, rounded, on a tile in the
 * design system's brand blue (`--brand`, the logo's own colour; lighter in
 * dark mode). Same 32-unit grid as src/app/icon.svg and the app icons
 * (source in branding/stumps/).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[28%] bg-brand text-brand-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 32 32"
        className="h-full w-full"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="8" y="10.5" width="4" height="15.5" rx="2" />
        <rect x="14" y="10.5" width="4" height="15.5" rx="2" />
        <rect x="20" y="10.5" width="4" height="15.5" rx="2" />
        <rect x="8" y="6.5" width="7" height="2" rx="1" />
        <rect x="17" y="6.5" width="7" height="2" rx="1" />
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
