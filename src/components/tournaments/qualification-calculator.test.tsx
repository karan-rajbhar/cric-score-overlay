import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { remainingMatchesByTeam } from "~/lib/tournament-standings";
import { QualificationCalculator } from "./qualification-calculator";

/** An 8-team round robin after 4 rounds: 8, 6, 6, 4, 4, 2, 2, 0 points. */
const table = (remainingMatches: number) =>
  [8, 6, 6, 4, 4, 2, 2, 0].map((points, i) => ({
    teamId: `t${i + 1}`,
    teamName: `Team ${i + 1}`,
    matchesPlayed: 4,
    points,
    netRunRate: 0,
    remainingMatches,
  }));

const show = (teams: ReturnType<typeof table>) =>
  render(
    <QualificationCalculator
      open
      onOpenChange={() => {}}
      tournamentName="Summer league"
      teams={teams}
    />,
  );

describe("QualificationCalculator", () => {
  it("eliminates nobody while every team has 3 matches left", () => {
    show(table(3));
    expect(screen.queryByText(/Eliminated/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/3 games left · Most it can reach/)).toHaveLength(8);
  });

  it("eliminates the bottom five once no match is left", () => {
    show(table(0));
    expect(screen.getAllByText(/Eliminated/)).toHaveLength(5);
  });
});

describe("QualificationCalculator wording (T4)", () => {
  it("never tells a side with no games left that it needs a win", () => {
    const row = (teamId: string, points: number, remainingMatches: number) => ({
      teamId,
      teamName: teamId,
      matchesPlayed: 2,
      points,
      netRunRate: 0,
      remainingMatches,
    });
    show([row("Strikers", 4, 2), row("Thunder", 2, 0), row("Warriors", 2, 1), row("Titans", 0, 1)]);
    const thunder = screen.getByText("Thunder").closest("div.rounded-lg")!;
    expect(thunder).toHaveTextContent(/no games left and level on points/i);
    expect(thunder).not.toHaveTextContent(/needs \d+ win/i);
    const titans = screen.getByText("Titans").closest("div.rounded-lg")!;
    expect(titans).toHaveTextContent("Needs 1 win from 1 game");
    expect(
      screen.getByRole("heading", { name: "Qualification calculator" }),
    ).toBeInTheDocument();
  });
});

describe("remainingMatchesByTeam", () => {
  it("counts each team's scheduled and live matches", () => {
    const remaining = remainingMatchesByTeam([
      { team1_id: "a", team2_id: "b", status: "completed" },
      { team1_id: "a", team2_id: "c", status: "live" },
      { team1_id: "b", team2_id: "a", status: "scheduled" },
      { team1_id: "b", team2_id: "c", status: "abandoned" },
    ]);
    expect(remaining.get("a")).toBe(2);
    expect(remaining.get("b")).toBe(1);
    expect(remaining.get("c")).toBe(1);
    expect(remaining.get("d")).toBeUndefined();
  });
});
