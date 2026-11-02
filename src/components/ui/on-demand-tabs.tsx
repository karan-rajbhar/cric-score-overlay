"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Skeleton } from "~/components/ui/skeleton";
import { setUrlParam } from "~/lib/url-state";
import { Tabs, TabsContent } from "./tabs";

/**
 * Tabs for a detail page some of whose tabs cost reads, split across a route's
 * layout and page. The layout holds the header and the cheap tabs (as plain
 * `TabsContent`) and these tabs around `OnDemandPanels`; `page.tsx` fills the
 * costly tab named by `?tab=`. Layouts do not re-render on navigation, so
 * opening a costly tab runs the page alone: its own reads and nothing the
 * layout already read. The choice stays in the URL, so a reload and a shared
 * link open the same tab, and a page read once stays until another replaces
 * it, so going back and forth between it and a cheap tab costs nothing.
 *
 * The `loading.tsx` a prefetch stops at must be above that layout (a route
 * group does it), or every link to the page would run the layout's reads.
 */

const OnDemandContext = React.createContext<{
  onDemand: readonly string[];
} | null>(null);

export function OnDemandTabs({
  fallback,
  tabs,
  onDemand,
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<typeof Tabs>,
  "value" | "defaultValue" | "onValueChange"
> & {
  /** The tab of the plain URL. */
  fallback: string;
  /** Every tab offered: a link to another one opens `fallback`. */
  tabs: readonly string[];
  /** The tabs `page.tsx` fills. */
  onDemand: readonly string[];
}) {
  const router = useRouter();
  const inUrl = useSearchParams().get("tab");
  const [value, setValue] = React.useState(() =>
    inUrl && tabs.includes(inUrl) ? inUrl : fallback,
  );
  const [, startTransition] = React.useTransition();
  /** The costly tab the page holds now. */
  const served = React.useRef(
    inUrl && onDemand.includes(inUrl) ? inUrl : null,
  );

  const open = (next: string) => {
    setValue(next);
    if (!onDemand.includes(next) || next === served.current) {
      setUrlParam("tab", next, fallback);
      return;
    }
    served.current = next;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    startTransition(() => {
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    });
  };

  const context = React.useMemo(() => ({ onDemand }), [onDemand]);
  return (
    <OnDemandContext.Provider value={context}>
      <Tabs value={value} onValueChange={open} {...props} />
    </OnDemandContext.Provider>
  );
}

/**
 * One panel per costly tab. Only the tab the page was rendered for shows
 * `children`: until a newly opened tab arrives it shows a skeleton, never the
 * previous tab's content.
 */
export function OnDemandPanels({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(OnDemandContext);
  const inUrl = useSearchParams().get("tab");
  return context?.onDemand.map((tab) => (
    <TabsContent key={tab} value={tab} className={className}>
      {tab === inUrl ? children : <TabSkeleton />}
    </TabsContent>
  ));
}

/** What a costly tab shows until its content arrives. */
export function TabSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
