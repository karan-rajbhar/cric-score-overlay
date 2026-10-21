import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border bg-card text-foreground",
        // The red live pill; its white dot is the app's only pulse.
        live: "border-transparent bg-live font-semibold text-live-foreground [&::before]:mr-1.5 [&::before]:inline-block [&::before]:h-1.5 [&::before]:w-1.5 [&::before]:animate-pulse [&::before]:rounded-full [&::before]:bg-live-foreground [&::before]:content-[''] motion-reduce:[&::before]:animate-none",
        success: "border-transparent bg-success/10 text-success",
        loss: "border-transparent bg-destructive/10 text-destructive",
        warning: "border-transparent bg-warning/10 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
