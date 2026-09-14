import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PresentationCards } from "./presentation-cards";
import {
  DEMO_MATCH_STATE,
  DEMO_MATCH_DETAILS,
} from "~/app/overlay/[matchId]/demo-data";

describe("PresentationCards Component", () => {
  it("renders null when card is 'none'", () => {
    const { container } = render(
      <PresentationCards
        card="none"
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Toss card correctly", () => {
    render(
      <PresentationCards
        card="toss"
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
      />,
    );
    expect(screen.getByText(/TOSS RESULT/i)).toBeInTheDocument();
    expect(screen.getByText("Royal Challengers")).toBeInTheDocument();
    expect(screen.getByText("Super Kings")).toBeInTheDocument();
    expect(
      screen.getByText(/won the toss and elected to/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Richard Kettleborough/i)).toBeInTheDocument();
  });

  it("renders Playing XI card with team squads", () => {
    render(
      <PresentationCards
        card="playing_xi"
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
      />,
    );
    expect(screen.getByText(/PLAYING XI TEAM LINEUPS/i)).toBeInTheDocument();
    expect(screen.getByText("1. Virat Kohli")).toBeInTheDocument();
    expect(screen.getByText("1. Ruturaj Gaikwad")).toBeInTheDocument();
  });

  it("renders Scorecard card with batting & bowling", () => {
    render(
      <PresentationCards
        card="scorecard"
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
      />,
    );
    expect(screen.getByText("Match Scorecard")).toBeInTheDocument();
    expect(screen.getByText("Batting Card")).toBeInTheDocument();
    expect(screen.getByText("Bowling Figures")).toBeInTheDocument();
  });

  it("renders Partnership card with active stand", () => {
    render(
      <PresentationCards
        card="partnership"
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
      />,
    );
    expect(screen.getByText(/Active Partnership/i)).toBeInTheDocument();
    expect(screen.getByText(/52 RUNS/i)).toBeInTheDocument();
    expect(screen.getByText(/Virat Kohli/i)).toBeInTheDocument();
    expect(screen.getByText(/Glenn Maxwell/i)).toBeInTheDocument();
  });

  it("renders Over Summary card with ball chips", () => {
    render(
      <PresentationCards
        card="over_summary"
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
      />,
    );
    expect(screen.getByText(/Over Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/This Over:/i)).toBeInTheDocument();
    expect(screen.getByText(/Bowler: Ravindra Jadeja/i)).toBeInTheDocument();
  });

  it("renders Result & POTM card", () => {
    const completedState = {
      ...DEMO_MATCH_STATE,
      status: "completed",
      winning_team_name: "Royal Challengers",
      result_description: "Royal Challengers won by 5 wickets",
    };

    render(
      <PresentationCards
        card="result"
        state={completedState}
        match={DEMO_MATCH_DETAILS}
      />,
    );
    expect(screen.getByText(/Match Result/i)).toBeInTheDocument();
    expect(
      screen.getByText("Royal Challengers won by 5 wickets"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Player of the Match/i)).toBeInTheDocument();
    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <PresentationCards
        card="toss"
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
        onClose={handleClose}
      />,
    );

    const closeButton = screen.getByLabelText("Close presentation card");
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
