import type * as React from "react";
import Link from "next/link";
import { Bell, type LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Avatar } from "~/components/ds/avatar";
import { Button } from "~/components/ds/button";

/** Home header: avatar, "Good afternoon" over the name, round actions. */
export function GreetingBar({
  name,
  greeting,
  photoUrl,
  actions,
  className,
}: {
  name: string;
  greeting: string;
  photoUrl?: string | null;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar name={name} src={photoUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">{greeting}</p>
        <p className="truncate text-lg font-semibold leading-tight text-foreground">
          {name}
        </p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

/** Round notifications button; a red dot when something is new. */
export function NotificationsButton({
  hasNew = false,
  onClick,
}: {
  hasNew?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="surface"
      size="icon"
      onClick={onClick}
      aria-label={hasNew ? "Notifications, new" : "Notifications"}
    >
      <Bell />
      {hasNew && (
        <span
          aria-hidden="true"
          className="absolute right-3 top-2.5 h-2 w-2 rounded-full bg-live ring-2 ring-card"
        />
      )}
    </Button>
  );
}

export type TabBarItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
} & (
  | { href: string; onClick?: never }
  /** A tab that opens something instead of navigating ("More"). */
  | { href?: never; onClick: () => void; expanded?: boolean }
);

const tabTarget =
  "group flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function TabFace({ item }: { item: TabBarItem }) {
  const { icon: Icon, label, active } = item;
  return (
    <>
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary text-primary-foreground shadow-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
      </span>
      <span
        className={cn(
          "text-2xs leading-none",
          active
            ? "font-semibold text-foreground"
            : "font-medium text-muted-foreground",
        )}
      >
        {label}
      </span>
    </>
  );
}

/**
 * Phone navigation, after Scoreline's floating bar: the current tab is a
 * navy circle. Every tab keeps its label (icons alone are guesswork), and
 * the bar sits where a thumb reaches.
 */
export function TabBar({
  items,
  label = "Main",
  className,
}: {
  items: readonly TabBarItem[];
  label?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "rounded-[1.75rem] bg-card px-2 py-1.5 shadow-float ring-1 ring-border/50 dark:ring-border",
        className,
      )}
    >
      <ul className="flex items-stretch justify-between">
        {items.map((item) => (
          <li key={item.label} className="flex-1">
            {item.href !== undefined ? (
              <Link
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={tabTarget}
              >
                <TabFace item={item} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                aria-expanded={item.expanded}
                className={tabTarget}
              >
                <TabFace item={item} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
