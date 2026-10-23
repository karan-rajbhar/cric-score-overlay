/**
 * The stored values the paginated pages read instead of whole collections:
 * `clubs.team_count` (teams write hook + backfill) and the innings-summary
 * totals on matches (written with each summary + backfill), and the club
 * milestones built from them, checked against adding up every match.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  planClubTeamCounts,
  planMatchSummaryTotals,
} from "../../../scripts/lib/pagination-backfills.mjs";
import {
  clubMilestoneAggregates,
  clubMilestonesFromList,
  clubMilestonesOf,
  type MilestoneMatch,
} from "./club-milestones";
import { MemoryDataSource, type Doc } from "./datasource";
import { summaryTotalsOf } from "./derive.mjs";
import { serverClientFor } from "./server-client";
import { attachMatchTeams } from "./team-snapshot";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

describe("summaryTotalsOf", () => {
  it("adds up the innings and keeps the first of equal best innings", () => {
    expect(
      summaryTotalsOf([
        { team_id: "a", total_runs: 150, total_wickets: 6, total_overs: 20 },
        { team_id: "b", total_runs: 150, total_wickets: 9, total_overs: 19.4 },
      ]),
    ).toEqual({
      summary_runs: 300,
      summary_wickets: 15,
      best_innings: { runs: 150, wickets: 6, overs: 20, team_id: "a" },
      best_innings_runs: 150,
    });
    expect(summaryTotalsOf([])).toEqual({
      summary_runs: 0,
      summary_wickets: 0,
      best_innings: null,
      best_innings_runs: null,
    });
  });
});

describe("backfill plans", () => {
  it("find nothing to do on the seed, which carries the values", () => {
    expect(
      planClubTeamCounts({ clubs: seed.clubs!, teams: seed.teams! }),
    ).toEqual({ updates: [] });
    expect(planMatchSummaryTotals(seed.matches!)).toEqual({ updates: [] });
  });

  it("fill missing or stale values once", () => {
    const clubs = seed.clubs!.map(({ team_count: _c, ...c }) => {
      void _c;
      return c as Doc;
    });
    const counts = planClubTeamCounts({ clubs, teams: seed.teams! });
    expect(counts.updates).toHaveLength(clubs.length);
    const applied = clubs.map((c) => ({
      ...c,
      team_count: counts.updates.find((u) => u.id === c.id)!.team_count,
    }));
    expect(planClubTeamCounts({ clubs: applied, teams: seed.teams! })).toEqual({
      updates: [],
    });

    const matches = seed.matches!.map(
      ({ summary_runs: _r, best_innings: _b, ...m }) => {
        void _r;
        void _b;
        return m as Doc;
      },
    );
    const totals = planMatchSummaryTotals(matches);
    expect(totals.updates).toHaveLength(matches.length);
    const patched = matches.map((m) => ({
      ...m,
      ...totals.updates.find((u) => u.id === m.id)!.patch,
    }));
    expect(planMatchSummaryTotals(patched)).toEqual({ updates: [] });
  });
});

describe("clubs.team_count", () => {
  it("follows teams created, moved and deleted through the builder", async () => {
    const ds = new MemoryDataSource(structuredClone(seed));
    const db = serverClientFor({ ds, db: null, getUser: async () => null });
    const [club1, club2] = seed.clubs!;
    const count = async (id: string) =>
      (await ds.getById("clubs", id))!.team_count;
    const before = await count(club1!.id);

    const { data: team } = await db
      .from("teams")
      .insert({ name: "Hook XI", club_id: club1!.id, created_by: "u" })
      .select("id")
      .single();
    expect(await count(club1!.id)).toBe(Number(before) + 1);

    await db.from("teams").update({ club_id: club2!.id }).eq("id", team!.id);
    expect(await count(club1!.id)).toBe(before);
    const moved = seed.teams!.filter((t) => t.club_id === club2!.id).length;
    expect(await count(club2!.id)).toBe(moved + 1);

    await db.from("teams").delete().eq("id", team!.id);
    expect(await count(club2!.id)).toBe(moved);
  });
});

describe("club milestones from aggregates", () => {
  it("equal adding up every match of the club", async () => {
    const ds = new MemoryDataSource(structuredClone(seed));
    const db = serverClientFor({ ds, db: null, getUser: async () => null });
    for (const club of seed.clubs!) {
      const { data } = await db
        .from("matches")
        .select(
          "id, status, scheduled_at, team1_id, team2_id, team1_snapshot, team2_snapshot, innings(id, team_id, innings_number, total_runs, total_wickets, total_overs, is_completed)",
        )
        .eq("club_id", club.id)
        .order("scheduled_at", { ascending: false });
      const list = (await attachMatchTeams(
        db,
        data ?? [],
      )) as unknown as MilestoneMatch[];
      const agg = await clubMilestoneAggregates(ds, club.id, 0);
      const fromAggregates = clubMilestonesOf(
        { ...agg, top: await attachMatchTeams(db, agg.top) },
        [],
      );
      expect(fromAggregates).toEqual(
        clubMilestonesFromList(
          list as Parameters<typeof clubMilestonesFromList>[0],
        ),
      );
    }
  });
});
