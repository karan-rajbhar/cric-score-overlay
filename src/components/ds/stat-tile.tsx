import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * One labelled figure on a muted tile, as on Scoreline's player page: a
 * small icon and the label on top, the figure large below it.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  compact = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** On phones: the figure over its label, in a `StatGrid compact` row. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl bg-muted p-4",
        compact &&
          "max-md:flex max-md:flex-col-reverse max-md:items-center max-md:gap-1 max-md:px-1 max-md:py-2",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          compact && "max-md:max-w-full",
        )}
      >
        {Icon && (
          <Icon
            className={cn("h-3.5 w-3.5 shrink-0", compact && "max-md:hidden")}
            aria-hidden="true"
          />
        )}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-3 font-score text-[1.75rem] font-medium tabular-nums leading-none text-foreground",
          compact && "max-md:mt-0 max-md:text-xl",
        )}
      >
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "mt-1.5 truncate text-xs text-muted-foreground",
            compact && "max-md:hidden",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * Two tiles per row on phones, four from tablets up. `compact`: all four in
 * one row on phones, for figures above a screen's tabs, where two rows would
 * push the tabs off the first screen (with `StatTile compact`).
 */
export function StatGrid({
  compact = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4",
        compact && "max-md:grid-cols-4 max-md:gap-2",
        className,
      )}
      {...props}
    />
  );
}
