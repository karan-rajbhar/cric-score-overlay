import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETUP,
  formatForOvers,
  loadSetup,
  matchesTeamQuery,
  saveSetup,
  SETUP_STORAGE_KEY,
  setupBlocker,
  sortByRecent,
  type SetupValues,
} from "./match-setup";

const valid: SetupValues = {
  team1Id: "a",
  team2Id: "b",
  oversPerInnings: 20,
  wicketsPerInnings: 10,
  ballsPerOver: 6,
  when: "now",
  scheduledAt: "",
};
const both = new Set(["a", "b"]);

describe("formatForOvers", () => {
  it("maps preset overs to their format and anything else to Custom", () => {
    expect(formatForOvers(20)).toBe("T20");
    expect(formatForOvers(10)).toBe("T10");
    expect(formatForOvers(50)).toBe("ODI");
    expect(formatForOvers(16)).toBe("Custom");
  });
});

describe("setupBlocker", () => {
  it("is null for a complete setup", () => {
    expect(setupBlocker(valid, both, both)).toBeNull();
  });

  it("names the first missing step in plain words", () => {
    expect(setupBlocker({ ...valid, team1Id: "" }, both, both)).toBe(
      "Choose your team",
    );
    expect(setupBlocker({ ...valid, team2Id: "" }, both, both)).toBe(
      "Choose the opponent",
    );
    expect(setupBlocker({ ...valid, team2Id: "a" }, both, both)).toBe(
      "Pick two different teams",
    );
    expect(setupBlocker({ ...valid, oversPerInnings: 0 }, both, both)).toBe(
      "Overs must be between 1 and 50",
    );
    expect(setupBlocker({ ...valid, ballsPerOver: 1 }, both, both)).toBe(
      "Balls per over must be between 2 and 12",
    );
    expect(setupBlocker({ ...valid, when: "later" }, both, both)).toBe(
      "Pick a date and time",
    );
    expect(setupBlocker(valid, both, new Set(["a"]))).toMatch(/opponent/);
  });
});

describe("team search and order", () => {
  const teams = [
    { id: "1", name: "Zebras" },
    { id: "2", name: "Ants", short_name: "ANT" },
    { id: "3", name: "Mumbaí Lions", short_name: "MUL" },
  ];

  it("puts recent teams first, then the rest by name", () => {
    expect(sortByRecent(teams, ["3"]).map((t) => t.id)).toEqual([
      "3",
      "2",
      "1",
    ]);
  });

  it("matches name or short name, ignoring case and accents", () => {
    expect(matchesTeamQuery(teams[2]!, "mumbai")).toBe(true);
    expect(matchesTeamQuery(teams[2]!, "mul")).toBe(true);
    expect(matchesTeamQuery(teams[1]!, "zeb")).toBe(false);
    expect(matchesTeamQuery(teams[1]!, "  ")).toBe(true);
  });
});

describe("last-used setup", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the setup and keeps recent teams newest first", () => {
    const rules = { ...DEFAULT_SETUP, matchFormat: "T10" as const, oversPerInnings: 10 };
    saveSetup(rules, "a", "b");
    saveSetup(rules, "c", "a");
    const loaded = loadSetup();
    expect(loaded).toMatchObject({
      matchFormat: "T10",
      oversPerInnings: 10,
      lastTeam1Id: "c",
      recentTeamIds: ["c", "a", "b"],
    });
  });

  it("falls back to defaults on bad data or blocked storage", () => {
    window.localStorage.setItem(SETUP_STORAGE_KEY, "{not json");
    expect(loadSetup()).toEqual(DEFAULT_SETUP);

    window.localStorage.setItem(
      SETUP_STORAGE_KEY,
      JSON.stringify({ matchFormat: "Test", oversPerInnings: 500 }),
    );
    expect(loadSetup()).toMatchObject({
      matchFormat: "T20",
      oversPerInnings: 20,
    });

    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(loadSetup()).toEqual(DEFAULT_SETUP);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveSetup(DEFAULT_SETUP, "a", "b")).not.toThrow();
    spy.mockRestore();
  });
});
