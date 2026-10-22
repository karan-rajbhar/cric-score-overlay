"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "~/lib/utils";
import { useSwipeTabs } from "~/lib/hooks/useSwipeTabs";

/** This tab set's tab buttons, in order (not those of nested sets). */
function ownTabsOf(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('[role="tab"][data-tab-value]'),
  ).filter((t) => t.closest("[data-swipe-tabs]") === root);
}

/** This tab set's tabs, in order, skipping disabled ones and nested sets. */
function tabValuesOf(root: HTMLElement | null): string[] {
  return ownTabsOf(root)
    .filter((t) => !t.hasAttribute("data-disabled"))
    .map((t) => t.dataset.tabValue!);
}

/** Width of the edge fade (TabsList), which a revealed tab must clear. */
const FADE_PX = 24;

/**
 * Scroll a tab bar sideways (never the page) so the selected tab is in
 * full view, clear of the edge fades; left alone when it already is.
 */
function revealTab(root: HTMLElement | null, value: string, smooth: boolean) {
  requestAnimationFrame(() => {
    const tab = ownTabsOf(root).find((t) => t.dataset.tabValue === value);
    const list = tab?.closest<HTMLElement>('[role="tablist"]');
    if (!tab || !list || list.scrollWidth <= list.clientWidth) return;
    const t = tab.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    if (t.left >= l.left + FADE_PX && t.right <= l.right - FADE_PX) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    list.scrollTo?.({
      // Centre it.
      left: list.scrollLeft + (t.left + t.width / 2 - (l.left + l.width / 2)),
      behavior: smooth && !reduce ? "smooth" : "auto",
    });
  });
}

/**
 * A tab bar that scrolls sideways fades out at each edge that has tabs
 * beyond it (`data-fade-start` / `data-fade-end`, styled by `.tabs-fade`),
 * so phones show there is more; the fade goes once scrolled to that end.
 */
export function useEdgeFade<T extends HTMLElement>(
  forwardedRef: React.ForwardedRef<T>,
) {
  const node = React.useRef<T | null>(null);
  // The caller's ref still gets the element.
  React.useImperativeHandle(forwardedRef, () => node.current as T, []);
  const [fade, setFade] = React.useState({ start: false, end: false });
  const update = React.useCallback(() => {
    const el = node.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = max > 1 && el.scrollLeft > 1;
    const end = max > 1 && el.scrollLeft < max - 1;
    setFade((f) => (f.start === start && f.end === end ? f : { start, end }));
  }, []);
  React.useEffect(() => {
    const el = node.current;
    update();
    if (!el || typeof ResizeObserver === "undefined") return;
    // The bar or a tab changing size (fonts, labels) changes what overflows.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [update]);
  return {
    ref: node,
    onScroll: update,
    "data-fade-start": fade.start ? "" : undefined,
    "data-fade-end": fade.end ? "" : undefined,
  };
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
      onChange: change,
    });
    // The selected tab stays in view in a bar that scrolls, however it was
    // chosen (tap, keys, swipe, the page): placed at once on the first
    // render, smoothly after that.
    const placed = React.useRef(false);
    React.useEffect(() => {
      if (!current) return;
      revealTab(rootRef.current, current, placed.current);
      placed.current = true;
    }, [current]);
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
>(({ className, onScroll, ...props }, ref) => {
  const fade = useEdgeFade(ref);
  return (
    <TabsPrimitive.List
      {...fade}
      onScroll={(e) => {
        onScroll?.(e);
        fade.onScroll();
      }}
      className={cn(
        "tabs-fade no-scrollbar -mx-1.5 inline-flex max-w-[calc(100%+0.75rem)] items-center justify-start gap-2 overflow-x-auto px-1.5 pb-3 pt-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
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
