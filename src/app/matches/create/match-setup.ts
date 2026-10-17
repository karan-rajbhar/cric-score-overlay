/**
 * Pure helpers for the new-match form: format presets, which teams the
 * user may pick on each side (mirrors the checks in `createMatch`), the
 * reason the form cannot be submitted yet, and the last-used setup kept in
 * localStorage.
 */
import type { MatchFormat } from "../types";

export interface SetupTeam {
  id: string;
  name: string;
  short_name?: string | null;
  club_id?: string | null;
  created_by?: string | null;
  captain_id?: string | null;
  vice_captain_id?: string | null;
  /** Players on the squad, when the team doc carries its roster. */
  player_count?: number | null;
}

export interface FormatPreset {
  format: MatchFormat;
  label: string;
  overs: number | null;
}

export const FORMAT_PRESETS: readonly FormatPreset[] = [
  { format: "T20", label: "T20", overs: 20 },
  { format: "T10", label: "T10", overs: 10 },
  { format: "ODI", label: "ODI", overs: 50 },
  { format: "Custom", label: "Custom", overs: null },
];

export const LIMITS = {
  overs: { min: 1, max: 50 },
  wickets: { min: 1, max: 15 },
  ballsPerOver: { min: 2, max: 12 },
} as const;

/** Format that matches a number of overs (Custom when no preset does). */
export function formatForOvers(overs: number): MatchFormat {
  return (
    FORMAT_PRESETS.find((p) => p.overs === overs)?.format ?? "Custom"
  );
}

export function defaultTitle(team1?: SetupTeam, team2?: SetupTeam) {
  if (!team1 || !team2) return "";
  return `${team1.name} vs ${team2.name}`;
}

// ---------------------------------------------------------------------------
// Team eligibility
// ---------------------------------------------------------------------------

export interface TeamGroup {
  label: string;
  teams: SetupTeam[];
}

export interface EligibilityInput {
  teams: SetupTeam[];
  userId: string;
  playerTeamIds: readonly string[];
  clubAdminIds: ReadonlySet<string>;
  tournamentId: string;
  clubId: string;
  tournamentTeamIds: ReadonlySet<string>;
  /** Tournament created by the user or by a club they run. */
  isTournamentOrganizer: boolean;
}

/** Teams the user has a stake in: created, lead, plays for, or runs the club. */
export function myTeamIdsOf(
  teams: SetupTeam[],
  userId: string,
  playerTeamIds: readonly string[],
  clubAdminIds: ReadonlySet<string>,
): Set<string> {
  const players = new Set(playerTeamIds);
  const mine = new Set<string>();
  for (const t of teams) {
    if (
      t.created_by === userId ||
      t.captain_id === userId ||
      t.vice_captain_id === userId ||
      players.has(t.id) ||
      (t.club_id && clubAdminIds.has(t.club_id))
    ) {
      mine.add(t.id);
    }
  }
  return mine;
}

/**
 * Groups of teams that may be picked as Team 1 (host) and Team 2
 * (opponent). The other side's selection is not excluded here; the picker
 * does that.
 */
export function teamGroups(input: EligibilityInput): {
  myTeamIds: Set<string>;
  team1: TeamGroup[];
  team2: TeamGroup[];
} {
  const { teams, tournamentId, clubId, tournamentTeamIds, clubAdminIds } =
    input;
  const myTeamIds = myTeamIdsOf(
    teams,
    input.userId,
    input.playerTeamIds,
    clubAdminIds,
  );
  const isClubOrganizer = Boolean(clubId && clubAdminIds.has(clubId));

  const team1: TeamGroup[] = [
    { label: "My teams", teams: teams.filter((t) => myTeamIds.has(t.id)) },
    {
      label: "Tournament teams",
      teams: input.isTournamentOrganizer
        ? teams.filter(
            (t) => tournamentTeamIds.has(t.id) && !myTeamIds.has(t.id),
          )
        : [],
    },
    {
      label: "Club teams",
      teams: isClubOrganizer
        ? teams.filter((t) => t.club_id === clubId && !myTeamIds.has(t.id))
        : [],
    },
  ];

  let team2: TeamGroup[];
  if (tournamentId) {
    team2 = [
      {
        label: "Tournament teams",
        teams: teams.filter((t) => tournamentTeamIds.has(t.id)),
      },
    ];
  } else if (clubId) {
    team2 = [
      {
        label: "Club teams",
        teams: teams.filter((t) => t.club_id === clubId),
      },
      {
        label: "My other teams",
        teams: teams.filter(
          (t) => myTeamIds.has(t.id) && t.club_id !== clubId,
        ),
      },
    ];
  } else {
    team2 = [
      { label: "My teams", teams: teams.filter((t) => myTeamIds.has(t.id)) },
    ];
  }

  const nonEmpty = (groups: TeamGroup[]) =>
    groups.filter((g) => g.teams.length > 0);
  return { myTeamIds, team1: nonEmpty(team1), team2: nonEmpty(team2) };
}

/** Recently used teams first (most recent first), then the rest by name. */
export function sortByRecent(
  teams: SetupTeam[],
  recentIds: readonly string[],
): SetupTeam[] {
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  return [...teams].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.POSITIVE_INFINITY;
    const rb = rank.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

/** Case- and accent-insensitive match on name or short name. */
export function matchesTeamQuery(team: SetupTeam, query: string) {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const q = norm(query);
  if (!q) return true;
  return (
    norm(team.name).includes(q) ||
    Boolean(team.short_name && norm(team.short_name).includes(q))
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SetupValues {
  team1Id: string;
  team2Id: string;
  oversPerInnings: number;
  wicketsPerInnings: number;
  ballsPerOver: number;
  when: "now" | "later";
  scheduledAt: string;
}

const inRange = (n: number, r: { min: number; max: number }) =>
  Number.isInteger(n) && n >= r.min && n <= r.max;

const FIELD_NAMES = {
  overs: "Overs",
  wickets: "Wickets",
  ballsPerOver: "Balls per over",
} as const;

/** Inline message for a number field outside its range, or null. */
export function fieldError(field: keyof typeof LIMITS, n: number) {
  const r = LIMITS[field];
  return inRange(n, r)
    ? null
    : `${FIELD_NAMES[field]} must be between ${r.min} and ${r.max}`;
}

/**
 * Plain-language reason the match cannot be created yet, or null.
 * `eligible1` / `eligible2` are the ids the user may pick on each side.
 */
export function setupBlocker(
  v: SetupValues,
  eligible1: ReadonlySet<string>,
  eligible2: ReadonlySet<string>,
): string | null {
  if (!v.team1Id) return "Choose your team";
  if (!v.team2Id) return "Choose the opponent";
  if (v.team1Id === v.team2Id) return "Pick two different teams";
  if (!eligible1.has(v.team1Id)) return "You can't host a match for that team";
  if (!eligible2.has(v.team2Id))
    return "That opponent can't be picked for this match";
  const rules =
    fieldError("overs", v.oversPerInnings) ??
    fieldError("wickets", v.wicketsPerInnings) ??
    fieldError("ballsPerOver", v.ballsPerOver);
  if (rules) return rules;
  if (v.when === "later" && !v.scheduledAt) return "Pick a date and time";
  return null;
}

// ---------------------------------------------------------------------------
// Last-used setup (per browser)
// ---------------------------------------------------------------------------

export const SETUP_STORAGE_KEY = "cricscore:last-match-setup";
const MAX_RECENT = 8;

export interface StoredSetup {
  matchFormat: MatchFormat;
  oversPerInnings: number;
  wicketsPerInnings: number;
  ballsPerOver: number;
  wideCountsAsBallFaced: boolean;
  wideRunsToBatsman: boolean;
  noballExtrasToBatsman: boolean;
  lastTeam1Id: string;
  recentTeamIds: string[];
}

export const DEFAULT_SETUP: StoredSetup = {
  matchFormat: "T20",
  oversPerInnings: 20,
  wicketsPerInnings: 10,
  ballsPerOver: 6,
  wideCountsAsBallFaced: false,
  wideRunsToBatsman: false,
  noballExtrasToBatsman: false,
  lastTeam1Id: "",
  recentTeamIds: [],
};

const FORMATS = new Set<string>(FORMAT_PRESETS.map((p) => p.format));

export function loadSetup(): StoredSetup {
  try {
    const raw = window.localStorage.getItem(SETUP_STORAGE_KEY);
    if (!raw) return DEFAULT_SETUP;
    const parsed = JSON.parse(raw) as Partial<StoredSetup>;
    const num = (n: unknown, r: { min: number; max: number }, d: number) =>
      typeof n === "number" && inRange(n, r) ? n : d;
    const bool = (b: unknown) => b === true;
    return {
      matchFormat:
        typeof parsed.matchFormat === "string" && FORMATS.has(parsed.matchFormat)
          ? parsed.matchFormat
          : DEFAULT_SETUP.matchFormat,
      oversPerInnings: num(
        parsed.oversPerInnings,
        LIMITS.overs,
        DEFAULT_SETUP.oversPerInnings,
      ),
      wicketsPerInnings: num(
        parsed.wicketsPerInnings,
        LIMITS.wickets,
        DEFAULT_SETUP.wicketsPerInnings,
      ),
      ballsPerOver: num(
        parsed.ballsPerOver,
        LIMITS.ballsPerOver,
        DEFAULT_SETUP.ballsPerOver,
      ),
      wideCountsAsBallFaced: bool(parsed.wideCountsAsBallFaced),
      wideRunsToBatsman: bool(parsed.wideRunsToBatsman),
      noballExtrasToBatsman: bool(parsed.noballExtrasToBatsman),
      lastTeam1Id:
        typeof parsed.lastTeam1Id === "string" ? parsed.lastTeam1Id : "",
      recentTeamIds: Array.isArray(parsed.recentTeamIds)
        ? parsed.recentTeamIds
            .filter((id): id is string => typeof id === "string")
            .slice(0, MAX_RECENT)
        : [],
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

export function saveSetup(
  setup: Omit<StoredSetup, "recentTeamIds" | "lastTeam1Id">,
  team1Id: string,
  team2Id: string,
) {
  try {
    const previous = loadSetup().recentTeamIds;
    const recentTeamIds = [
      team1Id,
      team2Id,
      ...previous.filter((id) => id !== team1Id && id !== team2Id),
    ].slice(0, MAX_RECENT);
    const value: StoredSetup = { ...setup, lastTeam1Id: team1Id, recentTeamIds };
    window.localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the form still works with defaults.
  }
}
