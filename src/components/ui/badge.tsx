import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-border text-foreground",
        live: "border-destructive/30 bg-destructive/10 text-destructive [&::before]:mr-1.5 [&::before]:inline-block [&::before]:h-1.5 [&::before]:w-1.5 [&::before]:animate-pulse [&::before]:rounded-full [&::before]:bg-destructive [&::before]:content-['']",
        success: "border-primary/25 bg-primary/10 text-primary",
        warning: "border-gold/30 bg-gold/10 text-amber-800 dark:text-gold",
        violet: "border-border bg-muted text-foreground",
        magenta: "border-border bg-muted text-foreground",
        citrus: "border-gold/30 bg-gold/10 text-amber-800 dark:text-gold",
        sky: "border-border bg-muted text-foreground",
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
