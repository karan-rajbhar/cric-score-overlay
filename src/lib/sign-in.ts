import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/** The sign-in page, coming back to `path` afterwards (N31). */
export function signInHref(path?: string | null): string {
  if (!path || path === "/" || path.startsWith("/auth/")) return "/auth/login";
  return `/auth/login?redirect=${encodeURIComponent(path)}`;
}

const NAMED: Record<string, string> = {
  "/dashboard": "Home",
  "/invitations": "your invites",
  "/matches/create": "New match",
  "/clubs/create": "New club",
  "/teams/create": "New team",
  "/tournaments/create": "New tournament",
};

const SECTION: Array<[RegExp, string]> = [
  [/^\/matches\/[^/]+/, "the match"],
  [/^\/clubs\/[^/]+/, "the club"],
  [/^\/teams\/[^/]+/, "the team"],
  [/^\/tournaments\/[^/]+/, "the tournament"],
  [/^\/players\/[^/]+/, "the player's page"],
];

/**
 * What the sign-in page names as where it will go back to ("New match",
 * "the match"), or null for a page with no short name.
 */
export function placeName(path: string): string | null {
  const pathname = path.split(/[?#]/)[0] ?? "";
  if (NAMED[pathname]) return NAMED[pathname];
  return SECTION.find(([re]) => re.test(pathname))?.[1] ?? null;
}

const noop = () => () => {};

/**
 * The sign-in link for the page on screen, query included (a create form's
 * `?clubId=`), so signing in comes back to it. The server renders the path
 * alone; the browser adds the query once hydrated.
 */
export function useSignInHref(): string {
  const pathname = usePathname();
  const here = useSyncExternalStore(
    noop,
    () => window.location.pathname + window.location.search,
    () => pathname,
  );
  return signInHref(here);
}
