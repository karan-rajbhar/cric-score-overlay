import type * as React from "react";
import { cn } from "~/lib/utils";

const TONE = {
  default: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
} as const;

/**
 * A single labelled figure (matches played, runs, wins...) on a muted tile.
 * `bordered` (the default) draws the tile; leave it off inside an existing
 * card to show the bare figure.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  bordered = true,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: keyof typeof TONE;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        bordered && "rounded-xl bg-muted p-3.5 sm:p-4",
        className,
      )}
    >
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1.5 font-score text-xl font-semibold tabular-nums leading-tight sm:text-2xl",
          TONE[tone],
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}
