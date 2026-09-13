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
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 p-8 text-center sm:p-12",
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
        <Icon className="h-7 w-7" />
      </div>

      <h3 className="mb-1 text-base font-bold text-foreground sm:text-lg">
        {title}
      </h3>

      <p className="mb-6 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {description}
      </p>

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryAction &&
            (primaryAction.href ? (
              <Button
                asChild
                size="sm"
                variant={primaryAction.variant ?? "default"}
                className="interactive-button gap-1.5"
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
                size="sm"
                variant={primaryAction.variant ?? "default"}
                onClick={primaryAction.onClick}
                className="interactive-button gap-1.5"
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
                size="sm"
                variant={secondaryAction.variant ?? "outline"}
                className="interactive-button gap-1.5"
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
                size="sm"
                variant={secondaryAction.variant ?? "outline"}
                onClick={secondaryAction.onClick}
                className="interactive-button gap-1.5"
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
