/**
 * First-run "Get started" checklist on the dashboard: which steps a new
 * user has done, derived from their own teams, matches and invites.
 */

export interface OnboardingProgress {
  /** A team the user created (newest found), for the "add players" link. */
  teamId: string | null;
  /** Some team of theirs has a player besides its creator. */
  hasPlayers: boolean;
  /** A match the user created, for the "invite a co-scorer" link. */
  matchId: string | null;
  /** A match of theirs has another scorer, or they sent any invite. */
  hasCoScorer: boolean;
}

export interface OnboardingStep {
  id: "team" | "players" | "match" | "scorer";
  label: string;
  description: string;
  href: string | null;
  done: boolean;
  optional: boolean;
}

export function onboardingSteps(p: OnboardingProgress): OnboardingStep[] {
  return [
    {
      id: "team",
      label: "Create a team",
      description: "Name your side; you are added as captain.",
      href: "/teams/create",
      done: Boolean(p.teamId),
      optional: false,
    },
    {
      id: "players",
      label: "Add players",
      description: "Add your squad so you can pick batters and bowlers.",
      href: p.teamId ? `/teams/${p.teamId}` : null,
      done: p.hasPlayers,
      optional: false,
    },
    {
      id: "match",
      label: "Create a match",
      description: "Pick two teams and the overs, then score ball by ball.",
      href: "/matches/create",
      done: Boolean(p.matchId),
      optional: false,
    },
    {
      id: "scorer",
      label: "Invite a co-scorer",
      description: "Share scoring with a teammate from the match page.",
      href: p.matchId ? `/matches/${p.matchId}` : null,
      done: p.hasCoScorer,
      optional: true,
    },
  ];
}

/** The checklist is shown until every required step is done. */
export function onboardingComplete(p: OnboardingProgress): boolean {
  return onboardingSteps(p).every((s) => s.done || s.optional);
}
