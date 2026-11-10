/**
 * Tournament points table, ported from `recalculate_tournament_standings`
 * (ICC net-run-rate rules, abandoned matches count as no-results).
 *
 * Reads the tournament's registrations, matches and standings (innings
 * totals come from each match's `innings_summary`; only matches without one
 * read their innings, in batches) and writes only the rows that changed.
 */

import { nrrFigures } from "~/lib/tournament-standings";
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

/** Registration statuses whose team is not (yet) in the points table. */
const NOT_IN_TABLE = new Set(["pending", "rejected", "withdrawn"]);

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

  const matchDocs = allMatchDocs.filter(
    (m) => m.id !== options.excludeMatchId,
  );

  const teamIds = new Set<string>();
  // Requests still waiting for the organisers (or turned down) stay out.
  for (const r of registrations)
    if (typeof r.team_id === "string" && !NOT_IN_TABLE.has(String(r.status)))
      teamIds.add(r.team_id);
  for (const m of matchDocs) {
    if (m.team1_id) teamIds.add(m.team1_id);
    if (m.team2_id) teamIds.add(m.team2_id);
  }
  // A team no longer in the table (rejected or withdrawn with no match
  // played, or in it only through the excluded match) leaves it, unless it
  // carries a manual adjustment, so the table equals one built afresh.
  for (const row of standingsDocs) {
    if (!row.team_id || teamIds.has(row.team_id)) continue;
    if (row.points_adjustment || row.adjustment_reason) teamIds.add(row.team_id);
    else await ds.delete("tournament_standings", row.id);
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
      for (const f of nrrFigures(m, inningsByMatch.get(m.id) ?? [])) {
        if (f.teamId === teamId) {
          runsScored += f.runs;
          oversFaced += f.overs;
        } else {
          runsConceded += f.runs;
          oversBowled += f.overs;
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
  if (!tournamentId || leavesTournament(before, after)) return;
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

/**
 * Whether the write takes the match out of its tournament. That happens
 * only when the tournament is deleted (the cascade unlinks its matches):
 * its table goes with it, so recomputing it would only write rows back for
 * a tournament that is gone.
 */
function leavesTournament(
  before: Partial<MatchesRow> | null,
  after: Partial<MatchesRow> | null,
): boolean {
  return !!before?.tournament_id && after?.tournament_id === null;
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
  "dls_revision",
  "innings_summary",
] as const;
