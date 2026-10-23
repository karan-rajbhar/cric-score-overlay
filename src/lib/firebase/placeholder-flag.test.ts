import { describe, expect, it } from "vitest";
import { planPlaceholderFlags } from "../../../scripts/lib/placeholder-flag.mjs";

describe("planPlaceholderFlags", () => {
  const usersPrivate = [
    { id: "old", email: "player.ravi.1a2b3c4d@players.local" },
    { id: "real", email: "asha@gmail.com" },
    { id: "flagged", email: "player.kiran.9f8e7d6c@players.local" },
    { id: "claimed", email: "x@players.local" },
  ];

  it("flags only unflagged profiles with a placeholder address", () => {
    const users = [
      { id: "old" },
      { id: "real" },
      { id: "flagged", is_placeholder: true },
      { id: "claimed", is_placeholder: false },
      { id: "no-private" },
    ];
    expect(planPlaceholderFlags({ users, usersPrivate })).toEqual({
      updates: ["old"],
    });
  });

  it("plans nothing once applied", () => {
    const users = [{ id: "old", is_placeholder: true }, { id: "real" }];
    expect(planPlaceholderFlags({ users, usersPrivate }).updates).toEqual([]);
  });
});
