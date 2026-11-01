import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import { canonicalJson } from "../derive.mjs";
import { OVERS_COLLECTION, type PlayerMatchesRow } from "../scorecard";
import { rebuildStats } from "../stats.mjs";
import type { Doc } from "../datasource";
import type { BattingPerformancesRow, InningsRow } from "../types";
import {
  MERGE_BATCH,
  mergePlayer,
  playerLeftover,
  previewPlayerMerge,
  removeLeftoverPlayer,
} from "./merge-player";

const { TA } = SYNTHETIC_ROSTERS;
const ADMIN = "team-admin";
const KEEPER = "keeper";

/** One over a side; `finish`: the second innings is played too. */
async function played(finish: boolean) {
  const side = stage2Driver(syntheticTables({ overs_per_innings: 1 }), true);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  for (const ball of [
    { runs: 4 },
    { runs: 0, wicket: "caught", fielder: "b5" },
    { runs: 1 },
    { runs: 2 },
    { runs: 0 },
    { runs: 1 },
  ]) {
    await replay.step({ kind: "ball", ball });
  }
  if (finish) {
    for (const runs of [1, 0, 2, 0, 1, 0]) {
      await replay.step({ kind: "ball", ball: { runs } });
    }
  }
  const { ds } = side;
  const innings = () =>
    (ds.all("innings") as unknown as InningsRow[]).sort(
      (a, b) => a.innings_number - b.innings_number,
    );
  const dup = (innings()[0]!.batting as BattingPerformancesRow[]).find(
    (b) => b.is_out,
  )!;
  const teamId = innings()[0]!.team_id;
  await ds.update("teams", teamId, { created_by: ADMIN });
  await ds.update("users", dup.user_id, { is_placeholder: true });
  await ds.insert("users_private", [
    { id: dup.user_id, email: "player.x.1@players.local" },
  ]);
  await ds.insert("users", [{ id: KEEPER, full_name: "The Real Player" }]);
  const ctx = { ...side.ctx, uid: ADMIN };
  const args = { teamId, from: dup.user_id, to: KEEPER };
  const mentioned = (id: string) =>
    JSON.stringify([ds.all("innings"), ds.all(OVERS_COLLECTION)]).includes(
      JSON.stringify(id),
    );
  return { side, ds, ctx, args, dup, innings, mentioned };
}

const strip = (docs: Doc[]) =>
  docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.updated_at;
      delete c.last_updated;
      return canonicalJson(c);
    })
    .sort();

describe("merge_player", () => {
  it("says what it would do before anything is written", async () => {
    const { ds, ctx, args } = await played(true);
    const before = JSON.stringify(ds.all("innings"));
    await expect(previewPlayerMerge(ds, ADMIN, args)).resolves.toEqual({
      matches: 1,
      together: 0,
    });
    expect(JSON.stringify(ds.all("innings"))).toBe(before);
    expect(ctx.uid).toBe(ADMIN);
  });

  it("moves everything to the keeper, removes the duplicate, and the figures add up", async () => {
    const { ds, ctx, args, dup, innings, mentioned } = await played(true);
    const totals = innings().map((i) => [i.total_runs, i.total_wickets]);

    await expect(mergePlayer(ctx, args)).resolves.toEqual({
      moved: 1,
      remaining: 0,
      done: true,
    });

    expect(mentioned(dup.user_id)).toBe(false);
    expect(
      (innings()[0]!.batting as BattingPerformancesRow[]).find(
        (b) => b.user_id === KEEPER,
      ),
    ).toMatchObject({
      runs_scored: dup.runs_scored,
      balls_faced: dup.balls_faced,
      is_out: true,
    });
    expect(innings().map((i) => [i.total_runs, i.total_wickets])).toEqual(
      totals,
    );

    // The profile is gone, and so is every document of its own.
    expect(await ds.getById("users", dup.user_id)).toBeNull();
    expect(await ds.getById("users_private", dup.user_id)).toBeNull();
    expect(await ds.getById("player_career_stats", dup.user_id)).toBeNull();

    // The stored statistics are exactly what the records add up to.
    const records = ds.all("player_matches");
    expect(records.some((r) => r.user_id === dup.user_id)).toBe(false);
    const rebuilt = rebuildStats(
      records as unknown as PlayerMatchesRow[],
      new Map(ds.all("users").map((u) => [u.id, u])),
      "x",
    );
    expect(strip(ds.all("player_career_stats"))).toEqual(
      strip(rebuilt.careers as Doc[]),
    );
  });

  it("gives the keeper the squad place", async () => {
    const { ds, ctx, args, dup } = await played(true);
    await mergePlayer(ctx, args);
    const rows = ds.all("team_players");
    expect(rows.some((r) => r.user_id === dup.user_id)).toBe(false);
    expect(
      rows.filter((r) => r.team_id === args.teamId && r.user_id === KEEPER),
    ).toHaveLength(1);
  });

  it("keeps one squad row when both are in the team", async () => {
    const { ds, ctx, args } = await played(true);
    await ds.insert("team_players", [
      { id: "tp-keeper", team_id: args.teamId, user_id: KEEPER },
    ]);
    await mergePlayer(ctx, args);
    expect(
      ds
        .all("team_players")
        .filter((r) => r.team_id === args.teamId && r.user_id === KEEPER),
    ).toHaveLength(1);
  });

  it("reaches an innings still in play, which has no records yet", async () => {
    const { ds, ctx, args, dup, mentioned } = await played(false);
    expect((await ds.getById("matches", "M"))?.status).toBe("live");
    await mergePlayer(ctx, args);
    expect(mentioned(dup.user_id)).toBe(false);
    expect(mentioned(KEEPER)).toBe(true);
    expect(await ds.getById("users", dup.user_id)).toBeNull();
  });

  it("works in batches, and keeps the profile until the last one", async () => {
    const { ds, ctx, args, dup } = await played(true);
    const extra = MERGE_BATCH + 2;
    for (let i = 0; i < extra; i += 1) {
      await ds.insert("matches", [{ id: `other-${i}`, status: "completed" }]);
      await ds.insert("player_matches", [
        { id: `other-${i}_${dup.user_id}`, match_id: `other-${i}`, user_id: dup.user_id },
      ]);
    }
    const first = await mergePlayer(ctx, args);
    expect(first).toMatchObject({ moved: MERGE_BATCH, done: false });
    expect(first.remaining).toBeGreaterThan(0);
    expect(await ds.getById("users", dup.user_id)).not.toBeNull();
  });

  describe("refuses, and changes nothing", () => {
    const untouched = async (
      setUp: (p: Awaited<ReturnType<typeof played>>) => Promise<void>,
      message: string,
    ) => {
      const p = await played(true);
      await setUp(p);
      const before = JSON.stringify(p.ds.all("innings"));
      await expect(mergePlayer(p.ctx, p.args)).rejects.toThrow(message);
      expect(JSON.stringify(p.ds.all("innings"))).toBe(before);
      expect(await p.ds.getById("users", p.args.from)).not.toBeNull();
    };

    it("a player with an account", () =>
      untouched(
        (p) => p.ds.update("users", p.args.from, { is_placeholder: false }),
        "player_has_account",
      ));

    it("a player invited to claim the profile", () =>
      untouched(
        (p) =>
          p.ds.update("users_private", p.args.from, {
            email: "friend@gmail.com",
          }),
        "player_has_account",
      ));

    it("two players who played in the same match", () =>
      untouched(async (p) => {
        await p.ds.insert("player_matches", [
          { id: `M_${KEEPER}`, match_id: "M", user_id: KEEPER },
        ]);
      }, "players_played_together"));

    it("a player who is not in that squad", () =>
      untouched(async (p) => {
        for (const r of p.ds.all("team_players")) {
          if (r.user_id === p.args.from) await p.ds.delete("team_players", r.id);
        }
      }, "player_not_in_team"));

    it("a keeper who does not exist", async () => {
      const { ctx, args } = await played(true);
      await expect(
        mergePlayer(ctx, { ...args, to: "nobody" }),
      ).rejects.toThrow("player_not_found");
    });

    it("someone who does not run the team", async () => {
      const { ctx, args } = await played(true);
      await expect(
        mergePlayer({ ...ctx, uid: "stranger" }, args),
      ).rejects.toThrow("not_authorized");
    });

    it("a player merged into themselves", async () => {
      const { ctx, args } = await played(true);
      await expect(
        mergePlayer(ctx, { ...args, to: args.from }),
      ).rejects.toThrow("invalid_input");
    });
  });
});

describe("after a replacement", () => {
  /** A squad placeholder with no part in the match. */
  const spare = async (finish = true) => {
    const p = await played(finish);
    const id = TA.find((u) => !p.mentioned(u))!;
    await p.ds.update("users", id, { is_placeholder: true });
    return { ...p, id };
  };

  it("knows a placeholder with no matches can simply go", async () => {
    const { ds, id } = await spare();
    await expect(playerLeftover(ds, id)).resolves.toEqual({
      placeholder: true,
      otherMatches: 0,
    });
  });

  it("knows a real account stays", async () => {
    const { ds, id } = await spare();
    await ds.update("users", id, { is_placeholder: false });
    expect((await playerLeftover(ds, id)).placeholder).toBe(false);
  });

  it("removes them from the squad, and the profile once nothing names it", async () => {
    const { ds, args, id } = await spare();
    await expect(
      removeLeftoverPlayer(ds, ADMIN, {
        matchId: "M",
        teamId: args.teamId,
        userId: id,
      }),
    ).resolves.toEqual({ profile_removed: true });
    expect(ds.all("team_players").some((r) => r.user_id === id)).toBe(false);
    expect(await ds.getById("users", id)).toBeNull();
  });

  it("keeps the profile while another team has them", async () => {
    const { ds, args, id } = await spare();
    await ds.insert("team_players", [
      { id: "elsewhere", team_id: "other-team", user_id: id },
    ]);
    await expect(
      removeLeftoverPlayer(ds, ADMIN, {
        matchId: "M",
        teamId: args.teamId,
        userId: id,
      }),
    ).resolves.toEqual({ profile_removed: false });
    expect(await ds.getById("users", id)).not.toBeNull();
  });

  it("keeps the profile while anything else names them", async () => {
    const { ds, args, id } = await spare();
    await ds.update("teams", args.teamId, { captain_id: id });
    await expect(
      removeLeftoverPlayer(ds, ADMIN, {
        matchId: "M",
        teamId: args.teamId,
        userId: id,
      }),
    ).resolves.toEqual({ profile_removed: false });
  });

  it("refuses a player with matches, or a part in this match", async () => {
    const { ds, args, id, dup } = await spare();
    await ds.insert("player_matches", [
      { id: `old_${id}`, match_id: "old", user_id: id },
    ]);
    const remove = (userId: string) =>
      removeLeftoverPlayer(ds, ADMIN, {
        matchId: "M",
        teamId: args.teamId,
        userId,
      });
    await expect(remove(id)).rejects.toThrow("player_has_records");
    await expect(remove(dup.user_id)).rejects.toThrow("player_has_records");
  });

  it("refuses a part in an innings still in play, which has no record yet", async () => {
    const { ds, args, dup } = await played(false);
    await expect(
      removeLeftoverPlayer(ds, ADMIN, {
        matchId: "M",
        teamId: args.teamId,
        userId: dup.user_id,
      }),
    ).rejects.toThrow(/player_in_match|player_has_records/);
  });

  it("is for the people who may add players", async () => {
    const { ds, args, id } = await spare();
    await expect(
      removeLeftoverPlayer(ds, "stranger", {
        matchId: "M",
        teamId: args.teamId,
        userId: id,
      }),
    ).rejects.toThrow("not_authorized");
  });
});
