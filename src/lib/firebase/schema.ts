/**
 * Collection metadata that used to live in Postgres DDL: column lists,
 * defaults, unique constraints and cascading deletes.
 *
 * The query builder uses this to apply defaults on insert, reject duplicate
 * rows the way a unique index would, cascade deletes like `ON DELETE
 * CASCADE`, and resolve embedded relations from column names.
 */

import { MATCH_PARENT_SNAPSHOTS, ROSTER_USER_FIELDS } from "./derive.mjs";
import type { TableName, ViewName } from "./types";

export const TABLE_NAMES: readonly TableName[] = [
  "users",
  "users_private",
  "clubs",
  "club_memberships",
  "club_invitations",
  "invitations",
  "club_seasons",
  "club_hall_of_fame",
  "teams",
  "team_players",
  "tournaments",
  "tournament_registrations",
  "tournament_standings",
  "matches",
  "innings",
  "batting_performances",
  "bowling_performances",
  "ball_by_ball",
  "partnerships",
  "fall_of_wickets",
  "overs",
  "player_matches",
  "player_career_stats",
  "leaderboards",
] as const;

/**
 * Legacy row collections that are no longer stored (schema stage 2): reads
 * are served from innings arrays / over documents by `legacy-rows.ts`, and
 * writes go through the scoring engine.
 */
export const DERIVED_TABLES: readonly TableName[] = [
  "batting_performances",
  "bowling_performances",
  "ball_by_ball",
  "partnerships",
  "fall_of_wickets",
] as const;

export function isDerivedTable(name: string): boolean {
  return (DERIVED_TABLES as readonly string[]).includes(name);
}

export const VIEW_NAMES: readonly ViewName[] = [
  "live_match_state",
  "match_over_summaries",
] as const;

export function isTableName(name: string): name is TableName {
  return (TABLE_NAMES as readonly string[]).includes(name);
}

export function isViewName(name: string): name is ViewName {
  return (VIEW_NAMES as readonly string[]).includes(name);
}

/** Columns per collection (used for relation inference and projection). */
export const TABLE_COLUMNS: Record<TableName, readonly string[]> = {
  users: [
    "id",
    "full_name",
    "avatar_url",
    "location",
    "username",
    "is_active",
    "name_lower",
    "search_prefixes",
    "created_at",
    "updated_at",
  ],
  // Server-only (rules deny clients); keyed by the user's id.
  users_private: ["id", "email", "phone", "created_at", "updated_at"],
  clubs: [
    "id",
    "name",
    "short_name",
    "description",
    "logo_url",
    "banner_url",
    "location",
    "contact_email",
    "contact_phone",
    "website_url",
    "is_public",
    "club_type",
    "founded_year",
    "owner_id",
    "social_links",
    "name_lower",
    "search_prefixes",
    "created_at",
    "updated_at",
  ],
  club_memberships: [
    "id",
    "club_id",
    "user_id",
    "role",
    "status",
    "user_snapshot",
    "joined_at",
    "updated_at",
  ],
  invitations: [
    "id",
    "email",
    "invited_by",
    "status",
    "accepted_by",
    "scorer_match_ids",
    "created_at",
    "updated_at",
  ],
  club_invitations: [
    "id",
    "club_id",
    "invited_by",
    "email",
    "phone",
    "user_id",
    "status",
    "expires_at",
    "created_at",
    "updated_at",
  ],
  club_seasons: [
    "id",
    "club_id",
    "name",
    "start_date",
    "end_date",
    "is_current",
    "created_at",
    "updated_at",
  ],
  club_hall_of_fame: [
    "id",
    "club_id",
    "player_id",
    "category",
    "title",
    "description",
    "season_or_year",
    "record_metric",
    "created_by",
    "inducted_at",
  ],
  teams: [
    "id",
    "name",
    "short_name",
    "description",
    "logo_url",
    "club_id",
    "captain_id",
    "vice_captain_id",
    "team_type",
    "is_template",
    "created_by",
    "name_lower",
    "search_prefixes",
    "roster",
    "created_at",
    "updated_at",
  ],
  team_players: [
    "id",
    "team_id",
    "user_id",
    "jersey_number",
    "batting_order",
    "is_playing_xi",
    "role_in_team",
    "added_by",
    "created_at",
  ],
  tournaments: [
    "id",
    "name",
    "description",
    "tournament_format",
    "match_format",
    "custom_overs",
    "overs_per_innings",
    "start_date",
    "end_date",
    "registration_deadline",
    "max_teams",
    "entry_fee",
    "prize_pool",
    "venue",
    "rules",
    "status",
    "is_public",
    "club_id",
    "season_id",
    "wickets_per_innings",
    "last_man_stands",
    "golden_ball",
    "created_by",
    "name_lower",
    "search_prefixes",
    "created_at",
    "updated_at",
  ],
  tournament_registrations: [
    "id",
    "tournament_id",
    "team_id",
    "registered_by",
    "status",
    "payment_status",
    "registration_fee",
    "approved_by",
    "approved_at",
    "registered_at",
    "updated_at",
  ],
  tournament_standings: [
    "id",
    "tournament_id",
    "team_id",
    "matches_played",
    "wins",
    "losses",
    "ties",
    "no_results",
    "points",
    "points_adjustment",
    "adjustment_reason",
    "qualification_status",
    "runs_scored",
    "runs_conceded",
    "overs_faced",
    "overs_bowled",
    "net_run_rate",
    "updated_at",
  ],
  matches: [
    "id",
    "title",
    "match_format",
    "overs_per_innings",
    "balls_per_over",
    "max_balls_per_over",
    "wide_counts_as_ball_faced",
    "wide_runs_to_batsman",
    "noball_extras_to_batsman",
    "team1_id",
    "team2_id",
    "team1_snapshot",
    "team2_snapshot",
    "venue",
    "scheduled_at",
    "actual_start_time",
    "actual_end_time",
    "status",
    "toss_winner_team_id",
    "toss_decision",
    "current_innings",
    "current_over",
    "current_ball",
    "weather_conditions",
    "pitch_conditions",
    "result_type",
    "winning_team_id",
    "win_margin_type",
    "win_margin",
    "result_description",
    "umpire1_name",
    "umpire2_name",
    "third_umpire_name",
    "scorer_name",
    "tournament_id",
    "club_id",
    "season_id",
    "created_by",
    "match_admins",
    "player_of_the_match_id",
    "wickets_per_innings",
    "last_man_stands",
    "golden_ball",
    "last_ball_seq",
    "innings_summary",
    "tournament_snapshot",
    "club_snapshot",
    "title_lower",
    "search_prefixes",
    "created_at",
    "updated_at",
  ],
  innings: [
    "id",
    "match_id",
    "team_id",
    "innings_number",
    "total_runs",
    "total_wickets",
    "total_overs",
    "total_balls",
    "extras_total",
    "extras_byes",
    "extras_leg_byes",
    "extras_wides",
    "extras_no_balls",
    "extras_penalties",
    "extras_bonuses",
    "is_completed",
    "target_runs",
    "batting",
    "bowling",
    "fall_of_wickets",
    "partnerships",
    "last_ball",
    "last_over_bowler_id",
    "created_at",
    "updated_at",
  ],
  batting_performances: [
    "id",
    "match_id",
    "innings_id",
    "user_id",
    "batting_position",
    "runs_scored",
    "balls_faced",
    "minutes_batted",
    "fours",
    "sixes",
    "is_out",
    "dismissal_type",
    "bowler_id",
    "fielder_id",
    "is_current_batsman",
    "is_striker",
    "created_at",
    "updated_at",
  ],
  bowling_performances: [
    "id",
    "match_id",
    "innings_id",
    "user_id",
    "overs_bowled",
    "balls_bowled",
    "runs_conceded",
    "wickets_taken",
    "maidens",
    "wides",
    "no_balls",
    "is_current_bowler",
    "created_at",
    "updated_at",
  ],
  ball_by_ball: [
    "id",
    "match_id",
    "innings_id",
    "over_number",
    "ball_number",
    "bowler_id",
    "batsman_id",
    "non_striker_id",
    "runs_scored",
    "extras",
    "extra_type",
    "is_wicket",
    "dismissal_type",
    "fielder_id",
    "dismissed_player_id",
    "commentary",
    "shot_zone",
    "penalty_team_id",
    "seq",
    "created_at",
  ],
  partnerships: [
    "id",
    "match_id",
    "innings_id",
    "batsman1_id",
    "batsman2_id",
    "wicket_number",
    "runs",
    "balls",
    "start_over",
    "end_over",
    "is_current",
    "created_at",
    "updated_at",
  ],
  fall_of_wickets: [
    "id",
    "match_id",
    "innings_id",
    "wicket_number",
    "runs_at_fall",
    "overs_at_fall",
    "batsman_out_id",
    "dismissal_type",
    "bowler_id",
    "fielder_id",
    "created_at",
  ],
  overs: ["id", "match_id", "innings_id", "over_number", "balls", "updated_at"],
  player_matches: [
    "id",
    "user_id",
    "match_id",
    "tournament_id",
    "club_id",
    "season_id",
    "match_date",
    "batting",
    "bowling",
    "fielding",
    "updated_at",
  ],
  player_career_stats: [
    "id",
    "user_id",
    "total_matches",
    "total_innings_batted",
    "total_runs",
    "total_balls_faced",
    "total_fours",
    "total_sixes",
    "highest_score",
    "not_outs",
    "centuries",
    "half_centuries",
    "total_innings_bowled",
    "total_overs_bowled",
    "total_balls_bowled",
    "total_runs_conceded",
    "total_wickets",
    "best_bowling_figures",
    "five_wicket_hauls",
    "total_catches",
    "total_stumpings",
    "total_run_outs",
    "batting_average",
    "strike_rate",
    "bowling_average",
    "economy_rate",
    "acc",
    "last_updated",
  ],
  // `leaderboards/{scope}_{scopeId}`: per-player accumulators (stats.mjs).
  leaderboards: ["id", "scope", "scope_id", "players", "updated_at"],
};

/**
 * Storage-only fields (search keys, denormalized copies) left out of
 * `select("*")` results unless named explicitly.
 */
export const HIDDEN_COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  users: ["name_lower", "search_prefixes"],
  clubs: ["name_lower", "search_prefixes"],
  teams: ["name_lower", "search_prefixes", "roster"],
  tournaments: ["name_lower", "search_prefixes"],
  matches: [
    "title_lower",
    "search_prefixes",
    "innings_summary",
    "tournament_snapshot",
    "club_snapshot",
  ],
  club_memberships: ["user_snapshot"],
};

/**
 * Many-to-one relations a row can answer from a copy it carries: for
 * `club_memberships.user_id`, the profile snapshot in `user_snapshot`
 * (kept in step by the derived-fields data source). A relation selecting
 * only the copied columns then reads nothing.
 */
export const CARRIED_SNAPSHOTS: Partial<
  Record<
    TableName,
    Record<
      string,
      { field: string; table: TableName; columns: readonly string[] }
    >
  >
> = {
  club_memberships: {
    user_id: {
      field: "user_snapshot",
      table: "users",
      columns: ROSTER_USER_FIELDS,
    },
  },
  // `tournament_snapshot` / `club_snapshot` (see match-snapshots.ts).
  matches: Object.fromEntries(
    MATCH_PARENT_SNAPSHOTS.map((s) => [
      s.local,
      { field: s.field, table: s.table, columns: s.columns },
    ]),
  ),
};

/**
 * Column defaults, mirroring the old `DEFAULT ...` clauses. Timestamp
 * defaults (`created_at`, `updated_at`, `joined_at`, ...) are applied
 * separately because they depend on the insert time.
 */
export const TABLE_DEFAULTS: Partial<
  Record<TableName, Record<string, unknown>>
> = {
  users: { is_active: true },
  clubs: { is_public: true, club_type: "community", social_links: {} },
  club_memberships: { role: "member", status: "active" },
  club_invitations: { status: "pending" },
  invitations: { status: "pending" },
  club_seasons: { is_current: false },
  teams: { team_type: "club", is_template: false, roster: [] },
  team_players: { is_playing_xi: false },
  tournaments: {
    tournament_format: "league",
    match_format: "T20",
    status: "upcoming",
    is_public: true,
    wickets_per_innings: 10,
    last_man_stands: false,
    golden_ball: false,
  },
  tournament_registrations: { status: "pending", payment_status: "pending" },
  tournament_standings: {
    matches_played: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    no_results: 0,
    points: 0,
    points_adjustment: 0,
    qualification_status: "in_contention",
    runs_scored: 0,
    runs_conceded: 0,
    overs_faced: 0,
    overs_bowled: 0,
    net_run_rate: 0,
  },
  matches: {
    match_format: "T20",
    overs_per_innings: 20,
    balls_per_over: 6,
    max_balls_per_over: null,
    wide_counts_as_ball_faced: false,
    wide_runs_to_batsman: false,
    noball_extras_to_batsman: false,
    status: "scheduled",
    current_innings: 1,
    current_over: 0,
    current_ball: 0,
    match_admins: [],
    wickets_per_innings: 10,
    last_man_stands: false,
    golden_ball: false,
    last_ball_seq: 0,
    innings_summary: [],
  },
  innings: {
    total_runs: 0,
    total_wickets: 0,
    total_overs: 0,
    total_balls: 0,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    extras_bonuses: 0,
    is_completed: false,
    target_runs: null,
    batting: [],
    bowling: [],
    fall_of_wickets: [],
    partnerships: [],
    last_ball: null,
    last_over_bowler_id: null,
  },
  batting_performances: {
    runs_scored: 0,
    balls_faced: 0,
    minutes_batted: 0,
    fours: 0,
    sixes: 0,
    is_out: false,
    is_current_batsman: false,
    is_striker: false,
  },
  bowling_performances: {
    overs_bowled: 0,
    balls_bowled: 0,
    runs_conceded: 0,
    wickets_taken: 0,
    maidens: 0,
    wides: 0,
    no_balls: 0,
    is_current_bowler: false,
  },
  ball_by_ball: { runs_scored: 0, extras: 0, is_wicket: false },
  partnerships: { runs: 0, balls: 0, is_current: false },
};

/** Columns that default to "now" on insert. */
export const TIMESTAMP_DEFAULTS: Partial<Record<TableName, readonly string[]>> =
  {
    users: ["created_at", "updated_at"],
    users_private: ["created_at", "updated_at"],
    clubs: ["created_at", "updated_at"],
    club_memberships: ["joined_at", "updated_at"],
    club_invitations: ["created_at", "updated_at"],
    invitations: ["created_at", "updated_at"],
    club_seasons: ["created_at", "updated_at"],
    club_hall_of_fame: ["inducted_at"],
    teams: ["created_at", "updated_at"],
    team_players: ["created_at"],
    tournaments: ["created_at", "updated_at"],
    tournament_registrations: ["registered_at", "updated_at"],
    tournament_standings: ["updated_at"],
    matches: ["created_at", "updated_at"],
    innings: ["created_at", "updated_at"],
    batting_performances: ["created_at", "updated_at"],
    bowling_performances: ["created_at", "updated_at"],
    ball_by_ball: ["created_at"],
    partnerships: ["created_at", "updated_at"],
    fall_of_wickets: ["created_at"],
    overs: ["updated_at"],
    player_matches: ["updated_at"],
    player_career_stats: ["last_updated"],
    leaderboards: ["updated_at"],
  };

/** Unique constraints enforced before insert (Postgres error code 23505). */
export const UNIQUE_CONSTRAINTS: Partial<
  Record<
    TableName,
    readonly {
      name: string;
      columns: readonly string[];
      caseInsensitive?: boolean;
    }[]
  >
> = {
  users_private: [
    {
      name: "users_private_email_key",
      columns: ["email"],
      caseInsensitive: true,
    },
    { name: "users_private_phone_key", columns: ["phone"] },
  ],
  users: [
    {
      name: "users_username_lower_idx",
      columns: ["username"],
      caseInsensitive: true,
    },
  ],
  club_memberships: [
    {
      name: "club_memberships_club_id_user_id_key",
      columns: ["club_id", "user_id"],
    },
  ],
  team_players: [
    {
      name: "team_players_team_id_user_id_key",
      columns: ["team_id", "user_id"],
    },
  ],
  tournament_registrations: [
    {
      name: "tournament_registrations_tournament_id_team_id_key",
      columns: ["tournament_id", "team_id"],
    },
  ],
  tournament_standings: [
    {
      name: "tournament_standings_tournament_id_team_id_key",
      columns: ["tournament_id", "team_id"],
    },
  ],
  innings: [
    {
      name: "innings_match_id_innings_number_key",
      columns: ["match_id", "innings_number"],
    },
  ],
  batting_performances: [
    {
      name: "batting_performances_innings_user_unique",
      columns: ["innings_id", "user_id"],
    },
  ],
  bowling_performances: [
    {
      name: "bowling_performances_innings_user_unique",
      columns: ["innings_id", "user_id"],
    },
  ],
  player_career_stats: [
    { name: "player_career_stats_user_id_key", columns: ["user_id"] },
  ],
};

/**
 * `ON DELETE CASCADE` / `ON DELETE SET NULL` behaviour. When a document in
 * `parent` is deleted, children are removed (cascade) or unlinked (setNull).
 */
export const CASCADE_RULES: Partial<
  Record<
    TableName,
    readonly {
      table: TableName;
      column: string;
      action: "cascade" | "setNull";
    }[]
  >
> = {
  users: [
    { table: "club_memberships", column: "user_id", action: "cascade" },
    { table: "club_invitations", column: "user_id", action: "cascade" },
    { table: "team_players", column: "user_id", action: "cascade" },
    { table: "player_career_stats", column: "user_id", action: "cascade" },
    { table: "matches", column: "player_of_the_match_id", action: "setNull" },
  ],
  clubs: [
    { table: "club_memberships", column: "club_id", action: "cascade" },
    { table: "club_invitations", column: "club_id", action: "cascade" },
    { table: "club_seasons", column: "club_id", action: "cascade" },
    { table: "club_hall_of_fame", column: "club_id", action: "cascade" },
    { table: "teams", column: "club_id", action: "setNull" },
    { table: "tournaments", column: "club_id", action: "setNull" },
    { table: "matches", column: "club_id", action: "setNull" },
  ],
  club_seasons: [
    { table: "matches", column: "season_id", action: "setNull" },
    { table: "tournaments", column: "season_id", action: "setNull" },
  ],
  teams: [
    { table: "team_players", column: "team_id", action: "cascade" },
    { table: "tournament_registrations", column: "team_id", action: "cascade" },
    { table: "tournament_standings", column: "team_id", action: "cascade" },
  ],
  tournaments: [
    {
      table: "tournament_registrations",
      column: "tournament_id",
      action: "cascade",
    },
    {
      table: "tournament_standings",
      column: "tournament_id",
      action: "cascade",
    },
    { table: "matches", column: "tournament_id", action: "setNull" },
  ],
  // player_matches (and the statistics built from them) are removed by
  // the matches write hook, inside a transaction.
  matches: [
    { table: "innings", column: "match_id", action: "cascade" },
    { table: "overs", column: "match_id", action: "cascade" },
  ],
  innings: [{ table: "overs", column: "innings_id", action: "cascade" }],
};

/** Singular noun for each collection, used to infer `<singular>_id` columns. */
export const SINGULAR: Record<TableName, string> = {
  users: "user",
  users_private: "user_private",
  clubs: "club",
  club_memberships: "club_membership",
  club_invitations: "club_invitation",
  invitations: "invitation",
  club_seasons: "season",
  club_hall_of_fame: "hall_of_fame",
  teams: "team",
  team_players: "team_player",
  tournaments: "tournament",
  tournament_registrations: "tournament_registration",
  tournament_standings: "tournament_standing",
  matches: "match",
  innings: "innings",
  batting_performances: "batting_performance",
  bowling_performances: "bowling_performance",
  ball_by_ball: "ball",
  partnerships: "partnership",
  fall_of_wickets: "fall_of_wicket",
  overs: "over",
  player_matches: "player_match",
  player_career_stats: "player_career_stat",
  leaderboards: "leaderboard",
};

/**
 * Every column that references `users.id`. Used when an auth account is
 * re-mapped onto an existing profile (the old `ON UPDATE CASCADE`).
 */
export const USER_REFERENCES: readonly {
  table: TableName;
  column: string;
  array?: boolean;
}[] = [
  { table: "clubs", column: "owner_id" },
  { table: "club_memberships", column: "user_id" },
  { table: "club_invitations", column: "invited_by" },
  { table: "club_invitations", column: "user_id" },
  { table: "invitations", column: "invited_by" },
  { table: "invitations", column: "accepted_by" },
  { table: "club_hall_of_fame", column: "player_id" },
  { table: "club_hall_of_fame", column: "created_by" },
  { table: "teams", column: "captain_id" },
  { table: "teams", column: "vice_captain_id" },
  { table: "teams", column: "created_by" },
  { table: "team_players", column: "user_id" },
  { table: "team_players", column: "added_by" },
  { table: "tournaments", column: "created_by" },
  { table: "tournament_registrations", column: "registered_by" },
  { table: "tournament_registrations", column: "approved_by" },
  { table: "matches", column: "created_by" },
  { table: "matches", column: "player_of_the_match_id" },
  { table: "matches", column: "match_admins", array: true },
  // Scorecards (innings arrays, over documents, player_matches) embed user
  // ids inside nested values; `remapScorecardUserId` rewrites those, and
  // the statistics (career / leaderboards) follow the player records.
];

export function hasColumn(table: TableName, column: string): boolean {
  return TABLE_COLUMNS[table].includes(column);
}
