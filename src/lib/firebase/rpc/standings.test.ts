import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "../datasource";
import {
  maybeRecalculateStandings,
  recalculateTournamentStandings,
} from "./standings";
import type { MatchesRow } from "../types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const stripTimes = (docs: Doc[]) =>
  docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.updated_at;
      delete c.id;
      return JSON.stringify(c, Object.keys(c).sort());
    })
    .sort();

describe("tournament standings", () => {
  const tournamentId = String(
    seed.matches!.find((m) => m.status === "completed" && m.tournament_id)!
      .tournament_id,
  );

  it("uses match summaries (no innings reads) and agrees with the innings", async () => {
    const withSummary = new MemoryDataSource(seed);
    const withoutSummary = new MemoryDataSource({
      ...seed,
      matches: seed.matches!.map((m) => {
        const c = { ...m };
        delete c.innings_summary;
        return c;
      }),
      tournament_standings: [],
    });
    await withoutSummary.insert("tournament_standings", []);
    const fresh = new MemoryDataSource({ ...seed, tournament_standings: [] });

    const before = fresh.billedReads;
    await recalculateTournamentStandings(fresh, tournamentId);
    const summaryReads = fresh.billedReads - before;
    await recalculateTournamentStandings(withoutSummary, tournamentId);
    expect(stripTimes(fresh.all("tournament_standings"))).toEqual(
      stripTimes(withoutSummary.all("tournament_standings")),
    );
    const registrations = seed.tournament_registrations!.filter(
      (r) => r.tournament_id === tournamentId,
    ).length;
    const matches = seed.matches!.filter(
      (m) => m.tournament_id === tournamentId,
    ).length;
    // registrations + matches + (empty) standings query, nothing else
    expect(summaryReads).toBe(registrations + matches + 1);

    // Recomputing an unchanged table writes nothing.
    await recalculateTournamentStandings(withSummary, tournamentId);
    const writes = withSummary.writes;
    await recalculateTournamentStandings(withSummary, tournamentId);
    expect(withSummary.writes).toBe(writes);
  });

  it("skips edits that change none of its inputs", async () => {
    const ds = new MemoryDataSource(seed);
    const match = seed.matches!.find(
      (m) => m.status === "completed" && m.tournament_id,
    ) as unknown as MatchesRow;
    const before = ds.billedReads;
    await maybeRecalculateStandings(ds, match, {
      ...match,
      player_of_the_match_id: "someone",
    });
    expect(ds.billedReads).toBe(before);
    await maybeRecalculateStandings(ds, match, {
      ...match,
      winning_team_id: match.team2_id,
    });
    expect(ds.billedReads).toBeGreaterThan(before);
  });
});
