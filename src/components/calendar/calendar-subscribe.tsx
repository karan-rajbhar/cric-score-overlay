"use client";

import { useSyncExternalStore } from "react";
import { CalendarPlus, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { CalendarScope } from "~/lib/calendar/fixtures";

/** `/api/calendar/<scope>/<id>.ics` (see that route). */
export function calendarPath(scope: CalendarScope, id: string): string {
  return `/api/calendar/${scope}/${encodeURIComponent(id)}.ics`;
}

/** The https and webcal:// addresses of a feed on `origin`. */
export function calendarLinks(origin: string, scope: CalendarScope, id: string) {
  const https = `${origin}${calendarPath(scope, id)}`;
  const webcal = https.replace(/^https?:\/\//i, "webcal://");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  };
}

const noSubscribe = () => () => {};

/**
 * "Add to calendar" for a team's, tournament's or club's fixtures: a
 * subscription (webcal://) that calendar apps refresh by themselves, the
 * same feed in Google Calendar, or its address to paste elsewhere.
 */
export function CalendarSubscribe({
  scope,
  id,
  name,
}: {
  scope: CalendarScope;
  id: string;
  /** "Metropolitan Strikers": names the menu for screen readers. */
  name: string;
}) {
  // The page's own origin; empty while rendering on the server.
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const links = calendarLinks(origin, scope, id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(links.https);
      toast.success("Calendar link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={`Add ${name} fixtures to your calendar`}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Add to calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Fixtures update in your calendar every few hours.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={links.webcal} className="flex cursor-pointer items-center gap-2">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            <span>Subscribe in calendar app</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={links.google}
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center gap-2"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            <span>Add to Google Calendar</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void copy()}
          className="flex cursor-pointer items-center gap-2"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          <span>Copy calendar link</span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={calendarPath(scope, id)}
            download
            className="flex cursor-pointer items-center gap-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download .ics file</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
