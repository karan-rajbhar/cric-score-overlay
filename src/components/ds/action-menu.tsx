"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useMediaQuery } from "~/lib/hooks/useMediaQuery";
import { cn } from "~/lib/utils";

/** One action of a screen's ⋯ menu. */
export interface ActionItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Runs once the menu has closed (it may open a dialog of its own). */
  onSelect?: () => void;
  href?: string;
  /** Opens in a new tab. */
  external?: boolean;
  /** Red, and kept for the end of the menu. */
  destructive?: boolean;
  /** For work worth starting on touch-down (a share image). */
  onPointerDown?: () => void;
  /** Only in the phone sheet (the screen shows it elsewhere from `md`). */
  phoneOnly?: boolean;
  /** Only in the dropdown (keyboard shortcuts mean nothing on a phone). */
  desktopOnly?: boolean;
}

/** A run of actions under an optional heading ("Share", "Preferences"). */
export interface ActionGroup {
  label?: string;
  items: Array<ActionItem | false | null | undefined>;
}

/**
 * A screen's ⋯ menu, one list of actions: a dropdown from `md` up, and on
 * phones the actions sheet (`ActionsSheet`'s look, 44px rows), which is
 * what every other detail screen opens there (M13, S5,
 * `/design#detail-pages`). Destructive actions go last, set apart.
 */
export function ActionMenu({
  title,
  groups,
  trigger,
  onOpenChange,
  contentClassName,
}: {
  /** The sheet's heading on phones: what the actions are about. */
  title: string;
  groups: ActionGroup[];
  /** The ⋯ button (rendered with `asChild`). */
  trigger: React.ReactElement;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
}) {
  const phone = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = React.useState(false);
  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const offered = (i: ActionItem | false | null | undefined): i is ActionItem =>
    Boolean(i) &&
    !((i as ActionItem).phoneOnly && !phone) &&
    !((i as ActionItem).desktopOnly && phone);
  // Destructive actions to the end, in a group of their own.
  const shown = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => offered(i) && !i.destructive) as ActionItem[],
    }))
    .filter((g) => g.items.length > 0);
  const danger = groups
    .flatMap((g) => g.items)
    .filter((i) => offered(i) && i.destructive) as ActionItem[];
  const all = danger.length ? [...shown, { items: danger }] : shown;

  const run = (item: ActionItem) => {
    setMenuOpen(false);
    // After the menu has let go of the focus, so a dialog it opens keeps it.
    if (item.onSelect) window.setTimeout(item.onSelect, 0);
  };

  if (phone) {
    const row =
      "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";
    return (
      <Dialog open={open} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="truncate">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Actions for {title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {all.map((group, gi) => (
              <div
                key={group.label ?? gi}
                role="group"
                aria-label={group.label}
                className={cn(gi > 0 && "border-t border-border pt-3")}
              >
                {group.label && (
                  <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const body = (
                    <>
                      {Icon && (
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            item.destructive ? "" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0 flex-1">{item.label}</span>
                    </>
                  );
                  const cls = cn(row, item.destructive && "text-destructive");
                  return item.href ? (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cls}
                      onClick={() => setMenuOpen(false)}
                      {...(item.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      key={item.key}
                      type="button"
                      className={cls}
                      onPointerDown={item.onPointerDown}
                      onClick={() => run(item)}
                    >
                      {body}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const item =
    "flex cursor-pointer items-center gap-2 [@media(pointer:coarse)]:min-h-11";
  return (
    <DropdownMenu open={open} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-60", contentClassName)}>
        {all.map((group, gi) => (
          <React.Fragment key={group.label ?? gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {group.label && (
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
            )}
            {group.items.map((it) => {
              const Icon = it.icon;
              const body = (
                <>
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span>{it.label}</span>
                </>
              );
              const cls = cn(
                item,
                it.destructive &&
                  "text-destructive focus:bg-destructive/10 focus:text-destructive",
              );
              return it.href ? (
                <DropdownMenuItem key={it.key} asChild className={cls}>
                  <Link
                    href={it.href}
                    {...(it.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {body}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={it.key}
                  className={cls}
                  onPointerDown={it.onPointerDown}
                  onSelect={() => it.onSelect?.()}
                >
                  {body}
                </DropdownMenuItem>
              );
            })}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
