import { formatBowlerOvers } from "./cricket";
import type { Match } from "./match-types";

/** The player of the match with what they did, for the award card. */
export interface PlayerAward {
  name: string;
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
  const bat = batInn?.batting_performances?.find((b) => b.user_id === potm.id);
  const bowlInn = innings.find((i) =>
    i.bowling_performances?.some((b) => b.user_id === potm.id),
  );
  const bowl = bowlInn?.bowling_performances?.find(
    (b) => b.user_id === potm.id,
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
