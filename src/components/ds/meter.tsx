import { cn } from "~/lib/utils";

/**
 * Scoreline's statistics block, as bars: each attribute is a navy bar on a
 * muted track with its value written out. Bars instead of a radar, because
 * radar areas exaggerate differences and are hard to read at a glance.
 */
export function MeterList({
  items,
  max = 100,
  className,
}: {
  items: readonly {
    label: string;
    /** Position on the 0..max scale (e.g. percentile). */
    value: number;
    /** What to print: "139.4", "82nd". Defaults to the value. */
    display?: string;
  }[];
  max?: number;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-4", className)}>
      {items.map((m) => {
        const pct = Math.max(0, Math.min(100, (m.value / max) * 100));
        return (
          <li key={m.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-score font-medium tabular-nums text-foreground">
                {m.display ?? m.value}
              </span>
            </div>
            <div
              role="meter"
              aria-label={m.label}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={m.value}
              aria-valuetext={m.display}
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
