"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "~/lib/utils";
import { useSwipeTabs } from "~/lib/hooks/useSwipeTabs";

/** This tab set's tabs, in order, skipping disabled ones and nested sets. */
function tabValuesOf(root: HTMLElement | null): string[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('[role="tab"][data-tab-value]'),
  )
    .filter(
      (t) =>
        t.closest("[data-swipe-tabs]") === root &&
        !t.hasAttribute("data-disabled"),
    )
    .map((t) => t.dataset.tabValue!);
}

/** Bring a tab chosen by swiping into view in a tab bar that scrolls. */
function revealTab(root: HTMLElement | null, value: string) {
  requestAnimationFrame(() => {
    const tab = Array.from(
      root?.querySelectorAll<HTMLElement>('[role="tab"][data-tab-value]') ?? [],
    ).find((t) => t.dataset.tabValue === value);
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    tab?.scrollIntoView?.({
      block: "nearest",
      inline: "center",
      behavior: reduce ? "auto" : "smooth",
    });
  });
}

/**
 * Tabs that also follow a sideways swipe on phones: left for the next tab,
 * right for the previous one (see `useSwipeTabs`). Tabs inside a panel (a
 * scorecard's innings) take the swipe first, then the tabs around them.
 * `swipeable={false}` turns it off.
 */
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
    swipeable?: boolean;
  }
>(
  (
    {
      swipeable = true,
      value,
      defaultValue,
      onValueChange,
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
      className,
      ...props
    },
    ref,
  ) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
    const current = value ?? uncontrolled ?? "";
    const change = React.useCallback(
      (next: string) => {
        if (value === undefined) setUncontrolled(next);
        onValueChange?.(next);
      },
      [value, onValueChange],
    );
    const tabs = React.useCallback(() => tabValuesOf(rootRef.current), []);
    const swipe = useSwipeTabs({
      tabs,
      value: current,
      enabled: swipeable,
      onChange: (next) => {
        change(next);
        revealTab(rootRef.current, next);
      },
    });
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    return (
      <TabsPrimitive.Root
        ref={setRefs}
        value={current}
        onValueChange={change}
        data-swipe-tabs=""
        // Vertical scrolling and zoom stay with the browser; sideways is ours.
        className={cn(swipeable && "touch-pan-y touch-pinch-zoom", className)}
        onTouchStart={(e) => {
          onTouchStart?.(e);
          swipe.onTouchStart(e);
        }}
        onTouchEnd={(e) => {
          onTouchEnd?.(e);
          swipe.onTouchEnd(e);
        }}
        onTouchCancel={(e) => {
          onTouchCancel?.(e);
          swipe.onTouchCancel();
        }}
        {...props}
      />
    );
  },
);
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "no-scrollbar -mx-1.5 inline-flex max-w-[calc(100%+0.75rem)] items-center justify-start gap-2 overflow-x-auto px-1.5 pb-3 pt-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-tab-value={props.value}
    className={cn(
      "inline-flex h-9 min-w-0 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-card px-4 text-sm font-medium ring-1 ring-inset ring-border ring-offset-background transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_6px_14px_-8px_hsl(var(--primary)/0.7)] data-[state=active]:ring-0",
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
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
