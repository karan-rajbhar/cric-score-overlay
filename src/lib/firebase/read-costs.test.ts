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
/** JSON bytes of the docs a spectator downloads per ball. */
const egress: Record<string, number> = {};

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
    const { fetchHeadToHead } = await import("~/lib/hooks/useMatchQueries");
    const { isMatchAdmin } = await import("./rpc/auth-helpers");
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
      await getMatches({ status: "scheduled", limit: 6 });
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
    // Info tab (browser query, same builder): the two pairings only.
    results.headToHead = await cost(() =>
      fetchHeadToHead(
        state.client as Parameters<typeof fetchHeadToHead>[0],
        String(completedMatch.team1_id),
        String(completedMatch.team2_id),
        completedMatch.id,
      ),
    );
    // `is_match_admin` for a signed-in viewer who is not a scorer (match
    // page, scoring screen), on a club tournament's match.
    const viewer = seed.users!.find(
      (u) =>
        u.id !== completedMatch.created_by &&
        !((completedMatch.match_admins as string[] | undefined) ?? []).includes(
          u.id,
        ) &&
        !seed.club_memberships!.some(
          (m) =>
            m.user_id === u.id && (m.role === "owner" || m.role === "admin"),
        ),
    )!;
    let viewerIsAdmin: boolean | null = null;
    results.matchAdminCheck = await cost(async () => {
      viewerIsAdmin = await isMatchAdmin(ds, completedMatch.id, viewer.id);
    });
    expect(viewerIsAdmin).toBe(false);

    signIn(admin);
    const scoring = await getScoringState(liveMatch.id);
    const data = scoring.data!;
    let delta: unknown = null;
    results.scoringPerBall = await cost(async () => {
      const res = await recordBall({
        matchId: liveMatch.id,
        bowlerId: data.bowlerId!,
        batsmanId: data.strikerId!,
        nonStrikerId: data.nonStrikerId!,
        event: { runsScored: 1 } as never,
      });
      expect(res.error).toBeNull();
      delta = res.delta;
    });
    // The scoring screen updates from the documents the ball committed
    // (`delta`, see ~/lib/scoring-delta); it re-read its state (7 reads)
    // after every ball before.
    expect(delta).toBeTruthy();
    results.scoringScreenPerBall = results.scoringPerBall;

    // A spectator per ball, by match page tab. Listeners bill 1 read per
    // changed doc; the Balls / Stats tabs read the `overs` docs named by
    // live_state.overs_changed. No server request on any tab.
    const live = (await ds.getById("live_state", liveMatch.id))!;
    const card = (await ds.getById("live_scorecard", liveMatch.id))!;
    expect(card).toBeTruthy();
    const overs = live.overs_changed as string[];
    expect(overs).toHaveLength(1);
    const readOvers = () =>
      Promise.all(overs.map((id) => ds.getById("overs", id)));
    const listen = (...tables: string[]) =>
      cost(() => Promise.all(tables.map((t) => ds.getById(t, liveMatch.id))));
    results.viewerPerBallOverlay = await listen("live_state");
    results.viewerPerBallSummary = await listen("live_state", "live_scorecard");
    results.viewerPerBallBalls =
      (await listen("live_state")) + (await cost(readOvers));
    results.viewerPerBallStats =
      (await listen("live_state", "live_scorecard")) + (await cost(readOvers));
    const bytes = (doc: unknown) => Buffer.byteLength(JSON.stringify(doc));
    const overDoc = await ds.getById("overs", overs[0]!);
    egress.liveState = bytes(live);
    egress.liveScorecard = bytes(card);
    egress.over = bytes(overDoc);
    // What the same viewer cost before: a server request per ball.
    let response: unknown = null;
    results.beforeSummaryRefetch = await cost(async () => {
      response = (await getMatch(liveMatch.id, { skipCache: true })).data;
    });
    egress.beforeSummaryResponse = bytes(response);
    results.beforeBallsRefetch = await cost(async () => {
      response = (await getMatchBallLog(liveMatch.id)).data;
    });
    egress.beforeBallsResponse = bytes(response);
    results.teamsMine = await cost(() => getTeams({ mine: true }));
    results.typeahead = await cost(() => searchUsers("jo"));
    results.scorerTypeahead = await cost(() => searchScorers("jo"));
    signIn(null);

    results.search = await cost(() => globalSearch("jo"));
    // Mid-word: 3 letters are one trigram query per collection; longer
    // queries add a trigram query only where no word starts with them.
    results.searchMidWord = await cost(() => globalSearch("ohn"));
    results.searchMidWordLong = await cost(() => globalSearch("mith"));
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
    console.info("spectator doc sizes (JSON bytes)", egress);
    // Upper bounds (seed: 8 matches, 30 users). Before stage 3 these were
    // home 6, /matches 20, dashboard 18, match page 67, scoring screen 29
    // per ball, search 47, typeahead 30, players search 30, player page 43
    // (72 by @handle), club page 141, tournament page 98. The club and
    // tournament pages read their leaderboard as LEADERBOARD_SHARDS (8)
    // shard documents (was 1 document, which capped a scope at ~1,500
    // players): club 42 -> 49, tournament 25 -> 32. The club page then
    // took its hall of fame players from the members' snapshots (49 -> 46)
    // and the tournament page its points table's teams from the
    // registrations (32 -> 28: one read per team fewer).
    const bounds: Record<string, number> = {
      home: 2,
      matches: 8,
      // 6 before the upcoming fixtures (scheduled matches, limit 6).
      dashboard: 8,
      matchPageWarm: 8,
      scoringState: 7,
      // 12 when the screen re-read its state after every ball.
      scoringScreenPerBall: 5,
      viewerPerBallOverlay: 1,
      viewerPerBallSummary: 2,
      viewerPerBallBalls: 2,
      viewerPerBallStats: 3,
      ballLog: 45,
      // Was every completed match (4 on the seed, unbounded in production):
      // now 2 equality queries for the two pairings (an empty one bills 1).
      headToHead: 3,
      // 6 when the tournament's club, the match's own, was checked twice.
      matchAdminCheck: 4,
      typeahead: 10,
      scorerTypeahead: 6,
      search: 25,
      // At most limit (5) per collection, and for the long query 1 + 3 x 5.
      searchMidWord: 25,
      searchMidWordLong: 80,
      playersList: 31,
      playersSearch: 30,
      // 24 when dismissal names read the rosters of every listed fixture;
      // back to 24 with the teams' live and next fixtures read by status
      // (4 queries, 1 read each when empty) instead of every fixture of
      // every team (see the scale test).
      playerPage: 24,
      playerPageByHandle: 24,
      clubPage: 46,
      tournamentPage: 28,
      // +1 per live match listed: its innings in progress, which the match
      // summary no longer follows ball by ball (it cost a match write per
      // ball before).
      teamPage: 8,
    };
    for (const [page, max] of Object.entries(bounds)) {
      expect(results[page], page).toBeLessThanOrEqual(max);
    }
    expect(egress.liveState).toBeLessThan(3000);
    expect(egress.liveScorecard).toBeLessThan(15_000);
    if (process.env.READ_COSTS_OUT) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        process.env.READ_COSTS_OUT,
        JSON.stringify(results, null, 2),
      );
    }
  }, 60_000);
});

/**
 * The same pages on the seed grown to production-like size
 * (`__fixtures__/scale.ts`: 1,000 matches, 400 teams, 120 clubs, 150
 * tournaments, a club with 250 matches and 300 members), where the
 * unbounded lists showed. What each read before keyset pages, limits and
 * count() / sum() aggregations is noted per bound.
 */
describe("billed reads per page at scale", () => {
  it("stays bounded however many documents there are", async () => {
    const { scaleSeed } = await import("./__fixtures__/scale");
    const { data, ids } = scaleSeed(seed);
    ds = new MemoryDataSource(data);
    const users = new Map(data.users!.map((u) => [u.id, u]));
    const { default: TeamsPage } = await import("~/app/teams/page");
    const { default: ClubsPage } = await import("~/app/clubs/page");
    const { default: TournamentsPage } = await import("~/app/tournaments/page");
    const { default: ClubPage } = await import("~/app/clubs/[id]/page");
    const { default: TeamPage } = await import("~/app/teams/[id]/page");
    const { default: PlayerPage } = await import("~/app/players/[id]/page");
    const { default: TournamentPage } = await import(
      "~/app/tournaments/[id]/page"
    );
    const { fetchWizardBase, fetchWizardScope } = await import(
      "~/app/matches/create/wizard-data"
    );
    const none = { searchParams: Promise.resolve({}) };
    const at: Record<string, number> = {};

    signIn(null);
    at.teamsAll = await cost(() => TeamsPage(none as never));
    at.clubsList = await cost(() => ClubsPage(none));
    at.tournamentsList = await cost(() => TournamentsPage(none));
    at.bigClubPage = await cost(() =>
      ClubPage({ params: Promise.resolve({ id: ids.bigClub }), ...none }),
    );
    at.bigTeamPage = await cost(() =>
      TeamPage({ params: Promise.resolve({ id: ids.bigTeam }), ...none }),
    );
    at.busyPlayerPage = await cost(() =>
      PlayerPage({ params: Promise.resolve({ id: ids.player }), ...none }),
    );

    signIn(users.get(ids.organiser)!);
    // An organiser opening the match wizard, then picking their club.
    at.wizard = await cost(async () => {
      const base = await fetchWizardBase(state.client as never, ids.organiser);
      expect(base.teams.length).toBeGreaterThan(0);
      await fetchWizardScope(state.client as never, { clubId: ids.bigClub });
    });
    at.tournamentPageOrganiser = await cost(() =>
      TournamentPage({
        params: Promise.resolve({ id: ids.tournament }),
        ...none,
      }),
    );

    console.info("billed reads per page (at scale)", at);
    const bounds: Record<string, number> = {
      // ~404 before (every team): one page of 30 now.
      teamsAll: 32,
      // ~244 (every public club and a team count() each): one page, the
      // counts stored on the clubs.
      clubsList: 33,
      // ~153 (every tournament): one page.
      tournamentsList: 32,
      // ~590 (every club match and member): the latest 50 matches, the
      // first 100 members, 8 leaderboard shards and the milestone
      // aggregates (count / sum / top innings).
      bigClubPage: 200,
      // ~206 (every match of the team): the latest 50 per side and count()s
      // for the totals and the record.
      bigTeamPage: 70,
      // ~310 (every fixture of the player's 3 teams): the matches they have
      // records in, their teams' live and next 20 fixtures.
      busyPlayerPage: 125,
      // ~680 (every team, tournament and club): the organiser's own (here
      // they created all 150 tournaments) and the picked club's teams.
      wizard: 195,
      // ~418 (every team, for the register dialog): read when it opens.
      tournamentPageOrganiser: 16,
    };
    for (const [page, max] of Object.entries(bounds)) {
      expect(at[page], page).toBeLessThanOrEqual(max);
    }
  }, 60_000);
});
