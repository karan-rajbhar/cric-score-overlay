import { cn } from "~/lib/utils";

/**
 * Platform brand: cricket-ball mark (circle with seam) on a pitch-green tile.
 */
export function BrandMark({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
                className
            )}
        >
            <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="9" />
                <path d="M7.5 4.2c-2.2 4.8-2.2 10.8 0 15.6" />
                <path d="M16.5 4.2c2.2 4.8 2.2 10.8 0 15.6" />
                <path d="M12 3.2v1.6M12 19.2v1.6" strokeWidth="1.4" />
            </svg>
        </span>
    );
}

export function BrandWordmark() {
    return (
        <span className="font-score text-lg font-semibold uppercase tracking-wide">
            Cric<span className="text-primary">Score</span>
        </span>
    );
}
