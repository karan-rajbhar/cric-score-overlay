/**
 * Schema stage 3 transform (scripts/lib/stage3.mjs, used by the migration
 * and to build the seed) against what the app maintains on its own write
 * paths: search keys, rosters, membership snapshots, innings summaries and
 * the statistics documents.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  applyStage3,
  planStage3,
  planWrites,
} from "../../../scripts/lib/stage3.mjs";
import { MemoryDataSource, type Doc } from "./datasource";
import { refreshRoster } from "./denorm";
import { derivedFieldsDataSource } from "./derived-fields";
import { canonicalJson, searchFieldsOf } from "./derive.mjs";
import { refreshInningsSummary } from "./scorecard-refresh";
import { rebuildPlayerMatches } from "./scorecard-sync";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const NOW = "2024-06-01T00:00:00.000Z";

const STAGE3_FIELDS: Record<string, string[]> = {
  users: ["name_lower", "search_prefixes"],
  teams: ["name_lower", "search_prefixes", "roster"],
  clubs: ["name_lower", "search_prefixes"],
  tournaments: ["name_lower", "search_prefixes"],
  matches: ["title_lower", "search_prefixes", "innings_summary"],
  club_memberships: ["user_snapshot"],
};

/** The seed as it was before stage 3. */
function preStage3(): Record<string, Doc[]> {
  const out = structuredClone(seed);
  for (const [table, fields] of Object.entries(STAGE3_FIELDS)) {
    out[table] = out[table]!.map((d) => {
      const c = { ...d };
      for (const f of fields) delete c[f];
      return c;
    });
  }
  delete out.leaderboards;
  // Hand-written career rows under random ids, as the seed used to have.
  out.player_career_stats = [
    { id: "c565bf07-legacy", user_id: out.users![0]!.id, total_runs: 1240 },
  ];
  return out;
}

const dump = (docs: Doc[] | undefined) =>
  (docs ?? [])
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.last_updated;
      delete c.updated_at;
      return canonicalJson(c);
    })
    .sort();

describe("stage 3 transform", () => {
  it("the seed is already migrated (planning again is a no-op)", () => {
    expect(planWrites(planStage3(seed, { now: NOW }))).toBe(0);
  });

  it("migrates the pre-stage-3 seed to exactly the seed", () => {
    const before = preStage3();
    const plan = planStage3(before, { now: NOW });
    expect(plan.counts).toMatchObject({
      "users search keys": seed.users!.length,
      "team rosters": seed.teams!.length,
      "match innings summaries": seed.matches!.length,
      "membership snapshots": seed.club_memberships!.length,
      "career docs deleted": 1,
    });
    const after = applyStage3(before, plan);
    for (const table of Object.keys(seed)) {
      expect(dump(after[table]), table).toEqual(dump(seed[table]));
    }
    // Idempotent.
    expect(planWrites(planStage3(after, { now: NOW }))).toBe(0);
  });

  it("keys career documents by user id and drops orphans", () => {
    for (const c of seed.player_career_stats!) expect(c.id).toBe(c.user_id);
    const data = structuredClone(seed);
    data.player_matches = data.player_matches!.filter(
      (pm) => pm.match_id !== data.player_matches![0]!.match_id,
    );
    const plan = planStage3(data, { now: NOW });
    expect(plan.sets.length + plan.deletes.length).toBeGreaterThan(0);
    const after = applyStage3(data, plan);
    expect(planWrites(planStage3(after, { now: NOW }))).toBe(0);
  });
});

describe("the app writes what the transform writes", () => {
  it("search keys on insert and update", async () => {
    const memory = new MemoryDataSource({});
    const ds = derivedFieldsDataSource(memory);
    await ds.insert("users", [
      { id: "u1", full_name: "Élodie  O'Brien-Smith", username: "elodie_obs" },
    ]);
    const u = (await memory.getById("users", "u1"))!;
    expect(u.name_lower).toBe("elodie o brien smith");
    expect(u.search_prefixes).toEqual(
      searchFieldsOf("users", u)!.search_prefixes,
    );
    expect(u.search_prefixes).toEqual(
      expect.arrayContaining(["el", "elodie o", "bri", "smi", "elodie_obs"]),
    );
    await ds.update("users", "u1", { username: "eob" });
    const v = (await memory.getById("users", "u1"))!;
    expect(v.search_prefixes).toContain("eob");
    expect(v.search_prefixes).not.toContain("elodie_obs");
    expect(v.name_lower).toBe("elodie o brien smith");

    await ds.insert("matches", [{ id: "m1", title: "Lions vs Tigers" }]);
    const m = (await memory.getById("matches", "m1"))!;
    expect(m.title_lower).toBe("lions vs tigers");
    expect(m.search_prefixes).toEqual(
      expect.arrayContaining(["li", "tig", "lions vs t"]),
    );
  });

  it("rosters, summaries and player records match the seed", async () => {
    const memory = new MemoryDataSource(structuredClone(seed));
    for (const team of seed.teams!) await refreshRoster(memory, team.id);
    for (const match of seed.matches!) {
      await refreshInningsSummary(memory, match.id);
      expect(await rebuildPlayerMatches(memory, match.id)).toEqual({
        written: 0,
        deleted: 0,
      });
    }
    expect(memory.writes).toBe(0);
  });
});
