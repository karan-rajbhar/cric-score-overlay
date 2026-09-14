import { cn } from "~/lib/utils";

/**
 * Platform brand: cricket-ball mark (circle with seam) on a pitch-green tile.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm ring-1 ring-emerald-400/30 transition-transform duration-200 hover:scale-105 active:scale-95",
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

export function BrandWordmark() {
  return (
    <span className="flex items-center gap-1 font-score text-xl font-extrabold tracking-tight text-foreground">
      <span>CricScore</span>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </span>
  );
}
