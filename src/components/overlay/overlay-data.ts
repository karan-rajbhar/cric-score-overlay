"use client";

/**
 * Data the overlay's cards read when the producer shows them, never per
 * ball: the overlay itself stays on the single `live_state` listener.
 *
 * - {@link useDocWhenShown}: one read of a document when a card appears;
 *   showing it again reuses that read unless the score moved since.
 * - {@link useScorecardInnings}: every innings' card from
 *   `live_scorecard/{matchId}` (1 read per showing with a new score).
 * - {@link usePlayerProfile}: career figures and photo (2 reads per player
 *   per innings, cached).
 * - {@link useInningsBallLog}: the ball log for charts and the wagon wheel
 *   (an innings' `overs` documents, 1 read each, when a chart shows and the
 *   innings has moved since the last read; a finished innings is read once).
 *
 * Demo matches (id "test") read nothing: cards use the page's match.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "~/lib/firebase/client";
import {
  LIVE_SCORECARD_COLLECTION,
  type LiveScorecardDoc,
} from "~/lib/firebase/live-scorecard";
import { readDoc } from "~/lib/firebase/realtime";
import {
  ballRowsOf,
  bySeq,
  OVERS_COLLECTION,
  type OversRow,
} from "~/lib/firebase/scorecard";
import type { PlayerCareerStatsRow, UsersRow } from "~/lib/firebase/types";
import { liveScorecardViewOf } from "~/lib/hooks/useLiveState";
import type { BallEvent, Innings, Match } from "~/lib/match-types";
import type { LiveMatchState } from "./types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A real match id (the overlay's demo uses "test"). */
export function isLiveMatchId(id: string | null | undefined): id is string {
  return !!id && UUID.test(id);
}

/** Changes whenever the score does: a card shown again re-reads only then. */
export function scoreFreshness(state: LiveMatchState): string {
  return [
    state.innings_number,
    state.total_runs,
    state.total_wickets,
    state.total_balls,
    state.last_ball_seq,
    state.status,
  ].join(":");
}

interface CacheEntry {
  freshness: string;
  data: unknown;
}

const docCache = new Map<string, CacheEntry>();

/** Forget cached reads (tests). */
export function clearOverlayDocCache(): void {
  docCache.clear();
}

/**
 * One read of `table/id` when `active` turns on. While the card stays up
 * the result is kept; a later showing reads again only when `freshness`
 * differs from the cached read's.
 */
export function useDocWhenShown<T>(
  table: string,
  id: string | null | undefined,
  active: boolean,
  freshness = "",
): { data: T | null; loaded: boolean } {
  const key = id ? `${table}/${id}` : null;
  const cached = key ? docCache.get(key) : undefined;
  const [data, setData] = useState<T | null>(
    (cached?.data as T | undefined) ?? null,
  );
  const [loaded, setLoaded] = useState(!!cached);
  const freshnessRef = useRef(freshness);
  // Declared before the read below, so it runs first.
  useEffect(() => {
    freshnessRef.current = freshness;
  });

  useEffect(() => {
    if (!active || !key || !id) return;
    const hit = docCache.get(key);
    if (hit && hit.freshness === freshnessRef.current) {
      setData(hit.data as T | null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const wanted = freshnessRef.current;
    readDoc<T>(getFirebaseDb(), table, id)
      .then((doc) => {
        docCache.set(key, { freshness: wanted, data: doc });
        if (!cancelled) {
          setData(doc);
          setLoaded(true);
        }
      })
      .catch((err) => {
        console.error(`[overlay] could not read ${key}:`, err);
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active, key, id, table]);

  return { data, loaded };
}

/**
 * Every innings' scorecard (batting, bowling, fall of wickets and stands):
 * from `live_scorecard` for a real match, else the page's match.
 */
export function useScorecardInnings(
  state: LiveMatchState,
  match: Match | null | undefined,
  active: boolean,
): { innings: Innings[]; loaded: boolean } {
  const id = isLiveMatchId(state.match_id) ? state.match_id : null;
  const { data, loaded } = useDocWhenShown<LiveScorecardDoc>(
    LIVE_SCORECARD_COLLECTION,
    id,
    active,
    scoreFreshness(state),
  );
  const innings = useMemo(() => {
    if (data) {
      return liveScorecardViewOf(data).innings as unknown as Innings[];
    }
    return [...(match?.innings ?? [])];
  }, [data, match]);
  const sorted = useMemo(
    () => [...innings].sort((a, b) => a.innings_number - b.innings_number),
    [innings],
  );
  return { innings: sorted, loaded: id ? loaded : true };
}

export interface PlayerProfile {
  career: PlayerCareerStatsRow | null;
  avatarUrl: string | null;
}

/**
 * A player's career figures and photo, read when their card shows (a real
 * match only); cached for the innings.
 */
export function usePlayerProfile(
  state: LiveMatchState,
  userId: string | null | undefined,
  active: boolean,
): { profile: PlayerProfile; loaded: boolean } {
  const id = isLiveMatchId(state.match_id) && userId ? userId : null;
  const freshness = String(state.innings_number ?? "");
  const career = useDocWhenShown<PlayerCareerStatsRow>(
    "player_career_stats",
    id,
    active,
    freshness,
  );
  const user = useDocWhenShown<UsersRow>("users", id, active, freshness);
  return {
    profile: {
      career: career.data,
      avatarUrl: user.data?.avatar_url ?? null,
    },
    loaded: career.loaded && user.loaded,
  };
}

const ballsCache = new Map<string, { freshness: string; balls: BallEvent[] }>();

/** An innings' balls from its over documents (one read per over). */
async function readInningsBalls(innings: Innings): Promise<BallEvent[]> {
  const snap = await getDocs(
    query(
      collection(getFirebaseDb(), OVERS_COLLECTION),
      where("innings_id", "==", innings.id),
    ),
  );
  const rows = snap.docs.flatMap((d) =>
    ballRowsOf(d.data() as OversRow),
  );
  return rows.sort(bySeq).map(
    (b) =>
      ({
        ...b,
        runs_scored: b.runs_scored ?? 0,
        extras: b.extras ?? 0,
        is_wicket: b.is_wicket === true,
        innings: {
          innings_number: innings.innings_number,
          team_id: innings.team_id,
        },
      }) as unknown as BallEvent,
  );
}

const inningsFreshness = (i: Innings) =>
  `${i.total_runs}:${i.total_wickets}:${i.total_balls}:${i.is_completed}`;

/**
 * Each innings' balls (charts, wagon wheel) while `active`: demo innings
 * carry theirs; a real innings is read from its `overs` documents when it
 * has moved since the last read. Null while loading.
 */
export function useInningsBallLog(
  state: LiveMatchState,
  innings: Innings[],
  active: boolean,
): Map<string, BallEvent[]> | null {
  const live = isLiveMatchId(state.match_id);
  // Bumped when a read finishes, so the result below is recomputed.
  const [version, setVersion] = useState(0);
  const key = innings.map((i) => `${i.id}@${inningsFreshness(i)}`).join("|");

  useEffect(() => {
    if (!active || !live) return;
    const stale = innings.filter(
      (i) => ballsCache.get(i.id)?.freshness !== inningsFreshness(i),
    );
    if (!stale.length) return;
    let cancelled = false;
    Promise.all(
      stale.map(async (i) => {
        const balls = await readInningsBalls(i);
        ballsCache.set(i.id, { freshness: inningsFreshness(i), balls });
      }),
    )
      .catch((err) =>
        console.error("[overlay] could not read the ball log:", err),
      )
      .finally(() => {
        if (!cancelled) setVersion((v) => v + 1);
      });
    return () => {
      cancelled = true;
    };
    // `key` names the innings and their totals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, live, key]);

  return useMemo(() => {
    const out = new Map<string, BallEvent[]>();
    for (const i of innings) {
      if (i.ball_by_ball?.length) {
        out.set(i.id, i.ball_by_ball);
        continue;
      }
      if (!live) continue;
      const hit = ballsCache.get(i.id);
      // Not read yet (or moved since): wait for the read.
      if (!hit || hit.freshness !== inningsFreshness(i)) return null;
      out.set(i.id, hit.balls);
    }
    return out;
    // `version` marks a finished read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [innings, live, version]);
}
