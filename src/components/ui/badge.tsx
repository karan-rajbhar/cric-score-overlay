import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
        live: "border-destructive/30 bg-destructive/10 text-destructive [&::before]:mr-1.5 [&::before]:inline-block [&::before]:h-1.5 [&::before]:w-1.5 [&::before]:animate-pulse motion-reduce:[&::before]:animate-none [&::before]:rounded-full [&::before]:bg-destructive [&::before]:content-['']",
        success: "border-primary/25 bg-primary/10 text-primary",
        loss: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
        warning: "border-gold/30 bg-gold/10 text-amber-800 dark:text-gold",
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
