import type * as React from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

/** Section title with an optional "See all" link on the right. */
export function SectionHeader({
  title,
  description,
  href,
  actionLabel = "See all",
  as: Heading = "h2",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  actionLabel?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading className="text-balance text-xl font-semibold text-foreground">
          {title}
        </Heading>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/**
 * A row in a list card: leading crest/avatar, title, subtitle and a
 * trailing figure or action. With `href` the whole row is the link, with
 * `onClick` the whole row is the button.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  disabled = false,
  selected = false,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {title}
        </div>
        {subtitle && (
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      {href && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </>
  );
  const classes = cn(
    "flex min-h-14 items-center gap-3 px-4 py-2.5",
    selected && "bg-primary-soft",
    (href || onClick) &&
      "transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
    className,
  );
  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-current={selected || undefined}
      >
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(classes, "w-full text-left disabled:opacity-50")}
      >
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}

/** Card holding ListRows, separated by hairlines. */
export function ListCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-border/40 dark:ring-border",
        className,
      )}
      {...props}
    />
  );
}

/** Icon plus text for match facts (venue, date, toss). */
export function MetaItem({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Sidebar / menu entry; the current page gets the lavender fill. */
export function NavItem({
  href,
  icon: Icon,
  label,
  active = false,
  collapsed = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary-soft-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed && "w-11 justify-center px-0",
      )}
    >
      <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && "sr-only")}>{label}</span>
    </Link>
  );
}
