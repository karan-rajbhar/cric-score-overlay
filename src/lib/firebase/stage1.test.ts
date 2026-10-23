import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  applyStage1,
  planStage1,
  planWrites,
} from "../../../scripts/lib/stage1.mjs";
import { MemoryDataSource, type Doc } from "./datasource";
import { QueryBuilder } from "./query-builder";
import { canSignIn, inviteEmail } from "./rpc/access";
import {
  attachMatchTeams,
  matchTeamSnapshots,
  syncTeamSnapshots,
} from "./team-snapshot";
import { buildLiveMatchState } from "./views";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

/** The seed as it looked before stage 1 (contact details on users, no snapshots). */
function legacySeed(): Record<string, Doc[]> {
  const priv = new Map(seed.users_private!.map((p) => [p.id, p]));
  const out: Record<string, Doc[]> = { ...seed };
  delete out.users_private;
  out.users = seed.users!.map((u) => ({
    ...u,
    email: priv.get(u.id)?.email ?? null,
    phone: priv.get(u.id)?.phone ?? null,
  }));
  out.matches = seed.matches!.map((m) => {
    const copy = { ...m };
    delete copy.team1_snapshot;
    delete copy.team2_snapshot;
    return copy;
  });
  out.match_events = [
    { id: "e1", match_id: seed.matches![0]!.id, event_type: "wicket" },
    { id: "e2", match_id: seed.matches![0]!.id, event_type: "boundary_four" },
  ];
  return out;
}

function planFor(data: Record<string, Doc[]>, keepUserFields = false) {
  return planStage1(
    {
      users: data.users ?? [],
      usersPrivate: data.users_private ?? [],
      teams: data.teams ?? [],
      matches: data.matches ?? [],
      matchEvents: data.match_events ?? [],
    },
    { keepUserFields, now: "2024-06-01T00:00:00.000Z" },
  );
}

function client(ds: MemoryDataSource) {
  return {
    from: (table: string) => new QueryBuilder({ ds }, table as "teams"),
  };
}

describe("seed data", () => {
  it("keeps contact details out of public users", () => {
    for (const user of seed.users!) {
      expect(user).not.toHaveProperty("email");
      expect(user).not.toHaveProperty("phone");
    }
    expect(seed.users_private).toHaveLength(seed.users!.length);
    expect(seed.match_events).toBeUndefined();
  });

  it("is already migrated (planning again is a no-op)", () => {
    expect(planWrites(planFor(seed))).toBe(0);
  });
});

describe("stage 1 migration plan", () => {
  it("moves contact details, backfills snapshots and drops match_events", () => {
    const legacy = legacySeed();
    const plan = planFor(legacy);
    expect(plan.privateWrites).toHaveLength(legacy.users!.length);
    expect(plan.userStrips).toHaveLength(legacy.users!.length);
    expect(plan.matchSnapshots).toHaveLength(legacy.matches!.length);
    expect(plan.eventDeletes).toEqual(["e1", "e2"]);

    const migrated = applyStage1(legacy, plan);
    expect(migrated.users).toEqual(seed.users);
    expect(migrated.matches).toEqual(seed.matches);
    expect(
      [...migrated.users_private!].sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(
      [...seed.users_private!].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(migrated.match_events).toBeUndefined();
    // Idempotent.
    expect(planWrites(planFor(migrated))).toBe(0);
  });

  it("keeps a fresher users_private written by the new code", () => {
    const plan = planFor({
      users: [{ id: "u1", email: "old@x.com", phone: "+1" }],
      users_private: [{ id: "u1", email: "new@x.com", phone: null }],
    });
    expect(plan.privateWrites).toEqual([
      expect.objectContaining({
        id: "u1",
        data: expect.objectContaining({ email: "new@x.com", phone: "+1" }),
      }),
    ]);
  });

  it("can copy without stripping users (pre-deploy run)", () => {
    const legacy = legacySeed();
    const plan = planFor(legacy, true);
    expect(plan.userStrips).toHaveLength(0);
    const copied = applyStage1(legacy, plan);
    expect(copied.users![0]).toHaveProperty("email");
    // A second, full run then only strips.
    const second = planFor(copied);
    expect(second.privateWrites).toHaveLength(0);
    expect(second.userStrips).toHaveLength(legacy.users!.length);
  });

  it("lets seeded profiles sign in and be invited by email afterwards", async () => {
    const migrated = applyStage1(legacySeed(), planFor(legacySeed()));
    const ds = new MemoryDataSource(migrated);
    const john = {
      id: "google-uid",
      email: "John.Smith@email.com",
      phone: null,
      user_metadata: {},
    };
    expect(await canSignIn(ds, john, true)).toBe(true);
    expect(
      await inviteEmail(ds, seed.users![1]!.id, "john.smith@email.com"),
    ).toMatchObject({ status: "already_member", name: "John Smith" });
  });
});

describe("team snapshots on match lists", () => {
  const select = `*, innings(id, team_id, innings_number, total_runs, total_wickets, total_overs, is_completed)`;

  async function list(ds: MemoryDataSource) {
    const db = client(ds);
    const { data } = await new QueryBuilder({ ds }, "matches")
      .select(select)
      .order("scheduled_at", { ascending: false })
      .limit(50);
    ds.docsRead = 0;
    ds.queryCount = 0;
    const rows = await attachMatchTeams(db, (data ?? []) as Doc[]);
    return { rows, reads: ds.docsRead, calls: ds.queryCount };
  }

  it("reads no teams when every match has a snapshot", async () => {
    const ds = new MemoryDataSource(seed);
    const { rows, reads, calls } = await list(ds);
    expect(rows).toHaveLength(seed.matches!.length);
    expect(reads).toBe(0);
    expect(calls).toBe(0);
    const teamNames = new Map(seed.teams!.map((t) => [t.id, t.name]));
    for (const row of rows) {
      expect(row.team1).toMatchObject({
        name: teamNames.get(row.team1_id as string),
      });
      expect(row.team2).toMatchObject({
        name: teamNames.get(row.team2_id as string),
      });
    }
  });

  it("falls back to one batched teams read for matches without one", async () => {
    const legacy = legacySeed();
    const ds = new MemoryDataSource(legacy);
    const { rows, calls, reads } = await list(ds);
    expect(calls).toBe(1);
    expect(reads).toBe(seed.teams!.length);
    const withSnapshots = await list(new MemoryDataSource(seed));
    // Seed snapshots predate team colours; a fresh one carries them (null).
    const display = (t: unknown) => {
      const { primary_color, secondary_color, ...rest } = (t ?? {}) as Record<
        string,
        unknown
      >;
      expect(primary_color ?? null).toBeNull();
      expect(secondary_color ?? null).toBeNull();
      return rest;
    };
    expect(rows.map((r) => [display(r.team1), display(r.team2)])).toEqual(
      withSnapshots.rows.map((r) => [display(r.team1), display(r.team2)]),
    );
  });

  it("builds the live header from snapshots without reading teams", async () => {
    const match = seed.matches!.find((m) => m.status === "live")!;
    const ds = new MemoryDataSource(seed);
    const spy = vi.spyOn(ds, "getByIds");
    const row = await buildLiveMatchState(ds, match.id);
    expect(spy.mock.calls.some(([table]) => table === "teams")).toBe(false);
    expect(row?.team1_name).toBe(
      (match.team1_snapshot as { name: string }).name,
    );
  });
});

describe("syncTeamSnapshots", () => {
  const team = { id: "t1", name: "Tigers", short_name: "TIG", logo_url: null };
  const other = { id: "t2", name: "Kings", short_name: "KNG", logo_url: null };

  it("refreshes every match of a team when its display fields change", async () => {
    const ds = new MemoryDataSource({
      teams: [team, other],
      matches: [
        { id: "m1", team1_id: "t1", team2_id: "t2", ...(await snaps()) },
        { id: "m2", team1_id: "t2", team2_id: "t1", team1_snapshot: null },
      ],
    });
    async function snaps() {
      return matchTeamSnapshots(
        new MemoryDataSource({ teams: [team, other] }),
        "t1",
        "t2",
      );
    }
    const after = { ...team, logo_url: "https://x/logo.png" };
    await ds.update("teams", "t1", after);
    await syncTeamSnapshots(ds, {
      table: "teams",
      op: "update",
      before: team,
      after,
    });
    expect((await ds.getById("matches", "m1"))?.team1_snapshot).toEqual({
      id: "t1",
      name: "Tigers",
      short_name: "TIG",
      logo_url: "https://x/logo.png",
      primary_color: null,
      secondary_color: null,
    });
    expect((await ds.getById("matches", "m2"))?.team2_snapshot).toMatchObject({
      logo_url: "https://x/logo.png",
    });
  });

  it("ignores team writes that do not touch display fields", async () => {
    const ds = new MemoryDataSource({ teams: [team], matches: [] });
    const spy = vi.spyOn(ds, "query");
    await syncTeamSnapshots(ds, {
      table: "teams",
      op: "update",
      before: team,
      after: { ...team, captain_id: "u9" },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("fills snapshots on a match inserted without them", async () => {
    const ds = new MemoryDataSource({
      teams: [team, other],
      matches: [{ id: "m1", team1_id: "t1", team2_id: "t2" }],
    });
    await syncTeamSnapshots(ds, {
      table: "matches",
      op: "insert",
      before: null,
      after: { id: "m1", team1_id: "t1", team2_id: "t2", team1_snapshot: null },
    });
    expect(await ds.getById("matches", "m1")).toMatchObject({
      team1_snapshot: { id: "t1", name: "Tigers" },
      team2_snapshot: { id: "t2", name: "Kings" },
    });
  });

  it("does nothing for a match whose snapshots are current", async () => {
    const snaps = await matchTeamSnapshots(
      new MemoryDataSource({ teams: [team, other] }),
      "t1",
      "t2",
    );
    const ds = new MemoryDataSource({ teams: [team, other] });
    const spy = vi.spyOn(ds, "getByIds");
    await syncTeamSnapshots(ds, {
      table: "matches",
      op: "update",
      before: null,
      after: { id: "m1", team1_id: "t1", team2_id: "t2", ...snaps },
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
