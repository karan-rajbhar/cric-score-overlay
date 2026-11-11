import React from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Its heading's level: h2 when it is the first thing under a page's h1. */
  headingLevel?: "h2" | "h3";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  headingLevel: Heading = "h3",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl bg-card p-8 text-center shadow-soft ring-1 ring-border/40 dark:ring-border sm:p-12",
        className,
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>

      <Heading className="mb-1 text-base font-semibold text-foreground">
        {title}
      </Heading>

      <p className="mb-6 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {description}
      </p>

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryAction &&
            (primaryAction.href ? (
              <Button
                asChild
                variant={primaryAction.variant ?? "default"}
                className="gap-1.5"
              >
                <Link href={primaryAction.href}>
                  {primaryAction.icon && (
                    <primaryAction.icon className="h-4 w-4" />
                  )}
                  {primaryAction.label}
                </Link>
              </Button>
            ) : (
              <Button
                variant={primaryAction.variant ?? "default"}
                onClick={primaryAction.onClick}
                className="gap-1.5"
              >
                {primaryAction.icon && (
                  <primaryAction.icon className="h-4 w-4" />
                )}
                {primaryAction.label}
              </Button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Button
                asChild
                variant={secondaryAction.variant ?? "outline"}
                className="gap-1.5"
              >
                <Link href={secondaryAction.href}>
                  {secondaryAction.icon && (
                    <secondaryAction.icon className="h-4 w-4" />
                  )}
                  {secondaryAction.label}
                </Link>
              </Button>
            ) : (
              <Button
                variant={secondaryAction.variant ?? "outline"}
                onClick={secondaryAction.onClick}
                className="gap-1.5"
              >
                {secondaryAction.icon && (
                  <secondaryAction.icon className="h-4 w-4" />
                )}
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}
