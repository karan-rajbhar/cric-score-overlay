import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        live: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 [&::before]:mr-1.5 [&::before]:inline-block [&::before]:h-1.5 [&::before]:w-1.5 [&::before]:animate-pulse [&::before]:rounded-full [&::before]:bg-red-500 [&::before]:content-['']",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        violet:
          "border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-300",
        magenta:
          "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300",
        citrus:
          "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
        sky: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
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
