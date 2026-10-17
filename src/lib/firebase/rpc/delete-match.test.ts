/**
 * `delete_match`: who may delete, the typed-name check, what is removed,
 * retries, and that every derived aggregate afterwards equals one rebuilt
 * from scratch (career stats and leaderboard shards from the remaining
 * player records, those records from the remaining innings, and the
 * tournament points table from the remaining matches).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "../datasource";
import { canonicalJson } from "../derive.mjs";
import { LIVE_SCORECARD_COLLECTION } from "../live-scorecard";
import { DbQueryError } from "../query-builder";
import { rebuildPlayerMatches } from "../scorecard-sync";
import { builderContextFor } from "../server-client";
import { rebuildStats } from "../stats.mjs";
import type { Seed } from "../scoring/__fixtures__/golden";
import type { PlayerMatchesRow } from "../types";
import { canDeleteMatch } from "./auth-helpers";
import { deleteMatch } from "./delete-match";
import { recalculateTournamentStandings } from "./standings";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Seed;

const CLUB = "650e8400-e29b-41d4-a716-446655440001";
const TOURNAMENT = "850e8400-e29b-41d4-a716-446655440001";
const CLUB_ADMIN = "550e8400-e29b-41d4-a716-446655440003";
const CO_SCORER = "550e8400-e29b-41d4-a716-446655440015";
/** Completed tournament match with a co-scorer who is no club admin. */
const MATCH = "950e8400-e29b-41d4-a716-446655440002";

function setup() {
  const tables = structuredClone(seed);
  const match = tables.matches!.find((m) => m.id === MATCH)!;
  match.created_by = "creator";
  match.match_admins = ["creator", CO_SCORER];
  tables.tournaments!.find((t) => t.id === TOURNAMENT)!.created_by =
    "organiser";
  tables.invitations = [
    {
      id: "inv-1",
      email: "new@example.com",
      status: "pending",
      scorer_match_ids: [MATCH, "other-match"],
    },
  ];
  tables.live_state = [{ id: MATCH, version: 3 }];
  tables[LIVE_SCORECARD_COLLECTION] = [{ id: MATCH, version: 2 }];
  const memory = new MemoryDataSource(tables);
  const { ds } = builderContextFor(memory, null);
  const run = (uid: string | null, matchId = MATCH, typed?: string) =>
    deleteMatch(
      { ds, db: null, uid },
      matchId,
      typed ??
        String(
          memory.all("matches").find((m) => m.id === matchId)?.title ?? "",
        ),
    );
  return { memory, ds, run, title: String(match.title) };
}

function owned(memory: MemoryDataSource, matchId: string) {
  return {
    match: memory.all("matches").filter((m) => m.id === matchId).length,
    innings: memory.all("innings").filter((d) => d.match_id === matchId)
      .length,
    overs: memory.all("overs").filter((d) => d.match_id === matchId).length,
    player_matches: memory
      .all("player_matches")
      .filter((d) => d.match_id === matchId).length,
    live_state: memory.all("live_state").filter((d) => d.id === matchId)
      .length,
    live_scorecard: memory
      .all(LIVE_SCORECARD_COLLECTION)
      .filter((d) => d.id === matchId).length,
  };
}

function dump(docs: object[]): string[] {
  return docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.last_updated;
      delete c.updated_at;
      return canonicalJson(c);
    })
    .sort();
}

async function standingsOf(memory: MemoryDataSource, tournamentId: string) {
  return dump(
    memory
      .all("tournament_standings")
      .filter((s) => s.tournament_id === tournamentId)
      .map((s) => {
        const c: Record<string, unknown> = { ...s };
        delete c.id;
        // Set by organisers and carried over, not computed.
        delete c.qualification_status;
        return c;
      }),
  );
}

/** Every aggregate equals a rebuild from what is left. */
async function expectConsistent(memory: MemoryDataSource) {
  const { ds } = builderContextFor(memory, null);
  // Career stats and leaderboard shards from the stored player records.
  const rebuilt = rebuildStats(
    memory.all("player_matches") as unknown as PlayerMatchesRow[],
    new Map(memory.all("users").map((u) => [u.id, u])),
    "x",
  );
  expect(dump(memory.all("player_career_stats"))).toEqual(
    dump(rebuilt.careers),
  );
  expect(dump(memory.all("leaderboards"))).toEqual(dump(rebuilt.leaderboards));
  // Player records from the remaining innings.
  for (const m of memory.all("matches")) {
    expect(await rebuildPlayerMatches(ds, m.id)).toEqual({
      written: 0,
      deleted: 0,
    });
  }
  // No record points at a match that is gone.
  const ids = new Set(memory.all("matches").map((m) => m.id));
  expect(
    memory.all("player_matches").every((p) => ids.has(String(p.match_id))),
  ).toBe(true);
  // Points tables equal ones rebuilt from scratch.
  for (const t of memory.all("tournaments")) {
    const incremental = await standingsOf(memory, t.id);
    for (const s of memory.all("tournament_standings")) {
      if (s.tournament_id === t.id) {
        await memory.delete("tournament_standings", s.id);
      }
    }
    await recalculateTournamentStandings(ds, t.id);
    expect(await standingsOf(memory, t.id)).toEqual(incremental);
  }
}

async function normalizeStandings(memory: MemoryDataSource) {
  const { ds } = builderContextFor(memory, null);
  for (const t of memory.all("tournaments")) {
    await recalculateTournamentStandings(ds, t.id);
  }
}

describe("delete_match permissions", () => {
  const cases: [string, string | null, boolean][] = [
    ["the match creator", "creator", true],
    ["a club admin of the match's club", CLUB_ADMIN, true],
    ["the tournament creator", "organiser", true],
    ["a co-scorer listed in match_admins", CO_SCORER, false],
    ["a signed-in stranger", "stranger", false],
    ["a signed-out request", null, false],
  ];
  for (const [who, uid, allowed] of cases) {
    it(`${allowed ? "lets" : "refuses"} ${who}`, async () => {
      const { memory, run } = setup();
      const before = owned(memory, MATCH);
      if (allowed) {
        await expect(run(uid)).resolves.toMatchObject({
          already_deleted: false,
        });
        expect(owned(memory, MATCH).match).toBe(0);
      } else {
        await expect(run(uid)).rejects.toThrow("not_authorized");
        expect(owned(memory, MATCH)).toEqual(before);
      }
    });
  }

  it("canDeleteMatch agrees with the server check (club owner too)", async () => {
    const { ds } = setup();
    const owner = seed.clubs!.find((c) => c.id === CLUB)!.owner_id as string;
    expect(await canDeleteMatch(ds, MATCH, owner)).toBe(true);
    expect(await canDeleteMatch(ds, MATCH, CO_SCORER)).toBe(false);
    expect(await canDeleteMatch(ds, MATCH, null)).toBe(false);
    expect(await canDeleteMatch(ds, "missing", "creator")).toBe(false);
  });
});

describe("delete_match confirmation", () => {
  it("rejects a typed name that is not the match title, writing nothing", async () => {
    const { memory, run } = setup();
    const before = owned(memory, MATCH);
    const err = await run("creator", MATCH, "Strikers vs Warriors").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DbQueryError);
    expect((err as Error).message).toBe("confirm_title_mismatch");
    expect(owned(memory, MATCH)).toEqual(before);
  });

  it("accepts the title in any case with surrounding spaces", async () => {
    const { memory, run, title } = setup();
    await run("creator", MATCH, `  ${title.toUpperCase()} `);
    expect(owned(memory, MATCH).match).toBe(0);
  });
});

describe("delete_match cascade", () => {
  it("removes every document the match owns and leaves the rest", async () => {
    const { memory, run } = setup();
    const before = owned(memory, MATCH);
    expect(before.innings).toBeGreaterThan(0);
    expect(before.overs).toBeGreaterThan(0);
    expect(before.player_matches).toBeGreaterThan(0);
    const others = memory.all("matches").length - 1;
    const otherOvers = memory.all("overs").length - before.overs;

    const result = await run("creator");
    expect(result.removed).toEqual({
      innings: before.innings,
      overs: before.overs,
      player_matches: before.player_matches,
      invitations_updated: 1,
    });
    expect(result.tournament_id).toBe(TOURNAMENT);
    expect(owned(memory, MATCH)).toEqual({
      match: 0,
      innings: 0,
      overs: 0,
      player_matches: 0,
      live_state: 0,
      live_scorecard: 0,
    });
    expect(memory.all("matches")).toHaveLength(others);
    expect(memory.all("overs")).toHaveLength(otherOvers);
    // The invite stays; only the match id leaves it.
    expect(
      (await memory.getById("invitations", "inv-1"))!.scorer_match_ids,
    ).toEqual(["other-match"]);
  });

  it("is safe to run again, and finishes a delete that was cut short", async () => {
    const { memory, run, title } = setup();
    // A run cut short after removing the ball log and innings: the match
    // document (deleted last) is still there, so a retry redoes the rest.
    for (const t of ["overs", "innings"]) {
      for (const d of memory.all(t).filter((d) => d.match_id === MATCH)) {
        await memory.delete(t, d.id);
      }
    }
    await run("creator", MATCH, title);
    expect(Object.values(owned(memory, MATCH)).every((n) => n === 0)).toBe(
      true,
    );
    // Once gone, a repeat is a no-op that reports it.
    const again = await run("creator", MATCH, title);
    expect(again.already_deleted).toBe(true);
    expect(again.removed).toEqual({
      innings: 0,
      overs: 0,
      player_matches: 0,
      invitations_updated: 0,
    });
  });
});

describe("delete_match keeps aggregates exactly consistent", () => {
  const statuses = ["completed", "live", "scheduled"] as const;
  for (const status of statuses) {
    it(`after deleting a ${status} match, everything equals a rebuild`, async () => {
      const { memory, run } = setup();
      await normalizeStandings(memory);
      await expectConsistent(memory);
      const match = memory
        .all("matches")
        .find((m) => m.status === status && m.tournament_id)!;
      await run(String(match.created_by), match.id);
      expect(owned(memory, match.id).match).toBe(0);
      await expectConsistent(memory);
    });
  }

  it("deleting every match leaves no statistics behind", async () => {
    const { memory, run } = setup();
    for (const m of memory.all("matches") as Doc[]) {
      await run(String(m.created_by), m.id);
    }
    expect(memory.all("player_matches")).toHaveLength(0);
    expect(memory.all("player_career_stats")).toHaveLength(0);
    expect(memory.all("leaderboards")).toHaveLength(0);
    await expectConsistent(memory);
  });
});
