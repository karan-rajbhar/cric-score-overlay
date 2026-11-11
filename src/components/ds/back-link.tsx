"use client";

import { useSyncExternalStore } from "react";
import type * as React from "react";
import Link from "next/link";
import { backTarget, subscribeVisits } from "~/lib/in-app-history";

/**
 * Back: returns where the person came from inside the app, else goes to
 * `href`, the page's natural parent (`~/lib/navigation`). It skips a form
 * already used and sign-in (`backTarget`). It stays a real link, so opening
 * it in a new tab or with no history works.
 *
 * `avoid`: a page Back must not return to, because that page's own way out
 * leads straight back here (the scoring screen and its match).
 */
export function BackLink({
  href,
  avoid,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
  avoid?: string;
}) {
  // Going back through history, it says "Back", not "Back to <parent>":
  // it is not going there (N25). The server renders the parent's name.
  const viaHistory = useSyncExternalStore(
    subscribeVisits,
    () => backTarget(avoid) !== null,
    () => false,
  );
  const named = (label: string | undefined) =>
    viaHistory && label ? "Back" : label;
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        if (!backTarget(avoid)) return;
        e.preventDefault();
        window.history.back();
      }}
      {...props}
      aria-label={named(props["aria-label"])}
      title={named(props.title)}
    />
  );
}
