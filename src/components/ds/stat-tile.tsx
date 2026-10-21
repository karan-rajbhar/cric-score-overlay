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
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl bg-muted p-4", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-3 font-score text-[1.75rem] font-medium tabular-nums leading-none text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 truncate text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}

/** Two tiles per row on phones, four from tablets up. */
export function StatGrid({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}
      {...props}
    />
  );
}
