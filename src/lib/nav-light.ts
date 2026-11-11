"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * Which tab a detail page lights (N24): the section of its trail's first
 * crumb, so a club's team lights Clubs, as its Back and breadcrumb say,
 * rather than More, as its URL would. The page's `PageTrail` publishes the
 * crumb; the tab bar and the sidebar read it for that path only.
 */
let lit: { pathname: string; href: string } | null = null;
const listeners = new Set<() => void>();

function publish(next: typeof lit) {
  if (lit?.pathname === next?.pathname && lit?.href === next?.href) return;
  lit = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The href that decides the lit tab on `pathname`: its trail's head, else itself. */
export function useLitHref(pathname: string): string {
  const current = useSyncExternalStore(
    subscribe,
    () => lit,
    () => null,
  );
  return current?.pathname === pathname ? current.href : pathname;
}

/** Lights the tab of `href` (a trail's first crumb) while this page is open. */
export function useLightTrail(href: string | undefined): void {
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (!href || !pathname) return;
    publish({ pathname, href });
    return () => {
      if (lit?.pathname === pathname) publish(null);
    };
  }, [href, pathname]);
}

/** For a server component's tree: `useLightTrail` as an element. */
export function LightTrail({ href }: { href: string | undefined }) {
  useLightTrail(href);
  return null;
}
