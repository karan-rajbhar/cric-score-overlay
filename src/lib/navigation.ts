/**
 * Where a page sits in the app. Two rules live here (see `/design#principles`):
 * every page belongs to one tab, and a page's parent comes from what the page
 * shows, never from how someone reached it: URLs name the thing, not the
 * journey. `BackLink` follows the real history and uses these parents only
 * when there is none.
 */

export type NavSection = "home" | "matches" | "clubs" | "tournaments" | "more";

function under(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The tab a page belongs to; null for pages outside the tabs (Search). */
export function navSectionOf(pathname: string): NavSection | null {
  if (pathname === "/" || under(pathname, "/dashboard")) return "home";
  if (under(pathname, "/matches")) return "matches";
  if (under(pathname, "/tournaments")) return "tournaments";
  if (under(pathname, "/clubs")) return "clubs";
  // Teams and Players list everyone, not a club's: More holds them.
  if (
    under(pathname, "/more") ||
    under(pathname, "/invitations") ||
    under(pathname, "/teams") ||
    under(pathname, "/players")
  ) {
    return "more";
  }
  return null;
}

/** One step of the way up to a page; the last is its parent. */
export interface NavCrumb {
  label: string;
  href: string;
}

interface Named {
  id: string;
  name?: string | null;
}

export const backLabelOf = (crumbs: readonly NavCrumb[]): string =>
  `Back to ${crumbs[crumbs.length - 1]?.label ?? "the previous page"}`;

/** The last crumb: where Back goes on a link opened fresh. */
export const parentOf = (crumbs: readonly NavCrumb[]): string =>
  crumbs[crumbs.length - 1]?.href ?? "/";

/** A match sits in its tournament, else its club, else the match list. */
export function matchTrail(match: {
  tournament?: Named | null;
  club?: Named | null;
}): NavCrumb[] {
  const { tournament, club } = match;
  if (tournament?.id) {
    return [
      { label: "Tournaments", href: "/tournaments" },
      {
        label: tournament.name || "Tournament",
        href: `/tournaments/${tournament.id}?tab=fixtures`,
      },
    ];
  }
  if (club?.id) {
    return [
      { label: "Clubs", href: "/clubs" },
      { label: club.name || "Club", href: `/clubs/${club.id}?tab=matches` },
    ];
  }
  return [{ label: "Matches", href: "/matches" }];
}

/**
 * A team sits in its club, else the team list. `tournament`: the team's
 * page is filtered to one tournament (`?tournamentId=`, a real filter), so
 * it sits in that tournament.
 */
export function teamTrail(team: {
  club?: Named | null;
  tournament?: Named | null;
}): NavCrumb[] {
  const { club, tournament } = team;
  if (tournament?.id) {
    return [
      { label: "Tournaments", href: "/tournaments" },
      {
        label: tournament.name || "Tournament",
        href: `/tournaments/${tournament.id}?tab=teams`,
      },
    ];
  }
  if (club?.id) {
    return [
      { label: "Clubs", href: "/clubs" },
      { label: club.name || "Club", href: `/clubs/${club.id}?tab=teams` },
    ];
  }
  return [{ label: "Teams", href: "/teams" }];
}

/** A tournament sits in its club, else the tournament list. */
export function tournamentTrail(tournament: {
  club?: Named | null;
}): NavCrumb[] {
  const { club } = tournament;
  if (club?.id) {
    return [
      { label: "Clubs", href: "/clubs" },
      { label: club.name || "Club", href: `/clubs/${club.id}?tab=tournaments` },
    ];
  }
  return [{ label: "Tournaments", href: "/tournaments" }];
}

export const clubTrail = (): NavCrumb[] => [{ label: "Clubs", href: "/clubs" }];

export const playerTrail = (): NavCrumb[] => [
  { label: "Players", href: "/players" },
];
