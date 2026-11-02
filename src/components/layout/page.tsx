import type * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "~/components/ds/button";
import { ScreenBar } from "~/components/ds/screen";
import { cn } from "~/lib/utils";

/*
 * Page scaffolding shared by every routed page inside the app shell.
 * The shell already provides the horizontal gutter and top padding, so
 * pages only set a max width and the vertical rhythm between blocks.
 */

const PAGE_WIDTH = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
  form: "max-w-2xl",
} as const;

export function PageContainer({
  size = "default",
  stack = true,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  size?: keyof typeof PAGE_WIDTH;
  /** Space direct children evenly. Off for pages that manage their own gaps. */
  stack?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0",
        stack && "space-y-6 sm:space-y-8",
        PAGE_WIDTH[size],
        className,
      )}
      {...props}
    />
  );
}

/** The way to Search on phones, where it has no tab: top right of a screen. */
export function SearchLink({ className }: { className?: string }) {
  return (
    <Link
      href="/search"
      aria-label="Search"
      className={cn(
        buttonVariants({ variant: "surface", size: "icon" }),
        "shrink-0 md:hidden",
        className,
      )}
    >
      <Search />
    </Link>
  );
}

/** Page title row: h1, one-line description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  search = false,
  back,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons/links. On phones they stretch to share the full width. */
  actions?: React.ReactNode;
  /** A main screen: shows the way to Search on phones (`SearchLink`). */
  search?: boolean;
  /**
   * A page under a tab, not the tab itself: on phones the title moves into a
   * `ScreenBar` with Back, so the screen names itself once.
   */
  back?: { href: string; label: string };
  /** Extra content under the description (badges, meta). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      {back && (
        <ScreenBar
          title={title}
          backHref={back.href}
          backLabel={back.label}
          action={search ? <SearchLink /> : undefined}
          className="md:hidden"
        />
      )}
      <header
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
          className,
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className={cn(
                "text-balance text-2xl font-semibold tracking-tight text-foreground",
                back && "max-md:hidden",
              )}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-pretty text-sm text-muted-foreground">
                {description}
              </p>
            )}
            {children}
          </div>
          {search && !back && <SearchLink />}
        </div>
        {actions && (
          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </header>
    </>
  );
}

/** Heading for a block within a page: title, optional count and action. */
export function SectionHeader({
  title,
  description,
  count,
  action,
  live = false,
  id,
  as: Heading = "h2",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  /** Prefix the title with the app's red live dot. */
  live?: boolean;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {live && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-live motion-safe:animate-pulse"
              aria-hidden="true"
            />
          )}
          <Heading
            id={id}
            className="truncate text-base font-semibold text-foreground"
          >
            {title}
          </Heading>
          {count !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
