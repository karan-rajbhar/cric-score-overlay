"use client";

import { Check, Share2, type LucideIcon } from "lucide-react";
import { Button } from "~/components/ds/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export type ShareMenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  disabled?: boolean;
};

/**
 * One Share button for a screen with several things to send (a link, an
 * image, a report), so they do not each take a button on the page. Screens
 * with only a link use `ShareMatchButton`, one tap with no menu. `done`
 * shows a tick for a moment after something was copied.
 */
export function ShareMenu({
  items,
  label = "Share",
  done = false,
  onOpenChange,
  className,
}: {
  items: readonly ShareMenuItem[];
  label?: string;
  done?: boolean;
  /** The moment to start anything slow, before an item is tapped. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="surface"
          size="icon"
          aria-label={label}
          className={className}
        >
          {done ? <Check /> : <Share2 />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map(({ label: item, icon: Icon, onSelect, disabled }) => (
          <DropdownMenuItem
            key={item}
            disabled={disabled}
            onSelect={onSelect}
            className="flex min-h-11 cursor-pointer items-center gap-2"
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
