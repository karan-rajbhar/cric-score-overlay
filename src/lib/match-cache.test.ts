import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedMatch,
  setCachedMatch,
  getPendingQuery,
  setPendingQuery,
  clearPendingQuery,
  getCachedLiveState,
  setCachedLiveState,
  getPendingLiveQuery,
  setPendingLiveQuery,
  clearPendingLiveQuery,
  invalidateMatchCache,
} from "./match-cache";

describe("match-cache micro-cache and deduplicator", () => {
  beforeEach(() => {
    invalidateMatchCache();
  });

  it("stores and retrieves cached match data within TTL", () => {
    const matchId = "11111111-1111-1111-1111-111111111111";
    const data = { id: matchId, title: "Finals" };

    expect(getCachedMatch(matchId)).toBeNull();
    setCachedMatch(matchId, data);
    expect(getCachedMatch(matchId)).toEqual(data);
  });

  it("stores and retrieves live match state separately", () => {
    const matchId = "11111111-1111-1111-1111-111111111111";
    const liveData = { match_id: matchId, current_score: "140/3" };

    expect(getCachedLiveState(matchId)).toBeNull();
    setCachedLiveState(matchId, liveData);
    expect(getCachedLiveState(matchId)).toEqual(liveData);
  });

  it("invalidates specific match cache and live state on mutation", () => {
    const match1 = "11111111-1111-1111-1111-111111111111";
    const match2 = "22222222-2222-2222-2222-222222222222";

    setCachedMatch(match1, { title: "Match 1" });
    setCachedLiveState(match1, { current_score: "50/0" });
    setCachedMatch(match2, { title: "Match 2" });
    setCachedLiveState(match2, { current_score: "80/1" });

    invalidateMatchCache(match1);

    expect(getCachedMatch(match1)).toBeNull();
    expect(getCachedLiveState(match1)).toBeNull();
    expect(getCachedMatch(match2)).toEqual({ title: "Match 2" });
    expect(getCachedLiveState(match2)).toEqual({ current_score: "80/1" });
  });

  it("invalidates all matches when no id provided", () => {
    const match1 = "11111111-1111-1111-1111-111111111111";
    const match2 = "22222222-2222-2222-2222-222222222222";

    setCachedMatch(match1, { title: "Match 1" });
    setCachedMatch(match2, { title: "Match 2" });

    invalidateMatchCache();

    expect(getCachedMatch(match1)).toBeNull();
    expect(getCachedMatch(match2)).toBeNull();
  });

  it("manages pending queries for promise deduplication", () => {
    const matchId = "11111111-1111-1111-1111-111111111111";
    const promise = Promise.resolve({
      data: { title: "Deduplicated" },
      error: null,
    });

    expect(getPendingQuery(matchId)).toBeNull();
    setPendingQuery(matchId, promise);
    expect(getPendingQuery(matchId)).toBe(promise);

    clearPendingQuery(matchId);
    expect(getPendingQuery(matchId)).toBeNull();
  });

  it("manages pending live queries for promise deduplication", () => {
    const matchId = "11111111-1111-1111-1111-111111111111";
    const promise = Promise.resolve({
      data: { current_score: "120/2" },
      error: null,
    });

    expect(getPendingLiveQuery(matchId)).toBeNull();
    setPendingLiveQuery(matchId, promise);
    expect(getPendingLiveQuery(matchId)).toBe(promise);

    clearPendingLiveQuery(matchId);
    expect(getPendingLiveQuery(matchId)).toBeNull();
  });
});
