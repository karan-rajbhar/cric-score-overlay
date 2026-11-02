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
import { clearMetadataCache } from "~/lib/metadata-cache";
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

/** Billed reads to add a new player from the scoring screen, live. */
const BOUND_ADD_PLAYER_LIVE = 13;

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

/**
 * The club and tournament pages split into a layout, which runs once, and a
 * page, which runs alone when a costly tab opens. A first visit is both; a
 * tab is the page alone. React `cache()` does not memoise outside a render,
 * so the layout and page of one request are only measured with no tab open.
 */
async function detailPages() {
  const { default: ClubLayout } = await import(
    "~/app/clubs/[id]/(detail)/layout"
  );
  const { default: ClubTab } = await import("~/app/clubs/[id]/(detail)/page");
  const { default: TournamentLayout } = await import(
    "~/app/tournaments/[id]/(detail)/layout"
  );
  const { default: TournamentTab } = await import(
    "~/app/tournaments/[id]/(detail)/page"
  );
  const params = (id: string) => Promise.resolve({ id });
  const search = (tab?: string) => Promise.resolve(tab ? { tab } : {});
  return {
    openClub: async (id: string) => {
      await ClubLayout({ params: params(id), children: null });
      await ClubTab({ params: params(id), searchParams: search() });
    },
    openClubTab: async (id: string, tab: string) => {
      // The page hands the tab to React as a component: run it as React would.
      const shown = await ClubTab({
        params: params(id),
        searchParams: search(tab),
      });
      const { type, props } = shown as unknown as {
        type: (p: unknown) => Promise<unknown>;
        props: unknown;
      };
      await type(props);
    },
    openTournament: async (id: string) => {
      await TournamentLayout({ params: params(id), children: null });
      await TournamentTab({ params: params(id), searchParams: search() });
    },
    openTournamentTab: (id: string, tab: string) =>
      TournamentTab({ params: params(id), searchParams: search(tab) }),
  };
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
  clearMetadataCache();
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
    const { getTeams } = await import("~/app/teams/actions");
    const { searchPlayers } = await import("./search-players");
    const { default: TeamPage } = await import("~/app/teams/[id]/page");
    const { searchScorers, recordBall } = await import(
      "~/app/matches/mutations"
    );
    const { default: PlayerPage } = await import("~/app/players/[id]/page");
    const { default: PlayersPage } = await import("~/app/players/page");
    const { openClub, openClubTab, openTournament, openTournamentTab } =
      await detailPages();

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
    // A finished match's ball log: the first view archives each innings
    // (one document per innings, built on the server), later views read
    // the archives instead of every over.
    let firstLog: unknown = null;
    const writesBefore = ds.writes;
    results.ballLog = await cost(async () => {
      firstLog = (await getMatchBallLog(completedMatch.id)).data;
    });
    expect(ds.writes - writesBefore).toBe(2);
    let archivedLog: unknown = null;
    results.ballLogArchived = await cost(async () => {
      archivedLog = (await getMatchBallLog(completedMatch.id)).data;
    });
    expect(archivedLog).toEqual(firstLog);
    // Info tab (browser query, same builder): the two pairings only.
    results.headToHead = await cost(() =>
      fetchHeadToHead(
        state.client as Parameters<typeof fetchHeadToHead>[0],
        String(completedMatch.team1_id),
        String(completedMatch.team2_id),
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
    // The scorecard carries the live_state of the same commit (no refs), so
    // the Summary / Scorecard / Stats tabs need no live_state listener.
    const { refs: _refs, id: _id, ...liveCopy } = live;
    void _refs;
    void _id;
    expect(card.live).toEqual(liveCopy);
    const overs = live.overs_changed as string[];
    expect(overs).toHaveLength(1);
    const readOvers = () =>
      Promise.all(overs.map((id) => ds.getById("overs", id)));
    const listen = (...tables: string[]) =>
      cost(() => Promise.all(tables.map((t) => ds.getById(t, liveMatch.id))));
    results.viewerPerBallOverlay = await listen("live_state");
    results.viewerPerBallSummary = await listen("live_scorecard");
    results.viewerPerBallBalls =
      (await listen("live_state")) + (await cost(readOvers));
    results.viewerPerBallStats =
      (await listen("live_scorecard")) + (await cost(readOvers));
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
    results.typeahead = await cost(() => searchPlayers(state.client as never, "jo"));
    results.typeaheadByHandle = await cost(() =>
      searchPlayers(state.client as never, "@john_smith"),
    );
    results.typeaheadApart = await cost(() =>
      searchPlayers(state.client as never, "smith john"),
    );
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
    // Opening a tab that lists matches, a moment later.
    results.playerTabMatches = await cost(() =>
      PlayerPage({
        params: Promise.resolve({ id: player.id }),
        searchParams: Promise.resolve({ tab: "matches" }),
      }),
    );
    clearMetadataCache();
    results.playerPageByHandle = await cost(() =>
      PlayerPage({
        params: Promise.resolve({ id: `@${player.username}` }),
        searchParams: Promise.resolve({}),
      }),
    );
    const clubId = String(completedMatch.club_id);
    results.clubPage = await cost(() => openClub(clubId));
    results.clubTabMatches = await cost(() => openClubTab(clubId, "matches"));
    results.clubTabStats = await cost(() => openClubTab(clubId, "stats"));
    results.clubTabMembers = await cost(() => openClubTab(clubId, "members"));
    // Every tab in one visit: what the split must not make dearer than the
    // page that read everything at once (46).
    results.clubEveryTab =
      results.clubPage! +
      results.clubTabMatches! +
      results.clubTabStats! +
      results.clubTabMembers!;
    results.teamPage = await cost(() =>
      TeamPage({
        params: Promise.resolve({ id: String(completedMatch.team1_id) }),
        searchParams: Promise.resolve({}),
      }),
    );
    const tournamentId = String(completedMatch.tournament_id);
    results.tournamentPage = await cost(() => openTournament(tournamentId));
    results.tournamentTabStats = await cost(() =>
      openTournamentTab(tournamentId, "analysis"),
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
      // 2 and 3 with a live_state listener next to the scorecard's.
      viewerPerBallSummary: 1,
      viewerPerBallBalls: 2,
      viewerPerBallStats: 2,
      // Every over of the match (45 before the archives): once, then
      // innings + archives + the rosters for names.
      ballLog: 50,
      ballLogArchived: 7,
      // Was every completed match (4 on the seed, unbounded in production):
      // now 2 equality queries for the two pairings (an empty one bills 1),
      // of any status so the live and upcoming meetings can be listed too:
      // the pair's own matches, 4 for the seed's busiest pair.
      headToHead: 4,
      // 6 when the tournament's club, the match's own, was checked twice.
      matchAdminCheck: 4,
      typeahead: 10,
      // + the exact username (1).
      typeaheadByHandle: 12,
      // The empty phrase query (1), then at most 3 x limit (15) + careers.
      typeaheadApart: 62,
      scorerTypeahead: 6,
      search: 25,
      // At most limit (5) per collection, and for the long query 1 + 3 x 5.
      searchMidWord: 25,
      searchMidWordLong: 80,
      playersList: 31,
      playersSearch: 30,
      // 24 when every visit read the match documents and rosters that only
      // the tabs listing matches show.
      playerPage: 17,
      playerTabMatches: 13,
      playerPageByHandle: 17,
      // 46 when every tab's lists were read on every visit.
      clubPage: 14,
      clubTabMatches: 14,
      clubTabStats: 26,
      clubTabMembers: 18,
      // More than the 46 of reading it all at once, for the few who open every
      // tab; most visitors stay on the first, and crawlers cannot open tabs.
      clubEveryTab: 72,
      tournamentTabStats: 13,
      // 28 when the leaderboard was read on every visit.
      tournamentPage: 20,
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
describe("club statistics", () => {
  const clubId = String(completedMatch.club_id);

  /** What the Stats tab hands `ClubStatsTab`. */
  async function statsProps() {
    const { default: ClubTab } = await import("~/app/clubs/[id]/(detail)/page");
    const page = (await ClubTab({
      params: Promise.resolve({ id: clubId }),
      searchParams: Promise.resolve({ tab: "stats" }),
    })) as unknown as {
      type: (p: unknown) => Promise<{ props: Record<string, unknown> }>;
      props: unknown;
    };
    return (await page.type(page.props)).props;
  }

  it("still shows the figures when the aggregates fail", async () => {
    const withAggregates = await statsProps();
    // As an index still building, or missing, fails on real Firestore.
    (ds as unknown as { sum?: unknown }).sum = undefined;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fromList = await statsProps();
    spy.mockRestore();
    const figures = (p: Record<string, unknown>) =>
      p.milestones as { totalRuns: number; totalWickets: number };
    expect(figures(fromList).totalRuns).toBeGreaterThan(0);
    expect(figures(fromList).totalRuns).toBe(figures(withAggregates).totalRuns);
    expect(fromList.leaderboardData).toBeTruthy();
  });

  it("has the indexes its sums need on real Firestore", () => {
    // sum() with a filter needs an index on both, and neither MemoryDataSource
    // nor the emulator says so: without them it failed in production only.
    const { indexes } = JSON.parse(
      readFileSync(join(process.cwd(), "firestore.indexes.json"), "utf8"),
    ) as {
      indexes: Array<{
        collectionGroup: string;
        fields: Array<{ fieldPath: string }>;
      }>;
    };
    const paths = indexes
      .filter((i) => i.collectionGroup === "matches")
      .map((i) => i.fields.map((f) => f.fieldPath).join(","));
    expect(paths).toContain("club_id,summary_runs");
    expect(paths).toContain("club_id,summary_wickets");
  });
});

describe("adding a player during a live match", () => {
  const matchId = String(liveMatch.id);
  const teamId = String(liveMatch.team1_id);

  async function addNew() {
    const { createPlayerQuick } = await import("~/app/teams/actions");
    signIn(admin);
    return cost(() => createPlayerQuick(teamId, "New Player", matchId));
  }

  beforeEach(async () => {
    const { writeLiveState } = await import("./live-state");
    await writeLiveState(ds, matchId);
  });

  it("costs what a squad needs, not a scoreboard rebuild", async () => {
    // 54 when every player added rebuilt live_state and the live scorecard.
    expect(await addNew()).toBeLessThanOrEqual(BOUND_ADD_PLAYER_LIVE);
  });

  it("leaves the roster a full rebuild would give", async () => {
    await addNew();
    const appended = (await ds.getById("teams", teamId))!.roster as Array<{
      user?: { full_name?: string };
    }>;
    expect(appended.some((e) => e.user?.full_name === "New Player")).toBe(true);
    const { refreshRoster } = await import("./denorm");
    await refreshRoster(ds, teamId);
    expect((await ds.getById("teams", teamId))!.roster).toEqual(appended);
  });

  it("tells viewers, and that nothing else changed", async () => {
    const before = (await ds.getById("live_state", matchId))!;
    await addNew();
    const after = (await ds.getById("live_state", matchId))!;
    expect(after.version).toBe(Number(before.version) + 1);
    expect(after.overs_changed).toEqual([]);
    expect(after.innings_changed).toEqual([]);
    expect(after.match_rev).toBe(before.match_rev);
  });

  it("does not play the last ball's graphics again", async () => {
    await ds.update("live_state", matchId, {
      events: [{ type: "four" }],
      refs: { wicket_streaks: { bowler: 2 } },
    });
    await addNew();
    const after = (await ds.getById("live_state", matchId))!;
    expect(after.events).toEqual([]);
    expect((after.refs as { wicket_streaks: unknown }).wicket_streaks).toEqual({
      bowler: 2,
    });
  });

  it("keeps the copy on the live scorecard in step", async () => {
    await addNew();
    const state = (await ds.getById("live_state", matchId))!;
    const card = (await ds.getById("live_scorecard", matchId))!;
    expect((card.live as { version: number }).version).toBe(state.version);
  });
});

describe("billed reads per page at scale", () => {
  it("stays bounded however many documents there are", async () => {
    const { scaleSeed } = await import("./__fixtures__/scale");
    const { data, ids } = scaleSeed(seed);
    ds = new MemoryDataSource(data);
    const users = new Map(data.users!.map((u) => [u.id, u]));
    const { default: TeamsPage } = await import("~/app/teams/page");
    const { default: ClubsPage } = await import("~/app/clubs/page");
    const { default: TournamentsPage } = await import("~/app/tournaments/page");
    const { openClub, openClubTab, openTournament } = await detailPages();
    const { default: TeamPage } = await import("~/app/teams/[id]/page");
    const { default: PlayerPage } = await import("~/app/players/[id]/page");
    const { fetchWizardBase, fetchWizardScope } = await import(
      "~/app/matches/create/wizard-data"
    );
    const none = { searchParams: Promise.resolve({}) };
    const at: Record<string, number> = {};

    signIn(null);
    at.teamsAll = await cost(() => TeamsPage(none as never));
    at.clubsList = await cost(() => ClubsPage(none));
    at.tournamentsList = await cost(() => TournamentsPage(none));
    at.bigClubPage = await cost(() => openClub(ids.bigClub));
    at.bigClubStats = await cost(() => openClubTab(ids.bigClub, "stats"));
    at.bigClubMembers = await cost(() => openClubTab(ids.bigClub, "members"));
    at.bigClubMatches = await cost(() => openClubTab(ids.bigClub, "matches"));
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
      openTournament(ids.tournament),
    );
    const { getRegistrableTeams } = await import("~/app/tournaments/actions");
    at.registerTeamDialog = await cost(() =>
      getRegistrableTeams(ids.tournament),
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
      // 194 when every tab's lists were read on every visit.
      bigClubPage: 16,
      bigClubStats: 26,
      bigClubMembers: 102,
      bigClubMatches: 55,
      // ~206 (every match of the team): the latest 50 per side and count()s
      // for the totals and the record.
      bigTeamPage: 70,
      // ~310 (every fixture of the player's 3 teams): the matches they have
      // records in, their teams' live and next 20 fixtures.
      // 123 when every visit read every match the player has played in.
      busyPlayerPage: 58,
      // ~680 (every team, tournament and club): the organiser's own (here
      // they created all 150 tournaments) and the picked club's teams.
      wizard: 195,
      // ~418 (every team, for the register dialog): read when it opens.
      tournamentPageOrganiser: 6,
      // Every team (400 here) before it had a limit, plus the admin check.
      registerTeamDialog: 205,
    };
    for (const [page, max] of Object.entries(bounds)) {
      expect(at[page], page).toBeLessThanOrEqual(max);
    }
  }, 60_000);
});
