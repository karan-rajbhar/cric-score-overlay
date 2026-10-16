/**
 * Billed Firestore reads per page / action on the seed data, measured by
 * running the real server code over a counting MemoryDataSource.
 *
 * The numbers are printed (console.info) and bounded below so a change
 * that reintroduces a scan fails here.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));

const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "./auth-types";
import { MemoryDataSource, type Doc } from "./datasource";
import { serverClientFor } from "./server-client";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const liveMatch = seed.matches!.find((m) => m.status === "live")!;
const completedMatch = seed.matches!.find(
  (m) => m.status === "completed" && m.tournament_id,
)!;
const admin = seed.users!.find((u) => u.id === liveMatch.created_by)!;
const busiestPlayer = (() => {
  const counts = new Map<string, number>();
  for (const pm of seed.player_matches!) {
    counts.set(String(pm.user_id), (counts.get(String(pm.user_id)) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
})();
const player = seed.users!.find((u) => u.id === busiestPlayer)!;

let ds: MemoryDataSource;

function signIn(user: Doc | null) {
  const appUser: AppUser | null = user
    ? ({
        id: user.id,
        email: null,
        phone: null,
        user_metadata: { full_name: user.full_name },
      } as unknown as AppUser)
    : null;
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () => appUser,
  });
}

async function cost(run: () => Promise<unknown>): Promise<number> {
  const before = ds.billedReads;
  await run();
  return ds.billedReads - before;
}

const results: Record<string, number> = {};

beforeEach(() => {
  ds = new MemoryDataSource(seed);
  signIn(null);
});

describe("billed reads per page on the seed data", () => {
  it("measures every hot path", async () => {
    const {
      getMatches,
      getMatch,
      getLiveMatchState,
      getScoringState,
      getMatchBallLog,
    } = await import("~/app/matches/queries");
    const { globalSearch } = await import("~/app/search/actions");
    const { getTeams, searchUsers } = await import("~/app/teams/actions");
    const { default: TeamPage } = await import("~/app/teams/[id]/page");
    const { searchScorers, recordBall } = await import(
      "~/app/matches/mutations"
    );
    const { default: PlayerPage } = await import("~/app/players/[id]/page");
    const { default: PlayersPage } = await import("~/app/players/page");
    const { default: ClubPage } = await import("~/app/clubs/[id]/page");
    const { default: TournamentPage } = await import(
      "~/app/tournaments/[id]/page"
    );

    results.home = await cost(() => getMatches({ status: "live", limit: 6 }));
    results.matches = await cost(() => getMatches({}));
    results.dashboard = await cost(async () => {
      await getMatches({ status: "live" });
      await getMatches({ status: "completed", limit: 6 });
    });
    results.matchPage = await cost(async () => {
      await getMatch(completedMatch.id, { skipCache: true });
      await getLiveMatchState(completedMatch.id, { skipCache: true });
    });
    // Again, once live_state exists (every later view).
    results.matchPageWarm = await cost(async () => {
      await getMatch(completedMatch.id, { skipCache: true });
      await getLiveMatchState(completedMatch.id, { skipCache: true });
    });
    results.liveMatchPage = await cost(async () => {
      await getMatch(liveMatch.id, { skipCache: true });
      await getLiveMatchState(liveMatch.id, { skipCache: true });
    });
    results.scoringState = await cost(() => getScoringState(liveMatch.id));
    results.ballLog = await cost(() => getMatchBallLog(completedMatch.id));

    signIn(admin);
    const scoring = await getScoringState(liveMatch.id);
    const data = scoring.data!;
    results.scoringPerBall = await cost(async () => {
      const res = await recordBall({
        matchId: liveMatch.id,
        bowlerId: data.bowlerId!,
        batsmanId: data.strikerId!,
        nonStrikerId: data.nonStrikerId!,
        event: { runsScored: 1 } as never,
      });
      expect(res.error).toBeNull();
    });
    // The scoring screen re-reads its state after every ball.
    results.scoringScreenPerBall =
      results.scoringPerBall +
      (await cost(() => getScoringState(liveMatch.id)));
    results.teamsMine = await cost(() => getTeams({ mine: true }));
    results.typeahead = await cost(() => searchUsers("jo"));
    results.scorerTypeahead = await cost(() => searchScorers("jo"));
    signIn(null);

    results.search = await cost(() => globalSearch("jo"));
    results.playersList = await cost(() =>
      PlayersPage({ searchParams: Promise.resolve({}) }),
    );
    results.playersSearch = await cost(() =>
      PlayersPage({ searchParams: Promise.resolve({ q: "jo" }) }),
    );
    results.playerPage = await cost(() =>
      PlayerPage({
        params: Promise.resolve({ id: player.id }),
        searchParams: Promise.resolve({}),
      }),
    );
    results.playerPageByHandle = await cost(() =>
      PlayerPage({
        params: Promise.resolve({ id: `@${player.username}` }),
        searchParams: Promise.resolve({}),
      }),
    );
    results.clubPage = await cost(() =>
      ClubPage({
        params: Promise.resolve({ id: String(completedMatch.club_id) }),
        searchParams: Promise.resolve({}),
      }),
    );
    results.teamPage = await cost(() =>
      TeamPage({
        params: Promise.resolve({ id: String(completedMatch.team1_id) }),
        searchParams: Promise.resolve({}),
      }),
    );
    results.tournamentPage = await cost(() =>
      TournamentPage({
        params: Promise.resolve({ id: String(completedMatch.tournament_id) }),
        searchParams: Promise.resolve({}),
      }),
    );

    console.info("billed reads per page (seed data)", results);
    // Upper bounds (seed: 8 matches, 30 users). Before stage 3 these were
    // home 6, /matches 20, dashboard 18, match page 67, scoring screen 29
    // per ball, search 47, typeahead 30, players search 30, player page 43
    // (72 by @handle), club page 141, tournament page 98.
    const bounds: Record<string, number> = {
      home: 2,
      matches: 8,
      dashboard: 6,
      matchPageWarm: 8,
      scoringState: 7,
      scoringScreenPerBall: 12,
      ballLog: 45,
      typeahead: 10,
      scorerTypeahead: 6,
      search: 25,
      playersList: 31,
      playersSearch: 30,
      playerPage: 25,
      playerPageByHandle: 25,
      clubPage: 42,
      tournamentPage: 25,
    };
    for (const [page, max] of Object.entries(bounds)) {
      expect(results[page], page).toBeLessThanOrEqual(max);
    }
    if (process.env.READ_COSTS_OUT) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        process.env.READ_COSTS_OUT,
        JSON.stringify(results, null, 2),
      );
    }
  }, 60_000);
});
