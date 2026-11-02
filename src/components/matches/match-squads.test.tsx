import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeMatch } from "~/test/factories";
import { MatchSquads } from "./match-squads";

describe("MatchSquads", () => {
  it("lists both sides' players, in batting order", () => {
    render(
      <MatchSquads
        match={makeMatch({
          team1: {
            id: "t1",
            name: "Royal Tigers",
            team_players: [
              {
                id: "p2",
                team_id: "t1",
                user_id: "u2",
                batting_order: 2,
                role_in_team: "bowler",
                user: { id: "u2", full_name: "Jasprit Bumrah" },
              },
              {
                id: "p1",
                team_id: "t1",
                user_id: "u1",
                batting_order: 1,
                role_in_team: "batsman",
                user: { id: "u1", full_name: "Virat Kohli" },
              },
            ],
          },
        })}
      />,
    );
    const tigers = screen.getByRole("region", { name: "Royal Tigers squad" });
    expect(tigers.textContent?.indexOf("Virat Kohli")).toBeLessThan(
      tigers.textContent?.indexOf("Jasprit Bumrah") ?? 0,
    );
    expect(screen.getByText("Squad not announced yet")).toBeInTheDocument();
  });
});
