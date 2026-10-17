import { beforeEach, describe, expect, it } from "vitest";
import { resolveScorerAccess } from "./scorer-access";
import { forgetScorer, rememberScorer, wasScorer } from "~/lib/offline-match-cache";

const base = {
  hasUser: true,
  authLoading: false,
  isAdmin: undefined as boolean | undefined,
  adminCheckLoading: false,
  rememberedScorer: false,
  offline: false,
};

describe("resolveScorerAccess", () => {
  it("follows the server check when it has answered online", () => {
    expect(resolveScorerAccess({ ...base, isAdmin: true })).toBe(true);
    expect(resolveScorerAccess({ ...base, isAdmin: false })).toBe(false);
    expect(
      resolveScorerAccess({ ...base, isAdmin: false, rememberedScorer: true }),
    ).toBe(false);
  });

  it("waits while auth or the check is loading", () => {
    expect(resolveScorerAccess({ ...base, hasUser: false, authLoading: true })).toBeNull();
    expect(resolveScorerAccess({ ...base, adminCheckLoading: true })).toBeNull();
    expect(resolveScorerAccess({ ...base, hasUser: false })).toBe(false);
  });

  it("keeps a remembered scorer scoring offline", () => {
    expect(
      resolveScorerAccess({ ...base, offline: true, rememberedScorer: true }),
    ).toBe(true);
    // The check may have failed with "false" for lack of network.
    expect(
      resolveScorerAccess({ ...base, offline: true, rememberedScorer: true, isAdmin: false }),
    ).toBe(true);
    // Unknown device: no access offline.
    expect(resolveScorerAccess({ ...base, offline: true })).toBe(false);
  });
});

describe("remembered scorer", () => {
  beforeEach(() => localStorage.clear());

  it("is per match and per user", () => {
    rememberScorer("m1", "u1");
    expect(wasScorer("m1", "u1")).toBe(true);
    expect(wasScorer("m1", "u2")).toBe(false);
    expect(wasScorer("m2", "u1")).toBe(false);
    expect(wasScorer("m1", null)).toBe(false);
    forgetScorer("m1");
    expect(wasScorer("m1", "u1")).toBe(false);
  });
});
