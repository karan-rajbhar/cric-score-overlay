/**
 * Select strings shared by the match server actions (`queries.ts`, which as
 * a "use server" module can export only async functions) and the tests that
 * check the live scorecard against them.
 */

/** `getMatch`: the match with rosters, scorecards and parents. */
export const MATCH_DETAIL_SELECT = `
  *,
  team1:teams!matches_team1_id_fkey(*,
    team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))
  ),
  team2:teams!matches_team2_id_fkey(*,
    team_players(*, user:users!team_players_user_id_fkey(id, full_name, avatar_url))
  ),
  innings(
    *,
    batting_performances(*, user:users!batting_performances_user_id_fkey(id, full_name)),
    bowling_performances(*, user:users!bowling_performances_user_id_fkey(id, full_name)),
    fall_of_wickets(
      *,
      batsman:users!fall_of_wickets_batsman_out_id_fkey(id, full_name),
      bowler:users!fall_of_wickets_bowler_id_fkey(full_name),
      fielder:users!fall_of_wickets_fielder_id_fkey(full_name)
    )
  ),
  tournament:tournaments(id, name, tournament_format, venue),
  club:clubs(id, name),
  player_of_the_match:users!matches_player_of_the_match_id_fkey(id, full_name, avatar_url)
`;

/**
 * `getPartnerships`: one row per stand. The batters' names (`batsman1` /
 * `batsman2`) are added from the teams' rosters, not read per batter.
 */
export const PARTNERSHIPS_SELECT = `
  id,
  innings_id,
  batsman1_id,
  batsman2_id,
  runs,
  balls,
  batsman1_runs,
  batsman1_balls,
  batsman2_runs,
  batsman2_balls,
  start_over,
  end_over,
  is_current
`;
