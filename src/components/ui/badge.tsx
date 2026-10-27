import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

/*
 * The design system's chip (`~/components/ds/chip`: fixed 24px height,
 * soft tones, colour only for state), so a Badge anywhere looks like the
 * chips on /design.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-transparent font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary-soft-foreground",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border-border bg-card text-foreground",
        // The red live pill; its white dot is the app's only pulse.
        live: "bg-live font-semibold text-live-foreground [&::before]:mr-0.5 [&::before]:inline-block [&::before]:h-1.5 [&::before]:w-1.5 [&::before]:animate-pulse [&::before]:rounded-full [&::before]:bg-live-foreground [&::before]:content-[''] motion-reduce:[&::before]:animate-none",
        success: "bg-success/10 text-success",
        loss: "bg-destructive/10 text-destructive",
        warning: "bg-warning/10 text-warning",
      },
      // The ds chip's sizes: "sm" for dense rows (the scoring HUD).
      size: {
        md: "h-6 px-2.5 text-xs",
        sm: "h-5 px-2 text-2xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
