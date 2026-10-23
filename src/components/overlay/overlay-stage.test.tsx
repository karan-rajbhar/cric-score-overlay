import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./sound-effects", () => ({
  playFourFanfare: vi.fn(),
  playSixExplosion: vi.fn(),
  playWicketTone: vi.fn(),
  playMilestoneFanfare: vi.fn(),
  playFreeHitAlert: vi.fn(),
}));

import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import { DEFAULT_SCENE } from "~/lib/overlay-state";
import { OverlayStage, overlayPhaseOf, inningsLabel } from "./overlay-stage";
import { stingFor } from "./stings";
import type { LiveMatchState } from "./types";
import type { OverlayLayers } from "./use-overlay-state";

const layers = (over: Partial<OverlayLayers> = {}): OverlayLayers => ({
  scene: DEFAULT_SCENE,
  sting: null,
  strap: null,
  card: "none",
  ...over,
});

function stage(
  state: LiveMatchState | null,
  over: Partial<OverlayLayers> = {},
) {
  return render(
    <OverlayStage
      state={state}
      match={DEMO_MATCH_DETAILS}
      layers={layers(over)}
      onDismissSting={() => {}}
      onDismissStrap={() => {}}
    />,
  );
}

/** A match with the toss done but no ball bowled. */
const PRE: LiveMatchState = {
  ...DEMO_MATCH_STATE,
  status: "scheduled",
  innings_number: null,
  total_runs: null,
  total_wickets: null,
  total_balls: null,
  batting_team_name: null,
  batting_team_short_name: null,
  striker_name: null,
  non_striker_name: null,
  current_bowler_name: null,
  runs_needed: null,
  balls_remaining: null,
  target_runs: null,
  toss_winner_team_id: null,
  toss_decision: null,
};

describe("OverlayStage", () => {
  it("shows who plays before the first ball, not an empty score", () => {
    stage(PRE);
    expect(overlayPhaseOf(PRE)).toBe("pre");
    expect(
      screen.getByText(new RegExp(DEMO_MATCH_STATE.team1_name!)),
    ).toBeInTheDocument();
    expect(screen.queryByText("BAT")).toBeNull();
    expect(screen.queryByText(/won the toss/)).toBeNull();
    expect(screen.queryByText("0/0")).toBeNull();
  });

  it("names the toss only when it is recorded", () => {
    stage({
      ...PRE,
      toss_winner_team_id: DEMO_MATCH_DETAILS.team2_id,
      toss_decision: "bowl",
    });
    expect(
      screen.getByText(
        `${DEMO_MATCH_STATE.team2_name} won the toss and chose to bowl`,
      ),
    ).toBeInTheDocument();
  });

  it("marks the innings break before anyone is in", () => {
    const brk: LiveMatchState = {
      ...DEMO_MATCH_STATE,
      total_runs: 0,
      total_wickets: 0,
      total_balls: 0,
      striker_name: null,
      non_striker_name: null,
      current_bowler_name: null,
      this_over_balls: null,
      runs_needed: 185,
      balls_remaining: 120,
    };
    stage(brk);
    expect(overlayPhaseOf(brk)).toBe("break");
    expect(
      screen.getByText(`${DEMO_MATCH_STATE.batting_team_short_name} to bat next`),
    ).toBeInTheDocument();
    expect(screen.getByText("Need 185 from 120 balls")).toBeInTheDocument();
  });

  it("shows the result after the match, and both sides' names", () => {
    const done: LiveMatchState = {
      ...DEMO_MATCH_STATE,
      status: "completed",
      innings_completed: true,
      bowling_team_name: null,
      bowling_team_short_name: null,
      runs_needed: null,
      balls_remaining: null,
      result_description: "Harbour Hawks won by 9 runs",
    };
    stage(done);
    expect(overlayPhaseOf(done)).toBe("done");
    expect(screen.getByText("Harbour Hawks won by 9 runs")).toBeInTheDocument();
    // The other side is named even though live_state drops it after play.
    expect(screen.getByText(/RIV v HAW/)).toBeInTheDocument();
    // No "Need runs from balls" with the numbers missing.
    expect(screen.queryByText(/Need/)).toBeNull();
  });

  it("labels a super over and its one-over limit", () => {
    stage({ ...DEMO_MATCH_STATE, innings_number: 3, total_balls: 2 });
    expect(inningsLabel(3)).toBe("Super over");
    expect(screen.getByText("Super over")).toBeInTheDocument();
    expect(screen.getByText("of 1 over")).toBeInTheDocument();
  });

  it("keeps long names inside the bar", () => {
    const long = "Venkata Subrahmanyam Lakshmipathy Raju";
    stage({
      ...DEMO_MATCH_STATE,
      striker_name: long,
      current_bowler_name: long,
    });
    for (const el of screen.getAllByText(long)) {
      expect(el.className).toContain("truncate");
    }
  });

  it("pads this over to the match's balls per over", () => {
    const { container } = render(
      <OverlayStage
        state={{ ...DEMO_MATCH_STATE, this_over_balls: "1 4" }}
        match={{ ...DEMO_MATCH_DETAILS, balls_per_over: 5 }}
        layers={layers()}
        onDismissSting={() => {}}
        onDismissStrap={() => {}}
      />,
    );
    const over = container.querySelector('[aria-label="This over"]')!;
    expect(over.children).toHaveLength(5);
  });

  it("draws nothing to click, and nothing at all with no score yet", () => {
    const { container } = stage(DEMO_MATCH_STATE, {
      card: "toss",
      sting: stingFor("six", DEMO_MATCH_STATE, "s"),
    });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    const empty = stage(null);
    expect(empty.container.textContent).toBe("");
    expect(container).toBeTruthy();
  });
});

describe("stingFor", () => {
  it("names a dismissed batter only when the last ball was that wicket", () => {
    expect(stingFor("wicket", DEMO_MATCH_STATE, "w").subtitle).toBeUndefined();
    const out = stingFor(
      "wicket",
      {
        ...DEMO_MATCH_STATE,
        last_ball_is_wicket: true,
        last_ball_dismissed_player: "Ravi Iyer",
        last_ball_dismissal_type: "caught",
        last_ball_fielder: "Noah Pereira",
      },
      "w",
    );
    expect(out.subtitle).toBe("Ravi Iyer out");
    expect(out.detail).toBe(
      `c Noah Pereira b ${DEMO_MATCH_STATE.current_bowler_name}`,
    );
  });

  it("calls a milestone a fifty or hundred only when it is one", () => {
    expect(
      stingFor("milestone", { ...DEMO_MATCH_STATE, striker_runs: 52 }, "m")
        .title,
    ).toBe("Fifty");
    expect(
      stingFor("milestone", { ...DEMO_MATCH_STATE, striker_runs: 23 }, "m")
        .title,
    ).toBe("Milestone");
  });
});

describe("OverlayStage with the new graphics", () => {
  it("draws the theme's score bug, with no-ball byes in this over", () => {
    stage({ ...DEMO_MATCH_STATE, this_over_balls: "1 nb+2b 4" });
    expect(screen.getByTestId("score-bug")).toBeInTheDocument();
    expect(screen.getByText("nb+2b")).toBeInTheDocument();
  });

  it("marks a free hit on the bar", () => {
    stage({ ...DEMO_MATCH_STATE, free_hit: true });
    expect(screen.getByText("Free hit")).toBeInTheDocument();
  });

  it("shows an automatic view over the producer's scene", () => {
    stage(DEMO_MATCH_STATE, { view: "14" });
    expect(screen.getByText(/Innings break/)).toBeInTheDocument();
    expect(screen.queryByTestId("score-bug")).toBeNull();
  });

  it("holds: black covers everything, the holding line replaces the bar", () => {
    const black = stage(DEMO_MATCH_STATE, { hold: "black" });
    expect(screen.getByLabelText("Holding")).toBeInTheDocument();
    expect(screen.queryByTestId("score-bug")).toBeNull();
    black.unmount();
    stage(DEMO_MATCH_STATE, { hold: "card" });
    expect(screen.getByText("Score being updated")).toBeInTheDocument();
    expect(screen.queryByTestId("score-bug")).toBeNull();
  });

  it("gives the bar's place to a single-line message", () => {
    stage(DEMO_MATCH_STATE, {
      strap: { id: "m", type: "message", form: "single", title: "Lunch" },
    });
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.queryByTestId("score-bug")).toBeNull();
  });
});
