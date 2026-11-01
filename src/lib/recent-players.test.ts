import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRecentPlayers,
  recentPlayers,
  rememberPlayer,
} from "./recent-players";

const rahul = { id: "r", name: "Rahul" };
const amit = { id: "a", name: "Amit", username: "amit" };

describe("recent players", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the latest first, each once", () => {
    rememberPlayer(rahul);
    rememberPlayer(amit);
    rememberPlayer(rahul);
    expect(recentPlayers().map((p) => p.id)).toEqual(["r", "a"]);
  });

  it("stops at a dozen", () => {
    for (let i = 0; i < 20; i += 1) rememberPlayer({ id: `p${i}`, name: "P" });
    expect(recentPlayers()).toHaveLength(12);
    expect(recentPlayers()[0]?.id).toBe("p19");
  });

  it("clears on sign-out", () => {
    rememberPlayer(rahul);
    clearRecentPlayers();
    expect(recentPlayers()).toEqual([]);
  });

  it("ignores broken or foreign data", () => {
    localStorage.setItem("cric-recent-players", "not json");
    expect(recentPlayers()).toEqual([]);
    localStorage.setItem("cric-recent-players", '[{"id":1},{"id":"a","name":"A"}]');
    expect(recentPlayers().map((p) => p.id)).toEqual(["a"]);
  });

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(recentPlayers()).toEqual([]);
    expect(() => rememberPlayer(rahul)).not.toThrow();
  });
});
