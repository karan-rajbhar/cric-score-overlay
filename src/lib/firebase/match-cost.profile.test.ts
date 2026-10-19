/**
 * Firestore cost of one whole match, measured (not estimated) by running
 * the real server code over a counting MemoryDataSource.
 *
 * A T20 match is created on the seed (existing teams, tournament and club)
 * and scored end to end through the server actions the scoring screen
 * calls: toss, openers, a bowler per over, ~240 deliveries with wides,
 * no-balls, byes, leg byes, wickets, a retirement, an undo and an
 * `update_ball` edit, the innings break and a chase to the result (player
 * records, statistics, leaderboards, standings, player of the match).
 *
 * Around each action the test also runs what each client does in response,
 * mirroring the code:
 *
 * - scorer (`useScoring.ts` + `OtherScorerNotice`): the server action, the
 *   refetches the hook makes after it, and its `live_state` listener;
 * - viewer on the match page (`useMatchDetailQuery` & co.): a read per
 *   `live_state` / `live_scorecard` change, the `overs` docs named by
 *   `live_state.overs_changed` (Balls / Stats tabs) and a `getMatch`
 *   refetch on structural changes (status, innings, `match_rev`);
 * - OBS overlay: `live_state` only;
 * - a second scorer on the scoring screen (`useLiveResync`): its
 *   `live_state` listener, and per change by the other scorer the
 *   `innings` / `overs` docs that change wrote (`live_state.innings_changed`
 *   / `overs_changed`, applied with `applyLiveResync`), re-reading the whole
 *   state only after a structural change or a missed version.
 *
 * The table is printed (console.info) and the totals are bounded below, so
 * a change that adds reads or writes to the scoring loop fails here.
 *
 * Instant scoring (`~/lib/scoring-prediction`): before every delivery,
 * crease and bowler change the scorer also predicts the action from the
 * documents it holds, and the prediction must equal the state built from
 * the server's reply (timestamps and the new ball's id aside).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
// No server micro-cache: every request is billed as if it missed.
vi.mock("~/lib/match-cache", () => ({
  invalidateMatchCache: vi.fn(),
  getCachedMatch: () => null,
  setCachedMatch: vi.fn(),
  getPendingQuery: () => null,
  setPendingQuery: vi.fn(),
  clearPendingQuery: vi.fn(),
  getCachedLiveState: () => null,
  setCachedLiveState: vi.fn(),
  getPendingLiveQuery: () => null,
  setPendingLiveQuery: vi.fn(),
  clearPendingLiveQuery: vi.fn(),
}));

const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { ScoringState } from "~/app/matches/types";
import {
  applyLiveResync,
  applyScoringDelta,
  liveChangesOf,
  liveJournalEntry,
  liveResyncReads,
  type LiveJournalEntry,
  type ScoringDelta,
  type ScoringSnapshot,
} from "~/lib/scoring-delta";
import type { QueuedAction } from "~/lib/offline-queue";
import {
  baseWithDelta,
  foldPending,
  type PredictionBase,
} from "~/lib/scoring-prediction";
import type { OversRow } from "./scorecard";
import type { InningsRow } from "./types";
import type { AppUser } from "./auth-types";
import { MemoryDataSource, type Doc } from "./datasource";
import type { LiveStateDoc } from "./live-state";
import { serverClientFor } from "./server-client";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const ADMIN = "550e8400-e29b-41d4-a716-446655440001";
const TEAM1 = "750e8400-e29b-41d4-a716-446655440001";
const TEAM2 = "750e8400-e29b-41d4-a716-446655440002";
const TOURNAMENT = "850e8400-e29b-41d4-a716-446655440001";
const CLUB = "650e8400-e29b-41d4-a716-446655440001";

type Counts = Record<string, number>;

interface Cost {
  reads: Counts;
  writes: Counts;
}

const sum = (c: Counts) => Object.values(c).reduce((s, n) => s + n, 0);

function diff(after: Counts, before: Counts): Counts {
  const out: Counts = {};
  for (const [k, v] of Object.entries(after)) {
    const d = v - (before[k] ?? 0);
    if (d) out[k] = d;
  }
  return out;
}

function add(into: Counts, from: Counts, times = 1): void {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v * times;
}

class Meter {
  constructor(private readonly ds: MemoryDataSource) {}

  async run<R>(fn: () => Promise<R>): Promise<[R, Cost]> {
    const reads = { ...this.ds.readsByTable };
    const writes = { ...this.ds.writesByTable };
    const result = await fn();
    return [
      result,
      {
        reads: diff(this.ds.readsByTable, reads),
        writes: diff(this.ds.writesByTable, writes),
      },
    ];
  }
}

/** Per action type: count and summed reads / writes by party. */
interface Row {
  n: number;
  serverReads: Counts;
  serverWrites: Counts;
  /** Scorer refetches after the action (server requests the hook makes). */
  scorerRefetchReads: Counts;
  /** Scorer listener reads (live_state). */
  scorerListenReads: number;
  /** One viewer on the Summary tab (listeners + structural getMatch). */
  viewerReads: number;
  /** One viewer on the Balls tab (live_state + changed overs). */
  viewerBallsReads: number;
  overlayReads: number;
  /**
   * A second scorer on the scoring screen (`useLiveResync`): its live_state
   * listener and the documents the change wrote (or a full re-read of the
   * scoring state when that is not enough), per change made by someone
   * else.
   */
  coScorerReads: number;
}

const rows = new Map<string, Row>();
function row(kind: string): Row {
  let r = rows.get(kind);
  if (!r) {
    r = {
      n: 0,
      serverReads: {},
      serverWrites: {},
      scorerRefetchReads: {},
      scorerListenReads: 0,
      viewerReads: 0,
      viewerBallsReads: 0,
      overlayReads: 0,
      coScorerReads: 0,
    };
    rows.set(kind, r);
  }
  return r;
}

type Queries = typeof import("~/app/matches/queries");
type Snapshot = ScoringSnapshot<
  {
    id: string;
    current_innings?: number | null;
    team1_id: string;
    team2_id: string;
    innings?: Array<{ id: string; innings_number: number; team_id: string }>;
  },
  { id: string }
>;

/**
 * What `useScoring` does after each action (server requests only; the
 * optimistic local updates cost nothing): it applies the committed
 * documents the action answers with (`applyScoringDelta`) and re-reads its
 * state (`syncFromDb`) only when they are not enough. `verify` (not billed)
 * checks every delta-built snapshot against a fresh `getScoringState`.
 */
class ScorerModel {
  snap: Snapshot | null = null;
  /** The stored documents behind `snap` (instant scoring's base). */
  base: PredictionBase | null = null;
  predictions = 0;
  private squads: string | null = null;
  private names = new Map<string, { id: string; full_name: string | null }>();
  deltasApplied = 0;
  verify?: (snap: Snapshot) => Promise<void>;

  constructor(
    private readonly matchId: string,
    private readonly q: Queries,
  ) {}

  /** The squads, when the batting / bowling sides change (`loadPlayers`). */
  private async loadSquads(snap: Snapshot): Promise<void> {
    const m = snap.match;
    const inn = m.innings?.find((i) => i.innings_number === m.current_innings);
    const batting = inn ? inn.team_id : m.team1_id;
    const bowling = inn
      ? batting === m.team1_id
        ? m.team2_id
        : m.team1_id
      : m.team2_id;
    const key = `${batting}/${bowling}`;
    if (key === this.squads) return;
    const squads = await Promise.all([
      this.q.getTeamPlayers(batting),
      this.q.getTeamPlayers(bowling),
    ]);
    for (const res of squads) {
      for (const p of (res.data ?? []) as Array<{
        user_id: string;
        user?: { id: string; full_name: string | null } | null;
      }>) {
        if (p.user) {
          this.names.set(p.user_id, {
            id: p.user.id,
            full_name: p.user.full_name,
          });
        }
      }
    }
    this.squads = key;
  }

  /** Player names known from the squads (for `applyScoringDelta`). */
  get squadNames() {
    return this.names;
  }

  /** `syncFromDb`: getScoringState, plus the squads when the sides change. */
  async sync(): Promise<void> {
    const res = await this.q.getScoringState(this.matchId);
    expect(res.error).toBeNull();
    const snap = res.data as unknown as Snapshot;
    await this.loadSquads(snap);
    this.snap = snap;
    this.base = res.base ?? null;
  }

  /**
   * What instant scoring would show after `action` (the engine's functions
   * on the held documents), or null when it would wait for the server.
   */
  predict(action: QueuedAction): Snapshot | null {
    if (!this.snap) return null;
    const folded = foldPending(
      { snapshot: this.snap, base: this.base },
      [action],
      this.names,
    );
    return folded.applied === 1 && !folded.endsInnings
      ? folded.state.snapshot
      : null;
  }

  /** `applyDelta` in useScoring: the reply's documents, else a re-read. */
  private async applyOrSync(delta: ScoringDelta | null | undefined) {
    const next = this.snap
      ? applyScoringDelta(this.snap, delta, this.names)
      : null;
    if (!next || !delta) return this.sync();
    this.deltasApplied += 1;
    await this.verify?.(next);
    await this.loadSquads(next);
    this.base = baseWithDelta(this.base, next, delta);
    this.snap = next;
  }

  async open(isAdmin: () => Promise<unknown>): Promise<void> {
    await isAdmin(); // useMatchAdminQuery
    await this.sync();
  }

  current() {
    const s = this.snap!;
    return {
      strikerId: s.strikerId,
      nonStrikerId: s.nonStrikerId,
      bowlerId: s.bowlerId,
      thisOver: s.thisOverDeliveries,
    };
  }

  /** handleScore -> applyState: getMatch at the result, else the delta. */
  async afterBall(res: {
    data: ScoringState | null;
    delta?: ScoringDelta | null;
  }): Promise<void> {
    if (res.data?.match_completed) {
      await this.q.getMatch(this.matchId);
      return;
    }
    await this.applyOrSync(res.delta);
  }

  /** handleUndo / handleUpdateBall: one re-read. */
  async afterUndo(): Promise<void> {
    await this.sync();
  }

  async afterUpdateBall(): Promise<void> {
    await this.sync();
  }

  async afterSetBatsmen(res: { delta?: ScoringDelta | null }): Promise<void> {
    await this.applyOrSync(res.delta);
  }

  async afterSetBowler(res: { delta?: ScoringDelta | null }): Promise<void> {
    await this.applyOrSync(res.delta);
  }

  /** The page syncs after a retirement. */
  async afterRetire(): Promise<void> {
    await this.sync();
  }

  async afterStructural(): Promise<void> {
    await this.sync();
  }

  /** Adopt a snapshot built elsewhere (the co-scorer's live resync). */
  async adopt(snap: Snapshot): Promise<void> {
    this.deltasApplied += 1;
    await this.verify?.(snap);
    await this.loadSquads(snap);
    this.snap = snap;
    this.base = null;
  }
}

/**
 * The second scorer (`useLiveResync` + `syncFromLive` in useScoring): on
 * each live_state change by the other scorer it reads the documents the
 * change wrote and applies them, or re-reads its whole state when they are
 * not enough. `journal` is what its listener has seen.
 */
class CoScorerModel {
  readonly screen: ScorerModel;
  private readonly journal = new Map<number, LiveJournalEntry>();
  private synced: number | null = null;
  fullSyncs = 0;

  constructor(
    matchId: string,
    q: Queries,
    private readonly ds: MemoryDataSource,
  ) {
    this.screen = new ScorerModel(matchId, q);
  }

  /** The listener delivered `doc` (version `doc.version`). */
  observe(doc: LiveStateDoc): void {
    this.journal.set(
      doc.version,
      liveJournalEntry(doc as unknown as Record<string, unknown>),
    );
  }

  async open(version: number | null): Promise<void> {
    await this.screen.sync();
    this.synced = version;
  }

  /** A change by the other scorer, up to live_state `version`. */
  async follow(version: number): Promise<void> {
    const prev = this.screen.snap;
    const changes =
      prev && this.synced !== null
        ? liveChangesOf(this.journal, this.synced, version)
        : null;
    const reads = changes && prev ? liveResyncReads(prev, changes) : null;
    let next: Snapshot | null = null;
    if (reads && prev) {
      const innings = (await this.ds.getByIds(
        "innings",
        reads.innings,
      )) as unknown as Array<InningsRow & { id: string }>;
      const overs = await this.ds.getByIds("overs", reads.overs);
      const byId = new Map(overs.map((o) => [o.id, o]));
      next =
        innings.length === reads.innings.length
          ? applyLiveResync(
              prev,
              innings,
              reads.overs.map(
                (id) =>
                  [id, (byId.get(id) as unknown as OversRow) ?? null] as const,
              ),
              this.screen.squadNames,
            )
          : null;
    }
    if (next) await this.screen.adopt(next);
    else {
      this.fullSyncs += 1;
      await this.screen.sync();
    }
    this.synced = version;
  }
}

describe("Firestore cost of a whole match", () => {
  it("scores a T20 end to end and bounds the per-match totals", async () => {
    const ds = new MemoryDataSource(structuredClone(seed));
    const meter = new Meter(ds);
    const admin = seed.users!.find((u) => u.id === ADMIN)!;
    const signIn = (user: Doc | null) => {
      state.client = serverClientFor({
        ds,
        db: null,
        getUser: async () =>
          user
            ? ({
                id: user.id,
                email: null,
                phone: null,
                user_metadata: { full_name: user.full_name },
              } as unknown as AppUser)
            : null,
      });
    };

    const queries = await import("~/app/matches/queries");
    const m = await import("~/app/matches/mutations");
    const { isMatchAdmin } = await import("./rpc/auth-helpers");

    signIn(admin);
    const [created, createCost] = await meter.run(() =>
      m.createMatch({
        title: "",
        matchFormat: "T20",
        oversPerInnings: 20,
        team1Id: TEAM1,
        team2Id: TEAM2,
        tournamentId: TOURNAMENT,
        clubId: CLUB,
      }),
    );
    expect(created.error).toBeNull();
    const matchId = created.data!.id as string;

    // ---- clients -------------------------------------------------------
    const liveDoc = async () =>
      (await ds.getById("live_state", matchId)) as unknown as LiveStateDoc | null;
    // Peeks below are not billed.
    const peek = async <T,>(fn: () => Promise<T>): Promise<T> => {
      const before = { r: { ...ds.readsByTable }, b: ds.billedReads };
      const out = await fn();
      ds.readsByTable = before.r;
      ds.billedReads = before.b;
      return out;
    };
    let lastLive: LiveStateDoc | null = null;
    /** The scoring screen (`useScoring`): what it holds and refetches. */
    const scorer = new ScorerModel(matchId, queries);
    const verify = async (snap: Snapshot) => {
      const fresh = await peek(() => queries.getScoringState(matchId));
      expect(snap).toEqual(fresh.data);
    };
    scorer.verify = verify;
    /** A second scorer following the first one's actions. */
    const coScorer = new CoScorerModel(matchId, queries, ds);
    coScorer.screen.verify = verify;

    /**
     * Runs a scorer action: the server action, then what the scoring screen
     * does with its result, then the listeners of every party.
     */
    async function act<R>(
      kind: string | ((result: R) => string),
      action: () => Promise<R>,
      refetch: (result: R) => Promise<unknown>,
    ): Promise<R> {
      const [result, server] = await meter.run(action);
      const r = row(typeof kind === "string" ? kind : kind(result));
      r.n += 1;
      add(r.serverReads, server.reads);
      add(r.serverWrites, server.writes);
      const [, client] = await meter.run(() => refetch(result));
      add(r.scorerRefetchReads, client.reads);
      expect(sum(client.writes)).toBe(0);

      // Listeners: one billed read per changed document.
      const liveWrites = server.writes.live_state ?? 0;
      const cardWrites = server.writes.live_scorecard ?? 0;
      r.scorerListenReads += liveWrites;
      r.overlayReads += liveWrites;
      const live = await peek(liveDoc);
      if (liveWrites && live) {
        coScorer.observe(live);
        const [, resync] = await meter.run(() => coScorer.follow(live.version));
        r.coScorerReads += liveWrites + sum(resync.reads);
      }
      let viewer = liveWrites + cardWrites;
      let balls = liveWrites;
      if (liveWrites && live) {
        balls += (live.overs_changed ?? []).length;
        const structural =
          !lastLive ||
          live.status !== lastLive.status ||
          live.innings_number !== lastLive.innings_number ||
          live.match_rev !== lastLive.match_rev;
        if (structural) {
          const [, refetchCost] = await meter.run(() =>
            queries.getMatch(matchId, { skipCache: true }),
          );
          viewer += sum(refetchCost.reads);
        }
        lastLive = live;
      }
      r.viewerReads += viewer;
      r.viewerBallsReads += balls;
      return result;
    }

    // ---- page loads ----------------------------------------------------
    const loads: Record<string, number> = {};
    const [, scoringOpen] = await meter.run(() =>
      scorer.open(() => isMatchAdmin(ds, matchId, ADMIN)),
    );
    loads.scoringScreenOpen = sum(scoringOpen.reads) + 1; // + live_state listener
    await peek(async () => {
      const live = await liveDoc();
      if (live) coScorer.observe(live);
      await coScorer.open(live?.version ?? null);
    });

    // ---- toss ----------------------------------------------------------
    await act(
      "startMatch",
      () => m.startMatch(matchId, TEAM1, "bat"),
      () => scorer.afterStructural(),
    );

    const rosterOf = (teamId: string) =>
      (seed.team_players ?? [])
        .filter((tp) => tp.team_id === teamId)
        .map((tp) => tp.user_id as string);

    /** The scorer's prediction of an action equals the server's result. */
    const comparable = (snap: Snapshot) =>
      JSON.parse(
        JSON.stringify(snap, (key, value) =>
          key === "updated_at" || key === "created_at" ? undefined : value,
        ),
        (key, value) =>
          key === "id" && typeof value === "string" && value.includes("~")
            ? value.slice(0, value.indexOf("~"))
            : value,
      );
    let actionSeq = 0;
    const queued = (
      type: QueuedAction["type"],
      payload: QueuedAction["payload"],
    ) =>
      ({
        queueId: `p${(actionSeq += 1)}`,
        matchId,
        type,
        payload,
        enqueuedAt: 0,
        instant: true,
      }) as QueuedAction;
    function expectPredicted(predicted: Snapshot | null) {
      if (!predicted) return;
      scorer.predictions += 1;
      expect(comparable(predicted)).toEqual(comparable(scorer.snap!));
    }

    async function setBatsmen(s: string, ns: string) {
      const predicted = scorer.predict(
        queued("setBatsmen", { strikerId: s, nonStrikerId: ns }),
      );
      await act(
        "setBatsmen",
        () => m.setCurrentBatsmen(matchId, s, ns),
        (res) => scorer.afterSetBatsmen(res),
      );
      expectPredicted(predicted);
    }
    async function setBowler(b: string) {
      const predicted = scorer.predict(queued("setBowler", { bowlerId: b }));
      await act(
        "setBowler",
        () => m.setCurrentBowler(matchId, b),
        (res) => scorer.afterSetBowler(res),
      );
      expectPredicted(predicted);
    }

    type Ev = Parameters<typeof m.recordBall>[0]["event"];
    let ballsScored = 0;
    let st: ScoringState | null = null;
    async function ball(event: Ev) {
      const cur = scorer.current();
      const predicted = scorer.predict(
        queued("recordBall", {
          matchId,
          bowlerId: cur.bowlerId!,
          batsmanId: cur.strikerId!,
          nonStrikerId: cur.nonStrikerId!,
          event,
        }),
      );
      const res = await act(
        (r: { data: ScoringState | null }) =>
          r.data?.match_completed
            ? "ball: ends match"
            : r.data?.innings_break
              ? "ball: ends innings"
              : ballKind(event),
        () =>
          m.recordBall({
            matchId,
            bowlerId: cur.bowlerId!,
            batsmanId: cur.strikerId!,
            nonStrikerId: cur.nonStrikerId!,
            event,
            clientActionId: `a${ballsScored}`,
          }),
        (r) => scorer.afterBall(r),
      );
      expect(res.error).toBeNull();
      // A delivery that ends the innings or the match waits for the server.
      if (!res.data?.innings_break && !res.data?.match_completed) {
        expectPredicted(predicted);
      }
      ballsScored += 1;
      st = res.data;
      return res.data!;
    }
    function ballKind(e: Ev): string {
      if (e.isWicket) return "ball: wicket";
      if (e.extraType) return `ball: ${e.extraType}`;
      return "ball: runs";
    }

    async function playInnings(
      battingTeam: string,
      bowlingTeam: string,
      pattern: Ev[],
      extras: { retireAt?: number; undoAt?: number; editAt?: number },
    ) {
      const batters = rosterOf(battingTeam);
      const bowlers = rosterOf(bowlingTeam).slice(0, 5);
      let nextBatter = 2;
      await setBatsmen(batters[0]!, batters[1]!);
      let over = 0;
      await setBowler(bowlers[0]!);
      let i = 0;
      for (;;) {
        const event = pattern[i % pattern.length]!;
        i += 1;
        const s = await ball(event);
        if (s.match_completed || s.innings_break) return;
        if (i === extras.undoAt) {
          await act(
            "undo",
            () => m.undoLastBall(matchId),
            () => scorer.afterUndo(),
          );
          await ball({ runsScored: 1 });
        }
        if (i === extras.editAt) {
          const last = scorer.current().thisOver.at(-1)!;
          await act(
            "updateBall",
            () =>
              m.updateBall({
                matchId,
                ballId: last.id,
                runsScored: 2,
                extras: 0,
                extraType: null,
                isWicket: false,
                dismissalType: null,
              }),
            () => scorer.afterUpdateBall(),
          );
        }
        let cur = scorer.current();
        let stayed: string | null = null;
        if (i === extras.retireAt && cur.nonStrikerId) {
          stayed = cur.strikerId;
          await act(
            "retire",
            () =>
              m.retirePlayer(matchId, {
                playerId: cur.nonStrikerId!,
                type: "retired_hurt",
              }),
            () => scorer.afterRetire(),
          );
        }
        cur = scorer.current();
        if (!cur.strikerId || !cur.nonStrikerId) {
          // A retirement leaves the crease empty: the other batter returns.
          const survivor = cur.strikerId ?? cur.nonStrikerId ?? stayed!;
          await setBatsmen(batters[nextBatter]!, survivor);
          nextBatter += 1;
        }
        cur = scorer.current();
        if (!cur.bowlerId) {
          over += 1;
          await setBowler(bowlers[over % bowlers.length]!);
        }
      }
    }

    const dot: Ev = { runsScored: 0 };
    const one: Ev = { runsScored: 1 };
    const two: Ev = { runsScored: 2 };
    const four: Ev = { runsScored: 4 };
    const six: Ev = { runsScored: 6 };
    const wide: Ev = { runsScored: 0, extras: 1, extraType: "wide" };
    const noBall: Ev = { runsScored: 1, extras: 1, extraType: "no_ball" };
    const bye: Ev = { runsScored: 0, extras: 1, extraType: "bye" };
    const legBye: Ev = { runsScored: 0, extras: 1, extraType: "leg_bye" };
    const bowled: Ev = {
      runsScored: 0,
      isWicket: true,
      dismissalType: "bowled",
    };
    // 1st innings: ~7 runs an over, a wicket every 19 balls.
    const first: Ev[] = [
      one, dot, four, one, dot, two, wide, one, dot, six, one, legBye,
      dot, one, two, noBall, dot, bye, bowled,
    ];
    // 2nd innings: scores faster, so the chase ends before 20 overs.
    const second: Ev[] = [
      four, one, dot, two, wide, one, dot, one, six, dot, one, noBall,
      two, dot, legBye, one, four, dot, one, bye, two, bowled,
    ];

    await playInnings(TEAM1, TEAM2, first, {
      retireAt: 40,
      undoAt: 25,
      editAt: 31,
    });
    expect(st!.innings_break).toBe(true);
    const firstInningsBalls = ballsScored;
    await playInnings(TEAM2, TEAM1, second, {});
    expect(st!.match_completed).toBe(true);
    expect(ballsScored).toBeGreaterThan(200);

    // ---- page loads after the match -----------------------------------
    signIn(null);
    const [, matchPage] = await meter.run(async () => {
      await queries.getMatch(matchId, { skipCache: true });
      await queries.getLiveMatchState(matchId, { skipCache: true });
    });
    loads.matchPageCompleted = sum(matchPage.reads) + 2; // + 2 listeners
    const [, ballLog] = await meter.run(() => queries.getMatchBallLog(matchId));
    loads.ballLog = sum(ballLog.reads);
    const [, dashboard] = await meter.run(async () => {
      await queries.getMatches({ status: "live" });
      await queries.getMatches({ status: "completed", limit: 6 });
    });
    loads.dashboard = sum(dashboard.reads);

    // ---- report --------------------------------------------------------
    const table: Record<string, Record<string, number | string>> = {};
    const totals = {
      serverReads: 0,
      serverWrites: 0,
      scorerReads: 0,
      viewerReads: 0,
      viewerBallsReads: 0,
      overlayReads: 0,
      coScorerReads: 0,
    };
    const fmt = (c: Counts) =>
      Object.entries(c)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
    for (const [kind, r] of [...rows.entries()].sort()) {
      const sr = sum(r.serverReads);
      const sw = sum(r.serverWrites);
      const cr = sum(r.scorerRefetchReads);
      totals.serverReads += sr;
      totals.serverWrites += sw;
      totals.scorerReads += sr + cr + r.scorerListenReads;
      totals.viewerReads += r.viewerReads;
      totals.viewerBallsReads += r.viewerBallsReads;
      totals.overlayReads += r.overlayReads;
      totals.coScorerReads += r.coScorerReads;
      const per = (x: number) => +(x / r.n).toFixed(2);
      table[kind] = {
        n: r.n,
        "server R/act": per(sr),
        "server W/act": per(sw),
        "scorer refetch R/act": per(cr),
        "scorer listen R/act": per(r.scorerListenReads),
        "viewer R/act": per(r.viewerReads),
        "overlay R/act": per(r.overlayReads),
        "co-scorer R/act": per(r.coScorerReads),
        "server reads": fmt(r.serverReads),
        "server writes": fmt(r.serverWrites),
        "refetch reads": fmt(r.scorerRefetchReads),
      };
    }
    console.info(
      `match cost profile: ${ballsScored} deliveries (${firstInningsBalls} in the 1st innings)`,
    );
    console.table(table);
    const perMatch = {
      createMatch: { reads: sum(createCost.reads), writes: sum(createCost.writes) },
      ...totals,
      // Server reads + writes are part of the scorer's own requests.
      scorerTotalReads: totals.scorerReads,
      deliveries: ballsScored,
      loads,
    };
    console.info("match cost totals", perMatch);

    // ---- bounds (regressions fail here) --------------------------------
    const normal = rows.get("ball: runs")!;
    const perBall = (r: Row) => ({
      server: sum(r.serverReads) / r.n,
      writes: sum(r.serverWrites) / r.n,
      scorer:
        (sum(r.serverReads) + sum(r.scorerRefetchReads) + r.scorerListenReads) /
        r.n,
      viewer: r.viewerReads / r.n,
    });
    const nb = perBall(normal);
    console.info("per normal delivery", nb);
    expect(nb.writes).toBeLessThanOrEqual(BOUNDS.perBallWrites);
    expect(nb.scorer).toBeLessThanOrEqual(BOUNDS.perBallScorerReads);
    expect(nb.viewer).toBeLessThanOrEqual(BOUNDS.perBallViewerReads);
    expect(totals.serverWrites).toBeLessThanOrEqual(BOUNDS.matchWrites);
    expect(totals.scorerReads).toBeLessThanOrEqual(BOUNDS.matchScorerReads);
    expect(totals.viewerReads).toBeLessThanOrEqual(BOUNDS.matchViewerReads);
    expect(totals.overlayReads).toBeLessThanOrEqual(BOUNDS.matchOverlayReads);
    // Every delta-built state was checked, and most actions used one.
    expect(scorer.deltasApplied).toBeGreaterThan(290);
    // The co-scorer too: every remote change it applied from the documents
    // that change wrote was checked against a fresh getScoringState.
    console.info("co-scorer", {
      deltas: coScorer.screen.deltasApplied,
      fullSyncs: coScorer.fullSyncs,
    });
    expect(coScorer.screen.deltasApplied).toBeGreaterThan(290);
    // Instant scoring predicted (and matched) nearly every action: all but
    // those right after a full re-read whose over it had not seen, and the
    // innings' last balls.
    console.info("instant scoring predictions", scorer.predictions);
    expect(scorer.predictions).toBeGreaterThan(280);
    expect(totals.coScorerReads).toBeLessThanOrEqual(BOUNDS.matchCoScorerReads);
  }, 120_000);
});

/**
 * Upper bounds for the scripted match (254 deliveries; see the printed
 * table). Before the scoring screen updated from the committed documents
 * it read 12.4 a ball and 4,241 a match (getScoringState after every ball
 * and crease / bowler change, twice after an undo or edit). Before the
 * match document stopped following every ball: 5 writes a delivery, 1,538
 * a match, the scorer 2,225 reads, a co-scorer 2,305 (a full re-read of
 * its state per change, 7.4 reads) and the first innings' end 58 reads
 * (its whole ball log, to carry penalty runs).
 */
const BOUNDS = {
  /** innings, over, live_state, live_scorecard (the match is not written). */
  perBallWrites: 4,
  /** The 5 the ball reads + the screen's live_state listener. */
  perBallScorerReads: 6,
  /** live_state + live_scorecard listeners (Summary tab). */
  perBallViewerReads: 2,
  matchWrites: 1_290,
  matchScorerReads: 2_170,
  matchViewerReads: 640,
  matchOverlayReads: 315,
  /** live_state listener + the innings and over a remote ball wrote. */
  matchCoScorerReads: 910,
};
