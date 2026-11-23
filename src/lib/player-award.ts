import { formatBowlerOvers } from "./cricket";
import type { BattingPerformance, BowlingPerformance, Match } from "./match-types";
import { lastMainInningsOf } from "./multi-innings";

/** One innings' figures, or several added up (a Test's two); out if out in the last. */
function sumBatting(rows: BattingPerformance[]): BattingPerformance | undefined {
  if (rows.length <= 1) return rows[0];
  return rows.reduce((a, b) => ({
    ...b,
    runs_scored: (a.runs_scored ?? 0) + (b.runs_scored ?? 0),
    balls_faced: (a.balls_faced ?? 0) + (b.balls_faced ?? 0),
    fours: (a.fours ?? 0) + (b.fours ?? 0),
    sixes: (a.sixes ?? 0) + (b.sixes ?? 0),
  }));
}

function sumBowling(rows: BowlingPerformance[]): BowlingPerformance | undefined {
  if (rows.length <= 1) return rows[0];
  return rows.reduce((a, b) => ({
    ...b,
    balls_bowled: (a.balls_bowled ?? 0) + (b.balls_bowled ?? 0),
    overs_bowled: 0,
    runs_conceded: (a.runs_conceded ?? 0) + (b.runs_conceded ?? 0),
    wickets_taken: (a.wickets_taken ?? 0) + (b.wickets_taken ?? 0),
    maidens: (a.maidens ?? 0) + (b.maidens ?? 0),
  }));
}

/** The player of the match with what they did, for the award card. */
export interface PlayerAward {
  name: string;
  /** Their profile page is `/players/<userId>`. */
  userId?: string;
  avatarUrl: string | null;
  /** The side they played for. */
  team: string | null;
  batting: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    notOut: boolean;
  } | null;
  bowling: {
    wickets: number;
    runs: number;
    overs: string;
    maidens: number;
  } | null;
}

/**
 * The match's player of the match and their figures from the scorecard
 * (batting when they batted, bowling when they bowled); null without one.
 */
export function playerAwardOf(match: Match): PlayerAward | null {
  const potm = match.player_of_the_match;
  if (!potm) return null;
  const innings = match.innings ?? [];
  const nameOf = (teamId: string | null | undefined) =>
    teamId === match.team1_id
      ? match.team1.name
      : teamId === match.team2_id
        ? match.team2.name
        : null;

  const batInn = innings.find((i) =>
    i.batting_performances?.some((b) => b.user_id === potm.id),
  );
  const bowlInn = innings.find((i) =>
    i.bowling_performances?.some((b) => b.user_id === potm.id),
  );
  // A Test: the player's figures over both innings of the match proper.
  const main = innings.filter(
    (i) => i.innings_number <= lastMainInningsOf(match),
  );
  const bat = sumBatting(
    main.flatMap((i) =>
      (i.batting_performances ?? []).filter((b) => b.user_id === potm.id),
    ),
  );
  const bowl = sumBowling(
    main.flatMap((i) =>
      (i.bowling_performances ?? []).filter((b) => b.user_id === potm.id),
    ),
  );
  const batted =
    bat && ((bat.runs_scored ?? 0) > 0 || (bat.balls_faced ?? 0) > 0);
  const bowled =
    bowl &&
    ((bowl.balls_bowled ?? 0) > 0 ||
      (bowl.overs_bowled ?? 0) > 0 ||
      (bowl.wickets_taken ?? 0) > 0);
  // A bowler plays for the side that was not batting.
  const bowlingSide =
    bowlInn &&
    nameOf(
      bowlInn.team_id === match.team1_id ? match.team2_id : match.team1_id,
    );

  return {
    name: potm.full_name,
    userId: potm.id,
    avatarUrl: potm.avatar_url ?? null,
    team: (batInn ? nameOf(batInn.team_id) : bowlingSide) ?? null,
    batting: batted
      ? {
          runs: bat.runs_scored ?? 0,
          balls: bat.balls_faced ?? 0,
          fours: bat.fours ?? 0,
          sixes: bat.sixes ?? 0,
          notOut: !bat.is_out,
        }
      : null,
    bowling: bowled
      ? {
          wickets: bowl.wickets_taken ?? 0,
          runs: bowl.runs_conceded ?? 0,
          overs: formatBowlerOvers(bowl),
          maidens: bowl.maidens ?? 0,
        }
      : null,
  };
}
