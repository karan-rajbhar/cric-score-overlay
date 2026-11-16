import { describe, expect, it } from "vitest";
import { playerCard, teamCard } from "./share-cards";

describe("playerCard", () => {
  it("shows what the player has done, and says it in a sentence", () => {
    const card = playerCard(
      { full_name: "Sandeep sir", username: "sandeep_sir", playing_role: "batter", location: "Kamothe" },
      { total_matches: 22, total_runs: 312, highest_score: 64, total_wickets: 14, best_bowling_figures: "3/12" },
    );
    expect(card.initials).toBe("SS");
    expect(card.detail).toMatch(/^@sandeep_sir · .*Kamothe$/);
    expect(card.figures).toEqual([
      { value: "22", label: "Matches" },
      { value: "312", label: "Runs" },
      { value: "64", label: "Highest" },
      { value: "14", label: "Wickets" },
      { value: "3/12", label: "Best" },
    ]);
    expect(card.description).toBe(
      "Sandeep sir on CricScore: 312 runs and 14 wickets in 22 matches.",
    );
  });

  it("leaves out bowling a batter never did, and copes with no figures", () => {
    const batter = playerCard({ full_name: "Rahul" }, { total_matches: 1, total_runs: 4 });
    // No highest score stored: no tile for it.
    expect(batter.figures.map((f) => f.label)).toEqual(["Matches", "Runs"]);
    expect(batter.description).toBe("Rahul on CricScore: 4 runs in 1 match.");
    const fresh = playerCard({ full_name: "New Player" }, null);
    expect(fresh.description).toBe("New Player on CricScore: figures from every match they play.");
  });
});

describe("teamCard", () => {
  it("names the club, the squad and the captain", () => {
    const card = teamCard(
      {
        name: "Omkar 11",
        short_name: "OMK",
        captain_id: "c",
        primary_color: "#1d4ed8",
        roster: [
          { user_id: "c", role_in_team: "captain", user: { full_name: "Omkar" } },
          { user_id: "p", role_in_team: "player", user: { full_name: "Sanket" } },
        ],
      },
      "Unity Cricket Club",
    );
    expect(card).toMatchObject({
      initials: "OMK",
      color: "#1d4ed8",
      detail: "OMK · Unity Cricket Club · 2 players · Omkar (c)",
      description: "Omkar 11 on CricScore: a Unity Cricket Club team, 2 players.",
    });
  });

  it("is plain for a team with nothing more to say", () => {
    expect(teamCard({ name: "Lions" }, null).description).toBe("Lions on CricScore.");
  });
});
