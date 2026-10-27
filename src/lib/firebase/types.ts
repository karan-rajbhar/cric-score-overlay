/**
 * Firestore document shapes for every collection in the platform.
 *
 * These mirror the former Postgres tables one-to-one (snake_case columns)
 * so the rest of the codebase keeps the same domain types. Timestamps are
 * stored as ISO-8601 strings, UUIDs as strings, and JSON columns as plain
 * objects.
 */

import type {
  BattingEntry,
  BowlingEntry,
  FallOfWicketEntry,
  LastBall,
  OversRow,
  PartnershipEntry,
  PlayerMatchesRow,
} from "./scorecard";

import type { BoardPlayer, StatsAcc } from "./stats.mjs";

export type { BoardPlayer, StatsAcc };

export type {
  BattingEntry,
  BowlingEntry,
  FallOfWicketEntry,
  LastBall,
  OversRow,
  PartnershipEntry,
  PlayerMatchesRow,
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Public profile. Readable by anyone (see firestore.rules), so it must never
 * hold contact details: those live in `users_private/{uid}`.
 */
export interface UsersRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  location: string | null;
  /** Self-described, all optional (`~/lib/player-profile`). */
  playing_role?: string | null;
  batting_hand?: string | null;
  bowling_style?: string | null;
  username: string | null;
  is_active: boolean | null;
  /**
   * A player added to a squad who has not signed in yet (no account).
   * Cleared when someone signs in with the email the profile holds and
   * takes it over (`ensureOwnProfile`).
   */
  is_placeholder?: boolean | null;
  /** Search keys (stage 3, `derive.mjs`); maintained on every write. */
  name_lower?: string;
  search_prefixes?: string[];
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Server-only contact details for `users/{id}` (same document id). Rules
 * deny all client access; only the Admin SDK reads or writes it.
 */
export interface UsersPrivateRow {
  id: string;
  /** Lower-cased. Placeholder players get `...@players.local`. */
  email: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Where a sponsor logo may appear on the overlay. */
export type SponsorSlot = "corner" | "break" | "over_end";

/**
 * A sponsor logo a club or tournament uploaded once (`sponsor-logos/`
 * in Storage) and reuses on every stream (`~/lib/overlay/sponsors`).
 */
export interface Sponsor {
  id: string;
  name: string;
  logo_url: string;
  slots: SponsorSlot[];
}

export interface ClubsRow {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  location: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  is_public: boolean | null;
  club_type: string | null;
  founded_year: number | null;
  owner_id: string;
  social_links: Json | null;
  /** Overlay sponsor logos, in display order. */
  sponsors?: Sponsor[] | null;
  name_lower?: string;
  search_prefixes?: string[];
  /** Teams in the club (`club-team-count.ts`). */
  team_count?: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ClubMembershipsRow {
  id: string;
  club_id: string | null;
  user_id: string | null;
  role: string | null;
  status: string | null;
  /** Display copy of the member's profile (stage 3). */
  user_snapshot?: RosterUser | null;
  joined_at: string | null;
  updated_at: string | null;
}

export interface ClubInvitationsRow {
  id: string;
  club_id: string | null;
  invited_by: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  status: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** App-level invite: lets an email sign in with Google (invite-only app). */
export interface InvitationsRow {
  id: string;
  email: string;
  invited_by: string | null;
  /** `revoked` invites no longer let the email sign in. */
  status: "pending" | "accepted" | "revoked";
  accepted_by: string | null;
  /** Matches the invitee becomes a scorer for when they first sign in. */
  scorer_match_ids?: string[] | null;
  /** Matches the invitee becomes a streamer for (overlay graphics only). */
  streamer_match_ids?: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ClubSeasonsRow {
  id: string;
  club_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ClubHallOfFameRow {
  id: string;
  club_id: string;
  player_id: string;
  category: string;
  title: string;
  description: string | null;
  season_or_year: string | null;
  record_metric: string | null;
  created_by: string | null;
  inducted_at: string | null;
}

export interface TeamsRow {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  logo_url: string | null;
  /** "#rrggbb" or null; copied onto the match snapshots. */
  primary_color?: string | null;
  secondary_color?: string | null;
  club_id: string | null;
  captain_id: string | null;
  vice_captain_id: string | null;
  team_type: string | null;
  is_template: boolean | null;
  created_by: string;
  name_lower?: string;
  search_prefixes?: string[];
  /**
   * The team's team_players documents, each with a `user` snapshot
   * (id, full_name, avatar_url, username); refreshed on roster and
   * profile writes. Serves rosters and player names without user reads.
   */
  roster?: RosterEntry[];
  created_at: string | null;
  updated_at: string | null;
}

export interface RosterUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export type RosterEntry = TeamPlayersRow & { user: RosterUser | null };

/** Denormalized team fields stored on each match (`team1_snapshot`, ...). */
export interface TeamSnapshot {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  /** "#rrggbb" or null (older snapshots: missing until the team's next edit). */
  primary_color?: string | null;
  secondary_color?: string | null;
}

/** `matches.club_side`: the side(s) whose players count for the club. */
export type ClubSide = "both" | "team1" | "team2";

/**
 * A chase target revised by the DLS method (`matches.dls_revision`): the
 * innings it applies to, the revised target and the overs that innings now
 * has. The target is also the innings' `target_runs`; the overs replace
 * `overs_per_innings` for that innings (`inningsLimits`).
 */
export interface DlsRevision {
  innings_number: number;
  target_runs: number;
  overs: number;
}

export interface TeamPlayersRow {
  id: string;
  team_id: string | null;
  user_id: string | null;
  jersey_number: number | null;
  batting_order: number | null;
  is_playing_xi: boolean | null;
  role_in_team: string | null;
  added_by: string | null;
  created_at: string | null;
}

export interface TournamentsRow {
  id: string;
  name: string;
  description: string | null;
  tournament_format: string | null;
  match_format: string | null;
  custom_overs: number | null;
  overs_per_innings: number | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  max_teams: number | null;
  entry_fee: number | null;
  prize_pool: number | null;
  venue: string | null;
  rules: string | null;
  status: string | null;
  is_public: boolean | null;
  club_id: string | null;
  season_id: string | null;
  wickets_per_innings: number | null;
  last_man_stands: boolean | null;
  golden_ball: boolean | null;
  created_by: string;
  /** Overlay sponsor logos, in display order (ahead of the club's). */
  sponsors?: Sponsor[] | null;
  name_lower?: string;
  search_prefixes?: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface TournamentRegistrationsRow {
  id: string;
  tournament_id: string | null;
  team_id: string | null;
  registered_by: string;
  status: string | null;
  payment_status: string | null;
  registration_fee: number | null;
  approved_by: string | null;
  approved_at: string | null;
  registered_at: string | null;
  updated_at: string | null;
}

export interface TournamentStandingsRow {
  id: string;
  tournament_id: string | null;
  team_id: string | null;
  matches_played: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  no_results: number | null;
  points: number | null;
  points_adjustment: number | null;
  adjustment_reason: string | null;
  qualification_status: string | null;
  runs_scored: number | null;
  runs_conceded: number | null;
  overs_faced: number | null;
  overs_bowled: number | null;
  net_run_rate: number | null;
  updated_at: string | null;
}

export interface MatchesRow {
  id: string;
  title: string;
  match_format: string | null;
  overs_per_innings: number | null;
  balls_per_over: number | null;
  max_balls_per_over: number | null;
  wide_counts_as_ball_faced: boolean | null;
  wide_runs_to_batsman: boolean | null;
  noball_extras_to_batsman: boolean | null;
  /**
   * A no-ball counts as a ball faced by the striker (the Laws' scoring
   * convention). Null or absent: on; false for formats that leave it out.
   */
  noball_counts_as_ball_faced?: boolean | null;
  team1_id: string;
  team2_id: string;
  /**
   * Display copy of each team (name, short code, logo) so match lists need
   * no team reads. Written on create, refreshed when the team changes; may
   * be missing on matches created before it existed.
   */
  team1_snapshot?: TeamSnapshot | null;
  team2_snapshot?: TeamSnapshot | null;
  venue: string | null;
  scheduled_at: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  status: string | null;
  toss_winner_team_id: string | null;
  toss_decision: string | null;
  current_innings: number | null;
  /**
   * Legacy copies of the current innings' position (no longer written per
   * ball): read {@link matchPositionOf} (`~/lib/match-position`), which
   * derives them from the current innings' `total_balls`.
   */
  current_over: number | null;
  current_ball: number | null;
  weather_conditions: string | null;
  pitch_conditions: string | null;
  result_type: string | null;
  winning_team_id: string | null;
  win_margin_type: string | null;
  win_margin: number | null;
  result_description: string | null;
  /** The chase target revised by DLS, if any (cleared by a manual target). */
  dls_revision?: DlsRevision | null;
  umpire1_name: string | null;
  umpire2_name: string | null;
  third_umpire_name: string | null;
  scorer_name: string | null;
  tournament_id: string | null;
  club_id: string | null;
  /**
   * Which side plays for the club (`clubTeamIdsOf`): only its players get
   * club statistics, so an outside opponent's stay out of them. Null or
   * absent: both sides.
   */
  club_side?: ClubSide | null;
  season_id: string | null;
  /** Tournament stage ("group", "knockout"; null: league or friendly). */
  stage?: string | null;
  /** Knockout round (1 = first round) or group-stage round. */
  round?: number | null;
  /** Group of a group-stage match ("A", "B", ...). */
  group_name?: string | null;
  created_by: string;
  match_admins: string[] | null;
  /**
   * Streamers: may run the overlay graphics (`canProduceOverlay`) but not
   * score; never match admins.
   */
  match_streamers?: string[] | null;
  player_of_the_match_id: string | null;
  wickets_per_innings: number | null;
  last_man_stands: boolean | null;
  golden_ball: boolean | null;
  /**
   * The ball after a no-ball is a free hit (shown on the scoring screen,
   * which then offers only the dismissals allowed). Null or absent: on.
   */
  free_hit?: boolean | null;
  /**
   * Legacy home of the ball `seq` counter, no longer written: the counter
   * lives on the current innings (`InningsRow.last_ball_seq`); readers take
   * the larger of the two (`seqCounterOf` in `rpc/scoring.ts`).
   */
  last_ball_seq: number | null;
  /**
   * Ids of the last scoring actions sent with a client action id, oldest
   * first: a replay of one of them is not applied again (`rpc/scoring.ts`).
   * Written here only by structural changes; per-ball actions record theirs
   * on the current innings (`InningsRow.recent_client_actions`).
   */
  recent_client_actions?: string[] | null;
  /** Score line of each innings (stage 3, see `innings-summary.ts`). */
  innings_summary?: InningsSummaryEntry[] | null;
  /** Totals of `innings_summary` (`summaryTotalsOf`): club milestones. */
  summary_runs?: number | null;
  summary_wickets?: number | null;
  best_innings?: {
    runs: number;
    wickets: number;
    overs: number;
    team_id: string | null;
  } | null;
  best_innings_runs?: number | null;
  /** Display copies of the tournament / club (`match-snapshots.ts`). */
  tournament_snapshot?: {
    id: string;
    name: string | null;
    tournament_format: string | null;
    venue: string | null;
  } | null;
  club_snapshot?: {
    id: string;
    name: string | null;
    short_name: string | null;
  } | null;
  title_lower?: string;
  search_prefixes?: string[];
  created_at: string | null;
  updated_at: string | null;
}

export type InningsSummaryEntry = Pick<
  InningsRow,
  | "id"
  | "team_id"
  | "innings_number"
  | "total_runs"
  | "total_wickets"
  | "total_overs"
  | "total_balls"
  | "extras_total"
  | "is_completed"
  | "target_runs"
>;

export interface InningsRow {
  id: string;
  match_id: string | null;
  team_id: string;
  innings_number: number;
  total_runs: number | null;
  total_wickets: number | null;
  total_overs: number | null;
  total_balls: number | null;
  extras_total: number | null;
  extras_byes: number | null;
  extras_leg_byes: number | null;
  extras_wides: number | null;
  extras_no_balls: number | null;
  extras_penalties: number | null;
  extras_bonuses: number | null;
  is_completed: boolean | null;
  target_runs: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Scorecard and caches (schema stage 2, see `scorecard.ts`).
  batting?: BattingEntry[];
  bowling?: BowlingEntry[];
  fall_of_wickets?: FallOfWicketEntry[];
  partnerships?: PartnershipEntry[];
  last_ball?: LastBall | null;
  last_over_bowler_id?: string | null;
  // Per-ball match fields moved here (see `scripts/migrate-per-ball-fields.mjs`).
  /**
   * The match's ball `seq` counter while this is the current innings (the
   * highest seq assigned in the match so far); carried to the next innings
   * when it opens. Older matches keep it in `matches.last_ball_seq`.
   */
  last_ball_seq?: number | null;
  /**
   * Fielding-side penalty events logged in this innings for the other side
   * (`penalty_team_id` set and not this innings' team), which that side's
   * next innings starts with (Law 41.17). Kept by every ball-log rewrite so
   * closing the innings needs no ball-log read; absent on older innings.
   */
  carried_penalties?: LastBall[] | null;
  /** Client action ids applied while this is the current innings. */
  recent_client_actions?: string[] | null;
}

/**
 * The legacy row shapes below (batting / bowling performances, ball by
 * ball, partnerships, fall of wickets) are no longer stored as documents:
 * they are read from innings arrays and over documents (`scorecard.ts`,
 * `legacy-rows.ts`).
 */
export interface BattingPerformancesRow {
  id: string;
  match_id: string | null;
  innings_id: string | null;
  user_id: string;
  batting_position: number;
  runs_scored: number | null;
  balls_faced: number | null;
  minutes_batted: number | null;
  fours: number | null;
  sixes: number | null;
  is_out: boolean | null;
  dismissal_type: string | null;
  bowler_id: string | null;
  fielder_id: string | null;
  is_current_batsman: boolean | null;
  is_striker: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BowlingPerformancesRow {
  id: string;
  match_id: string | null;
  innings_id: string | null;
  user_id: string;
  overs_bowled: number | null;
  balls_bowled: number | null;
  runs_conceded: number | null;
  wickets_taken: number | null;
  maidens: number | null;
  wides: number | null;
  no_balls: number | null;
  is_current_bowler: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BallByBallRow {
  id: string;
  match_id: string | null;
  innings_id: string | null;
  over_number: number;
  ball_number: number;
  bowler_id: string | null;
  batsman_id: string | null;
  non_striker_id: string | null;
  runs_scored: number | null;
  extras: number | null;
  extra_type: string | null;
  is_wicket: boolean | null;
  dismissal_type: string | null;
  fielder_id: string | null;
  dismissed_player_id: string | null;
  commentary: string | null;
  shot_zone: string | null;
  /**
   * Penalty runs awarded to the fielding side (Law 41.17): the team they
   * belong to. Such an event counts only towards the innings that team
   * bats; absent on every other ball.
   */
  penalty_team_id?: string | null;
  /**
   * On a no-ball: what the runs the batters completed were. Absent (or
   * null): off the bat, in `runs_scored`. "bye" / "leg_bye": the ball was
   * not hit, and `extras` holds the 1-run no-ball penalty plus those byes
   * (or leg byes), which count to neither the striker nor the bowler.
   */
  no_ball_runs?: "bye" | "leg_bye" | null;
  seq: number;
  created_at: string | null;
}

export interface PartnershipsRow {
  id: string;
  match_id: string | null;
  innings_id: string | null;
  batsman1_id: string;
  batsman2_id: string;
  wicket_number: number | null;
  runs: number | null;
  balls: number | null;
  /**
   * Each batter's share: runs credited to them and balls they faced in the
   * stand (as on the batting card); the rest of `runs` is extras. Absent on
   * stands recorded before they were kept (until the next recompute).
   */
  batsman1_runs?: number | null;
  batsman1_balls?: number | null;
  batsman2_runs?: number | null;
  batsman2_balls?: number | null;
  start_over: number | null;
  end_over: number | null;
  is_current: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FallOfWicketsRow {
  id: string;
  match_id: string | null;
  innings_id: string | null;
  wicket_number: number;
  runs_at_fall: number;
  overs_at_fall: number;
  batsman_out_id: string;
  dismissal_type: string;
  bowler_id: string | null;
  fielder_id: string | null;
  created_at: string | null;
}

export interface PlayerCareerStatsRow {
  id: string;
  user_id: string | null;
  total_matches: number | null;
  total_innings_batted: number | null;
  total_runs: number | null;
  total_balls_faced: number | null;
  total_fours: number | null;
  total_sixes: number | null;
  highest_score: number | null;
  not_outs: number | null;
  centuries: number | null;
  half_centuries: number | null;
  total_innings_bowled: number | null;
  total_overs_bowled: number | null;
  total_balls_bowled: number | null;
  total_runs_conceded: number | null;
  total_wickets: number | null;
  best_bowling_figures: string | null;
  five_wicket_hauls: number | null;
  total_catches: number | null;
  total_stumpings: number | null;
  total_run_outs: number | null;
  batting_average: number | null;
  strike_rate: number | null;
  bowling_average: number | null;
  economy_rate: number | null;
  /** Exact running totals the columns above are derived from (stats.mjs). */
  acc?: StatsAcc;
  last_updated: string | null;
}

/** `leaderboards/{scope}_{scopeId}_{shard}`: one shard of a scope (see `stats.mjs`). */
export interface LeaderboardsRow {
  id: string;
  scope: "tournament" | "club";
  scope_id: string;
  /** 0 .. LEADERBOARD_SHARDS - 1; the players whose id hashes to it. */
  shard: number;
  players: Record<string, BoardPlayer>;
  updated_at: string | null;
}

/** The latest dismissal of the current innings (`live_state.last_wicket`). */
export interface LiveLastWicket {
  player_id: string;
  name: string | null;
  runs: number;
  balls: number;
  dismissal_type: string | null;
  /** The bowler credited with it (null for run outs and the like). */
  bowler_name: string | null;
  wicket_number: number;
  /** Team score when it fell: `score`/`wicket_number`. */
  score: number;
  /** Overs at the fall, as stored (e.g. 11.2). */
  overs: number;
}

/** A team's colours ("#rrggbb"), when it has them. */
export interface LiveTeamColours {
  primary: string | null;
  secondary: string | null;
}

/** The powerplay in progress (`live_state.powerplay`). */
export interface LivePowerplay {
  /** Its last over (1-based): overs 1 to `end_over`. */
  end_over: number;
}

export type LiveEventType =
  | "four"
  | "six"
  | "wicket"
  | "batter_milestone"
  | "bowler_milestone"
  | "hat_trick"
  | "partnership_milestone"
  | "over_end"
  | "innings_end"
  | "match_end"
  | "new_batter"
  | "new_bowler"
  | "free_hit";

/**
 * Something the change behind a `live_state` version did, for overlays to
 * react to (`live_state.events`, see `live-events.ts`). Every key is
 * present (null when it does not apply): Firestore stores no undefined.
 */
export interface LiveEvent {
  type: LiveEventType;
  /** The batter or bowler it is about. */
  player_id: string | null;
  name: string | null;
  /** The milestone: 50 / 100 runs, 3 / 5 wickets, a 50-run stand. */
  value: number | null;
  runs: number | null;
  balls: number | null;
  wickets: number | null;
  /** over_end: the over completed (1-based); innings_end: the innings. */
  number: number | null;
}

/** Denormalised read model for overlays and live pages (computed, not stored). */
export interface LiveMatchStateRow {
  match_id: string | null;
  title: string | null;
  status: string | null;
  match_format: string | null;
  overs_per_innings: number | null;
  venue: string | null;
  current_innings: number | null;
  current_over: number | null;
  current_ball: number | null;
  result_type: string | null;
  result_description: string | null;
  toss_winner_team_id: string | null;
  toss_decision: string | null;
  umpire1_name: string | null;
  umpire2_name: string | null;
  tournament_name: string | null;
  team1_name: string | null;
  team1_short_name: string | null;
  team1_logo_url: string | null;
  team2_name: string | null;
  team2_short_name: string | null;
  team2_logo_url: string | null;
  winning_team_name: string | null;
  innings_number: number | null;
  total_runs: number | null;
  total_wickets: number | null;
  total_overs: number | null;
  total_balls: number | null;
  extras_total: number | null;
  innings_completed: boolean | null;
  target_runs: number | null;
  batting_team_name: string | null;
  batting_team_short_name: string | null;
  bowling_team_name: string | null;
  bowling_team_short_name: string | null;
  striker_name: string | null;
  striker_runs: number | null;
  striker_balls: number | null;
  non_striker_name: string | null;
  non_striker_runs: number | null;
  non_striker_balls: number | null;
  current_bowler_name: string | null;
  bowler_balls: number | null;
  bowler_runs: number | null;
  bowler_wickets: number | null;
  partnership_runs: number | null;
  partnership_balls: number | null;
  this_over_balls: string | null;
  /** Runs off the deliveries in this_over_balls. */
  this_over_runs: number | null;
  current_run_rate: number | null;
  runs_needed: number | null;
  balls_remaining: number | null;
  required_run_rate: number | null;
  last_ball_runs: number | null;
  last_ball_extras: number | null;
  last_ball_extra_type: string | null;
  last_ball_is_wicket: boolean | null;
  last_ball_dismissal_type: string | null;
  last_ball_dismissed_player: string | null;
  last_ball_fielder: string | null;
  last_ball_commentary: string | null;
  last_ball_seq: number | null;
  /**
   * Overs of the current innings after a DLS revision (its target is
   * `target_runs`); absent when the innings has none.
   */
  dls_overs?: number | null;
  // Overlay fields (optional: documents written before they existed).
  /** The next delivery is a free hit (`~/lib/free-hit`). */
  free_hit?: boolean | null;
  striker_id?: string | null;
  striker_fours?: number | null;
  striker_sixes?: number | null;
  non_striker_id?: string | null;
  non_striker_fours?: number | null;
  non_striker_sixes?: number | null;
  bowler_id?: string | null;
  bowler_maidens?: number | null;
  last_wicket?: LiveLastWicket | null;
  powerplay?: LivePowerplay | null;
  /**
   * Team colours from the match's team snapshots; null when neither team
   * has any (one small key per ball: live_state is read on every ball).
   */
  team_colors?: {
    team1: LiveTeamColours | null;
    team2: LiveTeamColours | null;
  } | null;
  /** What the change behind this version did (empty for undo / edits). */
  events?: LiveEvent[];
}

/** Per-over rollup for Manhattan / over-comparison charts (computed). */
export interface MatchOverSummariesRow {
  match_id: string | null;
  innings_id: string | null;
  over_number: number | null;
  runs: number | null;
  extras_off_bat_and_bowler: number | null;
  extras_total: number | null;
  wickets: number | null;
  wides: number | null;
  no_balls: number | null;
  legal_deliveries: number | null;
  bowler_id: string | null;
}

/**
 * A fixed overlay link (`/overlay/channel/{id}`) for a club's ground or
 * camera position, or a clubless user's own. Whatever match it points at
 * is on air there (`~/lib/overlay/channels`).
 */
export interface StreamChannelsRow {
  id: string;
  /** Owning club; null for a personal channel. */
  club_id: string | null;
  /** Owning user of a personal channel (no club); null for a club's. */
  owner_id: string | null;
  name: string;
  match_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Server-only (rules deny clients): a match's remote-control token for
 * Stream Deck / Companion, stored as a SHA-256 hash of its secret
 * (`~/lib/overlay/remote-token`). The document id is the token's public id.
 */
export interface ProducerTokensRow {
  id: string;
  match_id: string;
  secret_hash: string;
  created_by: string | null;
  created_at: string | null;
}

export interface Database {
  users: UsersRow;
  users_private: UsersPrivateRow;
  clubs: ClubsRow;
  club_memberships: ClubMembershipsRow;
  club_invitations: ClubInvitationsRow;
  invitations: InvitationsRow;
  club_seasons: ClubSeasonsRow;
  club_hall_of_fame: ClubHallOfFameRow;
  teams: TeamsRow;
  team_players: TeamPlayersRow;
  tournaments: TournamentsRow;
  tournament_registrations: TournamentRegistrationsRow;
  tournament_standings: TournamentStandingsRow;
  matches: MatchesRow;
  innings: InningsRow;
  batting_performances: BattingPerformancesRow;
  bowling_performances: BowlingPerformancesRow;
  ball_by_ball: BallByBallRow;
  partnerships: PartnershipsRow;
  fall_of_wickets: FallOfWicketsRow;
  overs: OversRow;
  player_matches: PlayerMatchesRow;
  player_career_stats: PlayerCareerStatsRow;
  leaderboards: LeaderboardsRow;
  stream_channels: StreamChannelsRow;
  producer_tokens: ProducerTokensRow;
}

export interface Views {
  live_match_state: LiveMatchStateRow;
  match_over_summaries: MatchOverSummariesRow;
}

export type TableName = keyof Database;
export type ViewName = keyof Views;
export type SourceName = TableName | ViewName;

export type Tables<T extends TableName> = Database[T];

/** Row type for any queryable source (table or computed view). */
export type RowOf<T extends SourceName> = T extends TableName
  ? Database[T]
  : T extends ViewName
    ? Views[T]
    : never;

/**
 * Query results carry the selected columns plus any embedded relations
 * (`team1:teams(...)`, `innings(...)`, `_count:team_players(count)`), which
 * are resolved at runtime from the select string. They are typed loosely on
 * purpose: callers narrow rows with their own view-model types, and
 * `RowOf<T>` is available when the full document shape is wanted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
export type ResultRow<T extends SourceName> = any;

export type InsertRow<T extends TableName> = {
  [K in keyof Database[T]]?: Database[T][K] | null | undefined;
} & { [extra: string]: unknown };

export type UpdateRow<T extends TableName> = InsertRow<T>;

export interface DbError {
  message: string;
  code?: string;
  details?: string;
}

export type DbResult<T> =
  | { data: T; error: null; count?: number | null }
  | { data: null; error: DbError; count?: number | null };
