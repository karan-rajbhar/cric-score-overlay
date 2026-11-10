import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import type { LiveEvent } from "~/lib/firebase/types";
import type { Innings, Match } from "~/lib/match-types";
import { autoGraphics } from "./auto-graphics";
import { economyText } from "./overlay-kit";
import { bowlerNow, partnershipOf } from "./packages/shared/derive";
import { ResultCard } from "./presentation-card-views";
import { ScoreBug } from "./score-bug";
import { StrapView, strapText } from "./strap-views";
import type { LiveMatchState } from "./types";

/** A 100-ball match: 20 overs of 5. */
const FIVE: Match = { ...DEMO_MATCH_DETAILS, balls_per_over: 5 };
const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, " ") ?? "";

/** A bowler on 1 for 12 off 10 balls (two five-ball overs). */
const bowling = {
  ...DEMO_MATCH_STATE,
  bowler_balls: 10,
  bowler_runs: 12,
  bowler_wickets: 1,
  partnership_runs: 20,
  partnership_balls: 10,
} as LiveMatchState;

describe("a match with five balls an over", () => {
  it("gives the bowler's overs and economy on the score bug and the shared figures", () => {
    expect(economyText(12, 10, 5)).toBe("6.00");
    const bug = text(
      render(<ScoreBug state={bowling} match={FIVE} layout="bottom" />)
        .container,
    );
    expect(bug).toContain("6.00");
    expect(bug).not.toContain("7.20");
    expect(bowlerNow(bowling, 5)).toMatchObject({
      overs: "2.0",
      economy: "6.00",
    });
    expect(partnershipOf(bowling, [], 5)?.runRate).toBe(10);
  });

  it("gives the bowler strap, typed or automatic, in five-ball overs", () => {
    const strap = text(
      render(
        <StrapView
          strap={{ id: "s", type: "bowler", title: "" }}
          state={bowling}
          layout="bottom"
          ballsPerOver={5}
        />,
      ).container,
    );
    expect(strap).toContain("1-12 off 2.0 overs");
    expect(strap).toContain("Econ 6.00");

    const event: LiveEvent = {
      type: "new_bowler",
      player_id: "x",
      name: "A Bowler",
      value: null,
      runs: 12,
      balls: 10,
      wickets: 1,
      number: null,
    };
    const prev = { ...DEMO_MATCH_STATE, events: [] } as LiveMatchState;
    const next = { ...prev, bowler_id: "x", events: [event] } as LiveMatchState;
    const auto = autoGraphics(prev, next, null, 5).find(
      (i) => i.kind === "strap",
    );
    expect(auto?.kind === "strap" && auto.strap.subtitle).toBe(
      "1-12 off 2.0 overs",
    );
  });
});

describe("a 100-ball match", () => {
  it("counts the win predictor's balls left in five-ball overs", () => {
    const chase = {
      ...DEMO_MATCH_STATE,
      status: "live",
      innings_number: 2,
      innings_completed: false,
      overs_per_innings: 20,
      total_balls: 40,
      total_runs: 60,
      total_wickets: 2,
      target_runs: 150,
      runs_needed: 90,
      balls_remaining: 60,
    } as LiveMatchState;
    expect(
      strapText({ id: "w", type: "win_predictor", title: "" }, chase, 5)
        ?.subtitle,
    ).toBe("Need 90 from 60 balls");
  });

  it("prints a 100-ball innings as 20 overs on the result card", () => {
    const innings = (DEMO_MATCH_DETAILS.innings as Innings[]).map((i) => ({
      ...i,
      total_balls: 100,
    }));
    const card = text(
      render(
        <ResultCard state={DEMO_MATCH_STATE} match={FIVE} innings={innings} />,
      ).container,
    );
    expect(card).toContain("(20.0 ov)");
    expect(card).not.toContain("16.4");
  });
});
