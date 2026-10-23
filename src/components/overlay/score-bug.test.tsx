import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEMO_MATCH_STATE } from "~/app/overlay/[matchId]/demo-data";
import { oversText } from "./overlay-kit";
import { ScoreBug } from "./score-bug";

const S = DEMO_MATCH_STATE;

describe("ScoreBug", () => {
  it("shows the score, both batters, the bowler and this over", () => {
    render(<ScoreBug state={S} />);
    expect(screen.getByText(`${S.total_runs}/${S.total_wickets}`)).toBeInTheDocument();
    expect(screen.getByText(oversText(S.total_balls))).toBeInTheDocument();
    expect(screen.getByText(S.striker_name!)).toBeInTheDocument();
    expect(screen.getByText(S.non_striker_name!)).toBeInTheDocument();
    expect(screen.getByText(S.current_bowler_name!)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "This over" })).toBeInTheDocument();
    expect(screen.getByText("on strike")).toBeInTheDocument();
  });

  it("keeps the chase on screen, not on a rotating slide", () => {
    render(<ScoreBug state={S} />);
    expect(
      screen.getByText(`Need ${S.runs_needed} from ${S.balls_remaining} balls`),
    ).toBeInTheDocument();
    expect(screen.getByText(`Target ${S.target_runs}`)).toBeInTheDocument();
  });

  it("shows the run rate and the powerplay in a first innings", () => {
    const first = {
      ...S,
      innings_number: 1,
      target_runs: null,
      runs_needed: null,
      balls_remaining: null,
      required_run_rate: null,
      powerplay: { end_over: 6 },
    };
    render(<ScoreBug state={first} />);
    expect(screen.getByText(/^CRR /)).toBeInTheDocument();
    expect(screen.getByText("Powerplay")).toBeInTheDocument();
  });

  it.each(["bottom", "top", "compact"] as const)("draws the %s layout", (layout) => {
    render(<ScoreBug state={S} layout={layout} />);
    expect(screen.getByTestId("score-bug")).toHaveAttribute("data-layout", layout);
  });

  it("lifts above the bottom edge by the safe-zone offset", () => {
    render(<ScoreBug state={S} marginOffsetPx={30} />);
    expect(screen.getByTestId("score-bug").style.bottom).toBe("70px");
  });
});
