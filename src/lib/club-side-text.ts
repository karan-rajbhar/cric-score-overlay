/**
 * The words for `matches.club_side` ("whose stats count for the club"),
 * one copy for the match wizard, the "Add to club" dialog, Match settings
 * and the match page's Info tab.
 */
import type { ClubSide } from "~/lib/firebase/types";

/** "Lions" -> "Lions'", "Riverside CC" -> "Riverside CC's". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

export interface ClubSideOption {
  value: ClubSide;
  label: string;
  description: string;
}

/** The three answers to "Whose stats count for <club>?". */
export function clubSideOptions(
  team1Name: string,
  team2Name: string,
): ClubSideOption[] {
  const outside = (other: string) =>
    `The other team, ${other}, is from outside the club. Its players keep their own stats.`;
  return [
    {
      value: "both",
      label: "Both teams",
      description: "Everyone's stats count: both teams are club players.",
    },
    { value: "team1", label: `Only ${team1Name}`, description: outside(team2Name) },
    { value: "team2", label: `Only ${team2Name}`, description: outside(team1Name) },
  ];
}

/**
 * The match page's "Club stats count" fact: who counts ("Both teams",
 * "Only Lions") and the team left out as an outside one, if any.
 */
export function clubStatsFact(
  side: ClubSide | null | undefined,
  team1Name: string,
  team2Name: string,
): { counts: string; outside: string | null } {
  if (side === "team1") return { counts: `Only ${team1Name}`, outside: team2Name };
  if (side === "team2") return { counts: `Only ${team2Name}`, outside: team1Name };
  return { counts: "Both teams", outside: null };
}
