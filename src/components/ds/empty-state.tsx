import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * Nothing here yet: what would be here, why, and the one action that fills
 * it (pass a Button or a Link styled as one).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-soft ring-1 ring-border/40 dark:ring-border",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-balance text-base font-semibold text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
