import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

/* Small rounded labels: status, format, role. Colour only when it is state. */
const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        primary: "bg-primary-soft text-primary-soft-foreground",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        danger: "bg-destructive/10 text-destructive",
        outline: "border border-border bg-card text-foreground",
      },
      size: {
        sm: "h-5 px-2 text-2xs",
        md: "h-6 px-2.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

export function Chip({ className, tone, size, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone, size }), className)} {...props} />
  );
}

/**
 * The live marker: a red pill with the app's only pulsing dot. `quiet` drops
 * the fill for dense lists (a red dot and the word).
 */
export function LiveChip({
  label = "Live",
  quiet = false,
  className,
}: {
  label?: string;
  quiet?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold leading-none",
        quiet ? "text-live" : "h-6 bg-live px-2.5 text-live-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-pulse",
          quiet ? "bg-live" : "bg-live-foreground",
        )}
      />
      {label}
    </span>
  );
}

const MATCH_STATUS: Record<
  string,
  { label: string; tone: NonNullable<ChipProps["tone"]> }
> = {
  scheduled: { label: "Upcoming", tone: "primary" },
  innings_break: { label: "Innings break", tone: "warning" },
  completed: { label: "Result", tone: "neutral" },
  abandoned: { label: "Abandoned", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "warning" },
};

/** One chip per match status, so every list and header says it the same way. */
export function MatchStatusChip({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  if (status === "live") return <LiveChip className={className} />;
  const s = MATCH_STATUS[status] ?? { label: status, tone: "outline" };
  return (
    <Chip tone={s.tone} className={className}>
      {s.label}
    </Chip>
  );
}
