"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "~/lib/utils";
// The app's tab root: it also follows a sideways swipe on phones.
import { Tabs, useEdgeFade } from "~/components/ui/tabs";

/*
 * Pill tabs, as in Scoreline: the selected tab is a filled navy pill, the
 * rest are white pills with a hairline. The row scrolls sideways on phones
 * instead of wrapping.
 */

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, onScroll, ...props }, ref) => {
  // Faded edges where more tabs are scrolled out of view.
  const fade = useEdgeFade(ref);
  return (
    <TabsPrimitive.List
      {...fade}
      onScroll={(e) => {
        onScroll?.(e);
        fade.onScroll();
      }}
      className={cn(
        "tabs-fade no-scrollbar -mx-1.5 flex max-w-[calc(100%+0.75rem)] items-center gap-2 overflow-x-auto px-1.5 pb-3 pt-1",
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

/** Shared look of a pill tab, also used by Segmented. */
export const pillTab =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-tab-value={props.value}
    className={cn(
      pillTab,
      "bg-card ring-1 ring-inset ring-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_6px_14px_-8px_hsl(var(--primary)/0.7)] data-[state=active]:ring-0",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/**
 * A long screen's main tabs: they stay on screen as it scrolls, so changing
 * tab never means going back to the top. They stick at `--pinned-top` (under
 * whatever else is pinned, set by the page). On phones each is a full 44px
 * and the row shares the width, so five short names all show at 390px.
 * Goes inside `Tabs`, on a sheet (`Sheet`, `ContentSheet`).
 */
const PinnedTabs = React.forwardRef<
  HTMLDivElement,
  {
    label: string;
    tabs: readonly { value: string; label: React.ReactNode }[];
    className?: string;
  }
>(({ label, tabs, className }, ref) => (
  <div
    ref={ref}
    data-pinned-tabs=""
    className={cn(
      "sticky top-[var(--pinned-top,0px)] z-20 -mx-4 bg-card px-4 sm:max-md:-mx-6 sm:max-md:px-6 md:mx-0 md:bg-background md:px-0",
      className,
    )}
  >
    <TabsList aria-label={label} className="gap-1 pb-2 pt-1.5 sm:gap-2">
      {tabs.map((t) => (
        <TabsTrigger
          key={t.value}
          value={t.value}
          className="max-md:h-11 max-md:flex-1 max-md:px-2.5 sm:max-md:px-4"
        >
          {t.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </div>
));
PinnedTabs.displayName = "PinnedTabs";

/**
 * A filter that is not a tab set (no panels): "All / Boundaries / Wickets".
 * Buttons with aria-pressed, in a muted track.
 */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** Accessible name of the group. */
  label: string;
  options: readonly { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            pillTab,
            "h-8 px-3.5",
            o.value === value &&
              "bg-card text-foreground shadow-sm hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, PinnedTabs, Segmented };
