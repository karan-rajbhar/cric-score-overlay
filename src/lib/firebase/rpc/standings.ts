/**
 * Tournament points table, ported from `recalculate_tournament_standings`
 * (ICC net-run-rate rules, abandoned matches count as no-results).
 *
 * Reads the tournament's registrations, matches and standings (innings
 * totals come from each match's `innings_summary`; only matches without one
 * read their innings, in batches) and writes only the rows that changed.
 */

import { chunk, IN_CHUNK_SIZE, type DataSource } from "../datasource";
import { newId } from "../query-builder";
import { sameRow } from "../scoring/rows";
import type {
  InningsSummaryEntry,
  MatchesRow,
  TournamentStandingsRow,
} from "../types";

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export async function recalculateTournamentStandings(
  ds: DataSource,
  tournamentId: string,
  options: {
    /**
     * Compute the table as if this match were gone (a match being deleted:
     * the table is fixed before its document goes, so a retry redoes it).
     */
    excludeMatchId?: string;
  } = {},
): Promise<void> {
  const [registrations, allMatchDocs, standingsDocs] = await Promise.all([
    ds.query("tournament_registrations", [
      { field: "tournament_id", op: "==", value: tournamentId },
    ]),
    ds.query("matches", [
      { field: "tournament_id", op: "==", value: tournamentId },
    ]) as Promise<unknown> as Promise<MatchesRow[]>,
    ds.query("tournament_standings", [
      { field: "tournament_id", op: "==", value: tournamentId },
    ]) as Promise<unknown> as Promise<TournamentStandingsRow[]>,
  ]);

  const excluded = options.excludeMatchId
    ? (allMatchDocs.find((m) => m.id === options.excludeMatchId) ?? null)
    : null;
  const matchDocs = excluded
    ? allMatchDocs.filter((m) => m.id !== excluded.id)
    : allMatchDocs;

  const teamIds = new Set<string>();
  for (const r of registrations)
    if (typeof r.team_id === "string") teamIds.add(r.team_id);
  for (const m of matchDocs) {
    if (m.team1_id) teamIds.add(m.team1_id);
    if (m.team2_id) teamIds.add(m.team2_id);
  }
  // A team that was in the table only through the excluded match (not
  // registered, no other match) leaves it, unless it carries a manual
  // adjustment, so the table equals one built without that match.
  if (excluded) {
    for (const teamId of [excluded.team1_id, excluded.team2_id]) {
      if (!teamId || teamIds.has(teamId)) continue;
      const row = standingsDocs.find((s) => s.team_id === teamId);
      if (!row) continue;
      if (row.points_adjustment || row.adjustment_reason) teamIds.add(teamId);
      else await ds.delete("tournament_standings", row.id);
    }
  }
  if (teamIds.size === 0) return;

  const completed = matchDocs.filter((m) => m.status === "completed");
  const inningsByMatch = new Map<string, InningsSummaryEntry[]>();
  const unsummarized: string[] = [];
  for (const m of completed) {
    if (Array.isArray(m.innings_summary)) {
      inningsByMatch.set(m.id, m.innings_summary);
    } else {
      unsummarized.push(m.id);
    }
  }
  for (const ids of chunk(unsummarized, IN_CHUNK_SIZE)) {
    const docs = (await ds.query("innings", [
      { field: "match_id", op: "in", value: ids },
    ])) as unknown as (InningsSummaryEntry & { match_id: string | null })[];
    for (const inn of docs) {
      if (!inn.match_id) continue;
      const list = inningsByMatch.get(inn.match_id) ?? [];
      list.push(inn);
      inningsByMatch.set(inn.match_id, list);
    }
  }

  const now = new Date().toISOString();

  for (const teamId of teamIds) {
    const existing = standingsDocs.find((s) => s.team_id === teamId) ?? null;
    const adjustment = existing?.points_adjustment ?? 0;

    const played = matchDocs.filter(
      (m) =>
        (m.status === "completed" || m.status === "abandoned") &&
        (m.team1_id === teamId || m.team2_id === teamId),
    );
    const wins = played.filter((m) => m.winning_team_id === teamId).length;
    const losses = played.filter(
      (m) =>
        m.winning_team_id &&
        m.winning_team_id !== teamId &&
        m.result_type === "win",
    ).length;
    const ties = played.filter((m) => m.result_type === "tie").length;
    const noResults = played.filter(
      (m) => m.result_type === "no_result" || m.result_type === "abandoned",
    ).length;

    const basePoints = wins * 2 + ties + noResults;
    const finalPoints = basePoints + adjustment;

    let runsScored = 0;
    let runsConceded = 0;
    let oversFaced = 0;
    let oversBowled = 0;

    for (const m of matchDocs) {
      if (m.status !== "completed") continue;
      if (m.team1_id !== teamId && m.team2_id !== teamId) continue;
      const bpo = m.balls_per_over ?? 6;
      const wicketsCap = m.wickets_per_innings ?? 10;
      const oversQuota = m.overs_per_innings ?? 20;
      for (const inn of inningsByMatch.get(m.id) ?? []) {
        const balls = inn.total_balls ?? 0;
        const overs =
          (inn.total_wickets ?? 0) >= wicketsCap
            ? oversQuota
            : Math.floor(balls / bpo) + (balls % bpo) / bpo;
        if (inn.team_id === teamId) {
          runsScored += inn.total_runs ?? 0;
          oversFaced += overs;
        } else {
          runsConceded += inn.total_runs ?? 0;
          oversBowled += overs;
        }
      }
    }

    const nrr =
      oversFaced > 0 && oversBowled > 0
        ? round(runsScored / oversFaced - runsConceded / oversBowled, 2)
        : 0;

    const row: Omit<TournamentStandingsRow, "id"> = {
      tournament_id: tournamentId,
      team_id: teamId,
      matches_played: played.length,
      wins,
      losses,
      ties,
      no_results: noResults,
      points: finalPoints,
      points_adjustment: adjustment,
      adjustment_reason: existing?.adjustment_reason ?? null,
      qualification_status: existing?.qualification_status ?? "in_contention",
      runs_scored: runsScored,
      runs_conceded: runsConceded,
      overs_faced: round(oversFaced, 1),
      overs_bowled: round(oversBowled, 1),
      net_run_rate: nrr,
      updated_at: now,
    };

    if (existing) {
      // Unchanged rows are not rewritten (most writes only move a few teams).
      if (!sameRow({ ...existing, ...row }, existing)) {
        await ds.update("tournament_standings", existing.id, row);
      }
    } else {
      await ds.insert("tournament_standings", [{ id: newId(), ...row }]);
    }
  }
}

/**
 * Mirrors the `trg_matches_recalc_standings` trigger: recompute the table
 * whenever a tournament match reaches (or leaves) a terminal state.
 */
export async function maybeRecalculateStandings(
  ds: DataSource,
  before: Partial<MatchesRow> | null,
  after: Partial<MatchesRow> | null,
): Promise<void> {
  const tournamentId = after?.tournament_id ?? before?.tournament_id ?? null;
  if (!tournamentId) return;
  const terminal = (s: string | null | undefined) =>
    s === "completed" || s === "abandoned";
  if (!(terminal(after?.status) || terminal(before?.status) || !after)) return;
  // Edits that leave every input of the table alone (player of the match,
  // scorers, venue, ...) do not recompute it.
  if (
    before &&
    after &&
    STANDINGS_INPUTS.every(
      (f) =>
        JSON.stringify(before[f] ?? null) === JSON.stringify(after[f] ?? null),
    )
  ) {
    return;
  }
  await recalculateTournamentStandings(ds, tournamentId);
}

/** Match fields the points table depends on. */
const STANDINGS_INPUTS = [
  "status",
  "result_type",
  "winning_team_id",
  "team1_id",
  "team2_id",
  "tournament_id",
  "balls_per_over",
  "wickets_per_innings",
  "overs_per_innings",
  "innings_summary",
] as const;
