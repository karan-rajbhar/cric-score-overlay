import type * as React from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/components/ds/button";

/**
 * The top of a screen on the wash: the pink-to-lavender gradient sits
 * behind the children and fades into the page, as in Scoreline. Only for the
 * top of a screen (greeting, match header, profile header).
 */
export function ScreenWash({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative isolate", className)}>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[calc(100%+3rem)] bg-wash [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]"
      />
      {children}
    </div>
  );
}

/**
 * Screen title bar: round back button, centred title, actions on the right
 * (44 px each).
 */
export function ScreenBar({
  title,
  backHref,
  backLabel = "Back",
  onBack,
  action,
  className,
}: {
  title: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Runs before following backHref (e.g. history.back when it can). */
  onBack?: React.MouseEventHandler<HTMLAnchorElement>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2",
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          onClick={onBack}
          aria-label={backLabel}
          className={cn(
            buttonVariants({ variant: "surface", size: "icon" }),
            "justify-self-start",
          )}
        >
          <ChevronLeft />
        </Link>
      ) : (
        <span />
      )}
      <h1 className="truncate text-center text-base font-semibold text-foreground">
        {title}
      </h1>
      <div className="flex items-center gap-2 justify-self-end">{action}</div>
    </div>
  );
}

/**
 * The white sheet that rises over the wash and holds a screen's tabs and
 * content. Rounded top only; it is not draggable, so it has no grab handle.
 */
export function Sheet({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-t-[1.75rem] bg-card px-4 pb-6 pt-5 shadow-[0_-12px_30px_-18px_hsl(var(--shadow-color)/0.3)] sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A page's tabs and content as on the phone screens in /design: below the
 * tablet breakpoint a white sheet rising over the wash, edge to edge and
 * down under the tab bar; from tablets up a plain block (the cards float on
 * the page). Put it last on the page, after the header on the wash.
 */
export function ContentSheet({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative max-md:-mx-4 max-md:-mb-32 max-md:rounded-t-[1.75rem] max-md:bg-card max-md:px-4 max-md:pb-32 max-md:pt-5 max-md:shadow-[0_-12px_30px_-18px_hsl(var(--shadow-color)/0.3)] sm:max-md:-mx-6 sm:max-md:px-6",
        className,
      )}
      {...props}
    />
  );
}
