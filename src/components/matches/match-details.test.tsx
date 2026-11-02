import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchDetails } from "./match-details";
import { makeMatch } from "~/test/factories";

describe("MatchDetails", () => {
  it("lists format, overs, venue and toss", () => {
    render(
      <MatchDetails
        match={makeMatch({
          match_format: "T20",
          overs_per_innings: 20,
          venue: "Wankhede Stadium",
          scheduled_at: "2026-10-15T14:30:00Z",
          toss_winner_team_id: "t1",
          toss_decision: "bat",
        })}
      />,
    );
    expect(screen.getByText("T20")).toBeInTheDocument();
    expect(screen.getByText("20 overs per innings")).toBeInTheDocument();
    expect(screen.getByText("Wankhede Stadium")).toBeInTheDocument();
    expect(
      screen.getByText(/Royal Tigers won the toss and elected to bat/i),
    ).toBeInTheDocument();
  });

  it("has no row for what the match does not hold", () => {
    render(
      <MatchDetails match={makeMatch({ match_format: "Custom", overs_per_innings: 8 })} />,
    );
    expect(screen.queryByText("Format")).toBeNull();
    expect(screen.queryByText("Venue")).toBeNull();
    expect(screen.queryByText("Toss")).toBeNull();
    expect(screen.queryByText("Not specified")).toBeNull();
  });

  it("never shows the database id", () => {
    render(<MatchDetails match={makeMatch({ id: "d3623f89" })} />);
    expect(screen.queryByText("Match ID")).toBeNull();
    expect(screen.queryByText("d3623f89")).toBeNull();
  });

  it("explains a missing outside team, and is quiet when both count", () => {
    const club = { id: "c1", name: "Riverside CC" };
    const { unmount } = render(
      <MatchDetails match={makeMatch({ club_id: "c1", club })} />,
    );
    expect(screen.queryByText("Club stats count")).toBeNull();
    expect(screen.queryByText("Both teams")).toBeNull();
    unmount();

    render(
      <MatchDetails
        match={makeMatch({ club_id: "c1", club, club_side: "team2" })}
      />,
    );
    expect(screen.getByText("Club stats count")).toBeInTheDocument();
    expect(screen.getByText("Only Coastal Kings")).toBeInTheDocument();
    expect(screen.getByText("Royal Tigers: outside team")).toBeInTheDocument();
  });

  it("folds as reference, but is open before the start", () => {
    const { container, unmount } = render(
      <MatchDetails match={makeMatch({ status: "completed" })} />,
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    unmount();

    const upcoming = render(
      <MatchDetails match={makeMatch({ status: "scheduled" })} />,
    );
    expect(upcoming.container.querySelector("details")).toHaveAttribute("open");
  });
});
