/**
 * Which tabs a match offers, and what a `?tab=` means. A tab appears once it
 * has something in it (see `/design#principles`).
 */

export type MatchTab = "summary" | "scorecard" | "balls" | "stats" | "squads";

export const DEFAULT_MATCH_TAB: MatchTab = "summary";

const ALL_TABS: readonly MatchTab[] = [
  "summary",
  "scorecard",
  "balls",
  "stats",
  "squads",
];

/** Tabs that were merged: older links still open somewhere sensible. */
const MOVED_TABS: Record<string, MatchTab> = {
  superstars: "stats",
  info: "summary",
};

/** The tab a `?tab=` value names; anything else is the default. */
export function matchTabFrom(param: string | null | undefined): MatchTab {
  const tab = (param && MOVED_TABS[param]) || param;
  return ALL_TABS.find((t) => t === tab) ?? DEFAULT_MATCH_TAB;
}

/**
 * The tabs in order, most used first. Until there is an innings, only
 * Summary and Squads: the rest would each say nothing has happened yet.
 * Summary is the live panel while the match is on, so it is called Live.
 */
export function matchTabsOf(match: {
  status: string;
  innings?: readonly unknown[] | null;
}): { value: MatchTab; label: string }[] {
  const live = match.status === "live" || match.status === "innings_break";
  const summary = {
    value: "summary" as const,
    label: live ? "Live" : "Summary",
  };
  const squads = { value: "squads" as const, label: "Squads" };
  if (!match.innings?.length) return [summary, squads];
  return [
    summary,
    { value: "scorecard", label: "Scorecard" },
    { value: "balls", label: "Balls" },
    { value: "stats", label: "Stats" },
    squads,
  ];
}
