import type * as React from "react";
import { cn } from "~/lib/utils";

const TONE = {
  default: "text-foreground",
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-rose-700 dark:text-rose-400",
} as const;

/**
 * A single labelled figure (matches played, runs, wins...). `bordered`
 * draws it as its own small card; leave it off inside an existing card.
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
        bordered && "rounded-lg border border-border bg-card p-3 sm:p-4",
        className,
      )}
    >
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-xl font-bold tabular-nums leading-tight sm:text-2xl",
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
