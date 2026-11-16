/**
 * The scoring screen's views of the match (docs/scoring-screen-ux.md):
 * Score (the keypad), Scorecard and Balls, switched in place so a scorer
 * reads the match without leaving it. Pure helpers; the views live in
 * `components/ScoringViews.tsx`.
 */
import type { FallOfWicket, Innings, Match, TeamPlayer } from "~/lib/match-types";

export const SCORING_VIEWS = [
  { value: "score", label: "Score" },
  { value: "scorecard", label: "Scorecard" },
  { value: "balls", label: "Balls" },
] as const;

export type ScoringView = (typeof SCORING_VIEWS)[number]["value"];

/** The view of the plain URL (no `?tab=`). */
export const DEFAULT_SCORING_VIEW: ScoringView = "score";

/** The view a `?tab=` names; anything else is Score. */
export function scoringViewFrom(value: string | null | undefined): ScoringView {
  return SCORING_VIEWS.some((v) => v.value === value)
    ? (value as ScoringView)
    : DEFAULT_SCORING_VIEW;
}

/** A side as the scoring screen holds it, with its squad. */
export interface ScoringSide {
  id: string;
  name: string;
  players: TeamPlayer[];
}

/**
 * The match as the match page's scorecard reads it, from what the scoring
 * screen holds, so the Scorecard view costs no reads and shows each ball as
 * soon as the keypad does: each innings' fall of wickets (kept as stored,
 * ids only) named from the squads and the innings' own figures, and each
 * side's squad for "Yet to bat".
 */
export function scorecardMatchOf(
  match: Match,
  sides: readonly ScoringSide[],
): Match {
  const names = new Map<string, string>();
  for (const side of sides)
    for (const p of side.players)
      if (p.user?.full_name) names.set(p.user_id, p.user.full_name);
  for (const inn of match.innings ?? [])
    for (const row of [
      ...(inn.batting_performances ?? []),
      ...(inn.bowling_performances ?? []),
    ])
      if (row.user?.full_name && !names.has(row.user_id))
        names.set(row.user_id, row.user.full_name);
  const ref = (id: string | null | undefined) =>
    id && names.has(id) ? { id, full_name: names.get(id)! } : null;

  const named = (f: FallOfWicket): FallOfWicket => ({
    ...f,
    batsman: f.batsman ?? ref(f.batsman_out_id),
    bowler: f.bowler ?? ref(f.bowler_id),
    fielder: f.fielder ?? ref(f.fielder_id),
  });
  const innings = (match.innings ?? []).map(
    (inn): Innings => ({
      ...inn,
      fall_of_wickets: (inn.fall_of_wickets ?? []).map(named),
    }),
  );
  const squadOf = (team: Match["team1"]) => {
    const side = sides.find((s) => s.id === team?.id);
    return team && side ? { ...team, team_players: side.players } : team;
  };
  return {
    ...match,
    innings,
    team1: squadOf(match.team1),
    team2: squadOf(match.team2),
  };
}

/**
 * Changes whenever the match's ball log may have, so the Balls view and Fix
 * a mistake read it again then, and share one read while it does not:
 * `live_state.version`, bumped by every committed change (a ball, an edit,
 * a correction that leaves the totals as they were, the other scorer's),
 * once the screen follows it; until then (or offline) each innings'
 * figures and last write.
 */
export function ballLogStampOf(
  match: Pick<Match, "innings">,
  liveVersion: number | null,
): string {
  if (liveVersion !== null) {
    const ids = (match.innings ?? []).map((i) => i.id).join(",");
    return `${ids}|v${liveVersion}`;
  }
  const innings = (match.innings ?? [])
    .map((i) => {
      const doc = i as Innings & {
        updated_at?: string | null;
        last_ball_seq?: number | null;
      };
      return [
        i.id,
        i.total_balls ?? 0,
        i.total_runs ?? 0,
        i.total_wickets ?? 0,
        doc.last_ball_seq ?? "",
        doc.updated_at ?? "",
      ].join(":");
    })
    .join("|");
  return `${innings}|figures`;
}
