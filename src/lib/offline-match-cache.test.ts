import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cacheMatchData,
  getCachedMatchData,
  clearMatchCache,
  hasMatchCache,
  clearScorerData,
  type CachedMatchData,
} from "./offline-match-cache";
import type { Match } from "./match-types";

describe("offline-match-cache", () => {
  const matchId = "match-cache-123";

  const mockMatch: Match = {
    id: matchId,
    title: "Final: Team A vs Team B",
    match_format: "T20",
    overs_per_innings: 20,
    status: "live",
    current_innings: 1,
    current_over: 3,
    current_ball: 2,
    team1_id: "team-a",
    team2_id: "team-b",
    team1: { id: "team-a", name: "Team A" },
    team2: { id: "team-b", name: "Team B" },
    innings: [],
  };

  const sampleData: Omit<CachedMatchData, "cachedAt"> = {
    match: mockMatch,
    battingTeamPlayers: [],
    bowlingTeamPlayers: [],
    strikerId: "p1",
    nonStrikerId: "p2",
    bowlerId: "b1",
    lastOverBowlerId: "b2",
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("caches and retrieves match data", () => {
    expect(hasMatchCache(matchId)).toBe(false);
    cacheMatchData(matchId, sampleData);
    expect(hasMatchCache(matchId)).toBe(true);

    const cached = getCachedMatchData(matchId);
    expect(cached).not.toBeNull();
    expect(cached?.match.id).toBe(matchId);
    expect(cached?.strikerId).toBe("p1");
    expect(cached?.nonStrikerId).toBe("p2");
    expect(cached?.cachedAt).toBeGreaterThan(0);
  });

  it("clears cached match data", () => {
    cacheMatchData(matchId, sampleData);
    expect(hasMatchCache(matchId)).toBe(true);

    clearMatchCache(matchId);
    expect(hasMatchCache(matchId)).toBe(false);
    expect(getCachedMatchData(matchId)).toBeNull();
  });

  it("returns null and clears expired cache (>24 hours)", () => {
    cacheMatchData(matchId, sampleData);
    const key = `cric_match_cache_${matchId}`;
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw!);
    // Age by 25 hours
    parsed.cachedAt = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(key, JSON.stringify(parsed));

    expect(getCachedMatchData(matchId)).toBeNull();
    expect(hasMatchCache(matchId)).toBe(false);
  });

  it("handles storage quota errors gracefully", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      const err = new DOMException("QuotaExceededError", "QuotaExceededError");
      throw err;
    });

    expect(() => cacheMatchData(matchId, sampleData)).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe("clearScorerData", () => {
  it("forgets scored matches on sign-out, except those with actions to send", () => {
    localStorage.clear();
    for (const id of ["m1", "m2"]) {
      localStorage.setItem(`cric_match_cache_${id}`, "{}");
      localStorage.setItem(`cric_confirmed_state_${id}`, "{}");
      localStorage.setItem(`cric_scorer_${id}`, "u1");
      localStorage.setItem(`cric_undo_history_${id}`, "[]");
    }
    localStorage.setItem("cric_pending_actions_m2", "[{}]");
    localStorage.setItem("theme", "dark");

    clearScorerData(new Set(["m2"]));

    expect(localStorage.getItem("cric_match_cache_m1")).toBeNull();
    expect(localStorage.getItem("cric_confirmed_state_m1")).toBeNull();
    expect(localStorage.getItem("cric_scorer_m1")).toBeNull();
    expect(localStorage.getItem("cric_undo_history_m1")).toBeNull();
    // m2 still has a queued action: what sending it needs stays.
    expect(localStorage.getItem("cric_confirmed_state_m2")).toBe("{}");
    expect(localStorage.getItem("cric_pending_actions_m2")).toBe("[{}]");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
