import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerMilestones } from "./player-milestones";

const match = { id: "m1", title: "Strikers vs Warriors" };

describe("PlayerMilestones", () => {
  it("renders nothing without completed innings", () => {
    const { container } = render(<PlayerMilestones batting={[]} bowling={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows counts, best figures and recent milestones linked to matches", () => {
    render(
      <PlayerMilestones
        batting={[
          {
            match_id: "m1",
            runs_scored: 72,
            balls_faced: 48,
            is_out: false,
            created_at: "2024-07-20T14:00:00.000Z",
            match,
          },
        ]}
        bowling={[
          {
            match_id: "m1",
            wickets_taken: 3,
            runs_conceded: 21,
            overs_bowled: 4,
            created_at: "2024-07-20T14:00:00.000Z",
            match,
          },
        ]}
      />,
    );
    expect(screen.getByText("Milestones")).toBeInTheDocument();
    const fifties = screen.getByText("Fifties").parentElement!;
    expect(within(fifties).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Best batting").parentElement).toHaveTextContent(
      "72* (48 balls)",
    );
    expect(screen.getByText("Best bowling").parentElement).toHaveTextContent(
      "3/21 (4 overs)",
    );
    const recent = screen.getByRole("region", { name: "Recent milestones" });
    expect(within(recent).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(recent).getAllByRole("link", { name: "Strikers vs Warriors" })[0],
    ).toHaveAttribute("href", "/matches/m1");
    expect(recent).toHaveTextContent("20 Jul 2024");
  });
});
