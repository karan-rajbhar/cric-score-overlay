import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import {
  LivePerformanceCard,
  type LivePerformanceItem,
} from "~/components/players/live-performance-card";
import PlayerPage from "./page";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const liveMatch = seed.matches!.find((m) => m.status === "live")!;
const current = seed.innings!.find(
  (i) => i.match_id === liveMatch.id && !i.is_completed,
)!;
const batter = (
  current.batting as { user_id: string; runs_scored: number }[]
)[0]!;
const bowler = (current.bowling as { user_id: string }[])[0]!;

/** The LivePerformanceCard props in a rendered server component tree. */
function findLiveCard(node: ReactNode): LivePerformanceItem[] | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findLiveCard(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as {
    children?: ReactNode;
    /** PlayerActivityTabs' first tab. */
    statistics?: ReactNode;
    /** SeasonStatistics' slot under the headline tiles. */
    between?: ReactNode;
    performances?: LivePerformanceItem[];
  };
  if (node.type === LivePerformanceCard) return props.performances ?? null;
  return (
    findLiveCard(props.children) ??
    findLiveCard(props.statistics) ??
    findLiveCard(props.between)
  );
}

async function render(userId: string) {
  const ds = new MemoryDataSource(seed);
  state.client = serverClientFor({ ds, db: null, getUser: async () => null });
  const before = ds.billedReads;
  const tree = await PlayerPage({
    params: Promise.resolve({ id: userId }),
    searchParams: Promise.resolve({}),
  });
  return { card: findLiveCard(tree), reads: ds.billedReads - before, ds };
}

describe("player page: innings in progress", () => {
  it("shows a batter's live figures from live_scorecard", async () => {
    const { card } = await render(batter.user_id);
    expect(card).not.toBeNull();
    expect(card![0]).toMatchObject({
      matchId: liveMatch.id,
      match: { id: liveMatch.id },
      batting: [{ inningsId: current.id, runs: batter.runs_scored }],
    });
  });

  it("shows a bowler's live figures", async () => {
    const { card } = await render(bowler.user_id);
    expect(card![0]!.bowling).toHaveLength(1);
  });

  it("costs one read per live match once the doc exists", async () => {
    const first = await render(batter.user_id);
    // Built on the first view (it predates the seed); later views read it.
    expect(await first.ds.getById("live_scorecard", liveMatch.id)).toBeTruthy();
    state.client = serverClientFor({
      ds: first.ds,
      db: null,
      getUser: async () => null,
    });
    const without = new MemoryDataSource({
      ...seed,
      matches: seed.matches!.map((m) =>
        m.id === liveMatch.id ? { ...m, status: "completed" } : m,
      ),
    });
    const base = async (ds: MemoryDataSource) => {
      state.client = serverClientFor({
        ds,
        db: null,
        getUser: async () => null,
      });
      const before = ds.billedReads;
      await PlayerPage({
        params: Promise.resolve({ id: batter.user_id }),
        searchParams: Promise.resolve({}),
      });
      return ds.billedReads - before;
    };
    expect((await base(first.ds)) - (await base(without))).toBe(1);
  });

  it("shows nothing for a player not in the live match", async () => {
    const inLive = new Set(
      (seed.player_matches ?? [])
        .filter((pm) => pm.match_id === liveMatch.id)
        .map((pm) => pm.user_id),
    );
    for (const inn of seed.innings!.filter(
      (i) => i.match_id === liveMatch.id,
    )) {
      for (const r of [
        ...((inn.batting as { user_id: string }[]) ?? []),
        ...((inn.bowling as { user_id: string }[]) ?? []),
      ]) {
        inLive.add(r.user_id);
      }
    }
    const other = seed.users!.find((u) => !inLive.has(u.id))!;
    const { card } = await render(other.id);
    expect(card).toBeNull();
  });
});

describe("player page: which player the URL names", () => {
  // Real accounts carry a Firebase Auth uid: 28 mixed-case characters.
  const UID = "w4RVc8WK0UbGVm8jb2O1iUoGv1S2";
  const open = async (id: string) => {
    const ds = new MemoryDataSource({
      ...seed,
      users: [
        ...seed.users!,
        { id: UID, full_name: "Uid Player", username: "uid_player" },
      ],
    });
    state.client = serverClientFor({ ds, db: null, getUser: async () => null });
    return PlayerPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    });
  };

  it("opens a player by their Firebase uid, case kept", async () => {
    await expect(open(UID)).resolves.toBeTruthy();
  });

  it("does not match an id by another case", async () => {
    await expect(open(UID.toLowerCase())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("opens a player by @handle", async () => {
    await expect(open("@Uid_Player")).resolves.toBeTruthy();
  });

  it("sends an old bare handle to the canonical address", async () => {
    await expect(open("uid_player")).rejects.toThrow(
      "NEXT_REDIRECT /players/@uid_player",
    );
  });

  it("404s for nobody", async () => {
    await expect(open("nobody_here")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
