"use server";

import { revalidatePath } from "next/cache";
import { createServerClient, type ServerClient } from "~/lib/firebase/server";
import { isClubAdminOf } from "~/lib/firebase/permissions";
import { teamSnapshot } from "~/lib/firebase/team-snapshot";
import type { TeamSnapshot } from "~/lib/firebase/types";
import {
  planNextRound,
  type BracketMatch,
  type NextRound,
} from "~/lib/tournament-scheduler";

/**
 * "Create next round" for knockout and mixed tournaments: the groups, the
 * first knockout round (with byes), then each next round from the results.
 * Matches are created only between known teams (no "winner of" slots), so
 * the organiser runs this again after each round. Reads: the tournament, its
 * confirmed registrations and its matches; writes: the new matches.
 */

export interface NextRoundOptions {
  groupCount?: number;
  qualifiersPerGroup?: number;
}

export interface NextRoundPreview {
  kind: NextRound["kind"];
  /** "Group stage", "Semi-final". */
  label: string | null;
  matches: { label: string; home: string; away: string }[];
  byes: string[];
  /** Why nothing can be created yet, or who won. */
  message: string | null;
  /** Inputs this step needs (mixed tournaments). */
  needsGroupCount: boolean;
  needsQualifiers: boolean;
  teamCount: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SummaryEntry {
  team_id?: string | null;
  total_runs?: number | null;
  total_balls?: number | null;
  total_wickets?: number | null;
}

interface Loaded {
  db: ServerClient;
  userId: string;
  tournament: Record<string, unknown> & { id: string };
  seeds: string[];
  teams: Map<string, TeamSnapshot>;
  matches: BracketMatch[];
  latestScheduled: string | null;
}

const num = (v: unknown, fallback: number) =>
  Number(v) > 0 ? Number(v) : fallback;
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** A group / knockout match as the planner sees it; null for other matches. */
function toBracketMatch(m: Record<string, unknown>): BracketMatch | null {
  if (m.stage !== "group" && m.stage !== "knockout") return null;
  const bpo = num(m.balls_per_over, 6);
  const cap = num(m.wickets_per_innings, 10);
  return {
    id: String(m.id),
    stage: m.stage,
    round: typeof m.round === "number" ? m.round : null,
    group: str(m.group_name),
    team1Id: String(m.team1_id),
    team2Id: String(m.team2_id),
    status: String(m.status),
    winnerId: str(m.winning_team_id),
    resultType: str(m.result_type),
    ballsPerOver: bpo,
    quotaBalls: num(m.overs_per_innings, 0) * bpo,
    totals: ((m.innings_summary ?? []) as SummaryEntry[])
      .filter((e) => e.team_id)
      .map((e) => ({
        teamId: e.team_id!,
        runs: e.total_runs ?? 0,
        balls: e.total_balls ?? 0,
        allOut: (e.total_wickets ?? 0) >= cap,
      })),
  };
}

interface RegistrationRow {
  id: string;
  team_id: string | null;
  registered_at?: string | null;
  team?: unknown;
}

/** Seeds in registration order (earliest first) and the teams' snapshots. */
function seedsOf(regs: RegistrationRow[]): {
  seeds: string[];
  teams: Map<string, TeamSnapshot>;
} {
  const ordered = [...regs].sort(
    (a, b) =>
      String(a.registered_at ?? "").localeCompare(String(b.registered_at ?? "")) ||
      a.id.localeCompare(b.id),
  );
  const teams = new Map<string, TeamSnapshot>();
  for (const r of ordered) {
    const team = Array.isArray(r.team) ? r.team[0] : r.team;
    if (r.team_id && team) teams.set(r.team_id, teamSnapshot(team as TeamSnapshot));
  }
  const seeds = ordered.map((r) => r.team_id).filter((t): t is string => !!t);
  return { seeds, teams };
}

async function load(
  tournamentId: string,
): Promise<{ data: Loaded | null; error: string | null }> {
  if (!UUID_RE.test(tournamentId)) return { data: null, error: "Tournament not found" };
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { data: null, error: "You must be logged in" };

  const { data: tournament } = await db
    .from("tournaments")
    .select(
      "id, name, tournament_format, match_format, overs_per_innings, venue, start_date, club_id, season_id, wickets_per_innings, last_man_stands, golden_ball, created_by",
    )
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) return { data: null, error: "Tournament not found" };
  const isAdmin =
    tournament.created_by === user.id ||
    (await isClubAdminOf(db, tournament.club_id, user.id));
  if (!isAdmin) {
    return { data: null, error: "Only tournament organisers can create rounds" };
  }

  const [{ data: regs, error: regError }, { data: rows, error: matchError }] =
    await Promise.all([
      db
        .from("tournament_registrations")
        .select("id, team_id, registered_at, team:teams(id, name, short_name, logo_url)")
        .eq("tournament_id", tournamentId)
        .eq("status", "confirmed"),
      db
        .from("matches")
        .select(
          "id, status, stage, round, group_name, team1_id, team2_id, winning_team_id, result_type, scheduled_at, balls_per_over, overs_per_innings, wickets_per_innings, innings_summary",
        )
        .eq("tournament_id", tournamentId),
    ]);
  if (regError || matchError) {
    return { data: null, error: regError?.message ?? matchError?.message ?? "Could not load" };
  }

  const { seeds, teams } = seedsOf((regs ?? []) as RegistrationRow[]);
  const all = (rows ?? []) as Array<Record<string, unknown>>;
  const latestScheduled =
    all
      .map((m) => str(m.scheduled_at))
      .filter((at): at is string => !!at)
      .sort()
      .at(-1) ?? null;
  const matches = all
    .map(toBracketMatch)
    .filter((m): m is BracketMatch => m !== null);
  return {
    data: {
      db,
      userId: user.id,
      tournament: tournament as Loaded["tournament"],
      seeds,
      teams,
      matches,
      latestScheduled,
    },
    error: null,
  };
}

function plan(loaded: Loaded, options: NextRoundOptions): NextRound {
  return planNextRound({
    format: loaded.tournament.tournament_format as string | null,
    seeds: loaded.seeds,
    matches: loaded.matches,
    groupCount: options.groupCount,
    qualifiersPerGroup: options.qualifiersPerGroup,
  });
}

function nameOf(loaded: Loaded, teamId: string): string {
  return loaded.teams.get(teamId)?.name ?? "Team";
}

function previewOf(loaded: Loaded, next: NextRound): NextRoundPreview {
  const format = loaded.tournament.tournament_format;
  const groupStage = loaded.matches.some((m) => m.stage === "group");
  const knockout = loaded.matches.some((m) => m.stage === "knockout");
  const base: NextRoundPreview = {
    kind: next.kind,
    label: null,
    matches: [],
    byes: [],
    message: null,
    needsGroupCount: format === "mixed" && !groupStage,
    needsQualifiers: format === "mixed" && groupStage && !knockout,
    teamCount: loaded.seeds.length,
  };
  switch (next.kind) {
    case "groups":
      return {
        ...base,
        label: "Group stage",
        matches: next.fixtures.map((f) => ({
          label: `Group ${f.group}`,
          home: nameOf(loaded, f.homeTeamId),
          away: nameOf(loaded, f.awayTeamId),
        })),
      };
    case "knockout":
      return {
        ...base,
        label: next.label,
        matches: next.fixtures.map((f) => ({
          label: f.label,
          home: nameOf(loaded, f.homeTeamId),
          away: nameOf(loaded, f.awayTeamId),
        })),
        byes: next.byes.map((t) => nameOf(loaded, t)),
      };
    case "waiting":
      return {
        ...base,
        message: `${next.matchIds.length} ${next.matchIds.length === 1 ? "match" : "matches"} of the current round still to finish.`,
      };
    case "undecided":
      return {
        ...base,
        message: `${next.matchIds.length} ${next.matchIds.length === 1 ? "match has" : "matches have"} no winner yet. Decide ${next.matchIds.length === 1 ? "it" : "them"} (a super over or a replay) first.`,
      };
    case "complete":
      return { ...base, message: `${nameOf(loaded, next.championId)} won the tournament.` };
    case "invalid":
      return { ...base, message: next.reason };
  }
}

/** What "Create next round" would create (nothing is written). */
export async function previewNextRound(
  tournamentId: string,
  options: NextRoundOptions = {},
): Promise<{ data: NextRoundPreview | null; error: string | null }> {
  try {
    const { data: loaded, error } = await load(tournamentId);
    if (!loaded) return { data: null, error };
    return { data: previewOf(loaded, plan(loaded, options)), error: null };
  } catch (err) {
    console.error("previewNextRound failed:", err);
    return { data: null, error: "Could not work out the next round" };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day after the latest fixture, else the start date, else tomorrow. */
function firstDay(loaded: Loaded): number {
  if (loaded.latestScheduled) {
    const t = Date.parse(loaded.latestScheduled);
    if (!Number.isNaN(t)) return t + DAY_MS;
  }
  const start = Date.parse(String(loaded.tournament.start_date ?? ""));
  return Number.isNaN(start) ? Date.now() + DAY_MS : start;
}

/** Creates the next round's matches. */
export async function createNextRound(
  tournamentId: string,
  options: NextRoundOptions = {},
): Promise<{ data: { count: number; label: string } | null; error: string | null }> {
  try {
    const { data: loaded, error } = await load(tournamentId);
    if (!loaded) return { data: null, error };
    const next = plan(loaded, options);
    if (next.kind !== "groups" && next.kind !== "knockout") {
      return { data: null, error: previewOf(loaded, next).message };
    }
    const t = loaded.tournament;
    const day0 = firstDay(loaded);
    const common = {
      match_format: (t.match_format as string | null) ?? "T20",
      overs_per_innings: (t.overs_per_innings as number | null) ?? 20,
      tournament_id: t.id,
      club_id: (t.club_id as string | null) ?? null,
      season_id: (t.season_id as string | null) ?? null,
      wickets_per_innings: (t.wickets_per_innings as number | null) ?? 10,
      last_man_stands: (t.last_man_stands as boolean | null) ?? false,
      golden_ball: (t.golden_ball as boolean | null) ?? false,
      venue: (t.venue as string | null) ?? null,
      status: "scheduled",
      created_by: loaded.userId,
      match_admins: [loaded.userId],
    };
    const rows =
      next.kind === "groups"
        ? next.fixtures.map((f) => {
            const home = nameOf(loaded, f.homeTeamId);
            const away = nameOf(loaded, f.awayTeamId);
            return {
              ...common,
              title: `${home} vs ${away} (Group ${f.group})`,
              team1_id: f.homeTeamId,
              team2_id: f.awayTeamId,
              team1_snapshot: loaded.teams.get(f.homeTeamId) ?? null,
              team2_snapshot: loaded.teams.get(f.awayTeamId) ?? null,
              scheduled_at: new Date(day0 + (f.round - 1) * DAY_MS).toISOString(),
              stage: "group",
              round: f.round,
              group_name: f.group,
            };
          })
        : next.fixtures.map((f) => {
            const home = nameOf(loaded, f.homeTeamId);
            const away = nameOf(loaded, f.awayTeamId);
            return {
              ...common,
              title: `${f.label}: ${home} vs ${away}`,
              team1_id: f.homeTeamId,
              team2_id: f.awayTeamId,
              team1_snapshot: loaded.teams.get(f.homeTeamId) ?? null,
              team2_snapshot: loaded.teams.get(f.awayTeamId) ?? null,
              scheduled_at: new Date(day0).toISOString(),
              stage: "knockout",
              round: f.round,
              group_name: null,
            };
          });
    const { error: insertError } = await loaded.db.from("matches").insert(rows);
    if (insertError) return { data: null, error: insertError.message };
    revalidatePath(`/tournaments/${tournamentId}`);
    return {
      data: {
        count: rows.length,
        label: next.kind === "groups" ? "Group stage" : next.label,
      },
      error: null,
    };
  } catch (err) {
    console.error("createNextRound failed:", err);
    return { data: null, error: "Could not create the next round" };
  }
}
