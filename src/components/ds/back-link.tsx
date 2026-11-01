"use client";

import type * as React from "react";
import Link from "next/link";
import { previousPath } from "~/lib/in-app-history";

/**
 * Back: returns where the person came from inside the app, else goes to
 * `href`, the page's natural parent (`~/lib/navigation`). It stays a real
 * link, so opening it in a new tab or with no history works.
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
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        const previous = previousPath();
        if (!previous || previous === avoid) return;
        e.preventDefault();
        window.history.back();
      }}
      {...props}
    />
  );
}
