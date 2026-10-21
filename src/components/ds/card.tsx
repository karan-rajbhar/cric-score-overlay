import type * as React from "react";
import { cn } from "~/lib/utils";

/** The card surface: white, 18 px radius, soft shadow (hairline in dark). */
export const cardSurface =
  "rounded-xl bg-card text-card-foreground shadow-soft ring-1 ring-border/40 dark:ring-border";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardSurface, className)} {...props} />;
}

/** Title row of a card: title, optional description, action on the right. */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 p-4 sm:p-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
