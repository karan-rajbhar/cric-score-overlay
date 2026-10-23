import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEMO_BREAK_STATE,
  DEMO_FIRST_INNINGS_STATE,
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
  DEMO_PRE_STATE,
  DEMO_RESULT_MATCH,
  DEMO_RESULT_STATE,
  DEMO_SNAPSHOTS,
} from "~/app/overlay/[matchId]/demo-data";
import type { Match } from "~/lib/match-types";
import { contrastRatio } from "../../overlay-themes";
import { overlayPhaseOf } from "../../score-bug";
import type { LiveMatchState } from "../../types";
import { resolveOverlayPackage } from "../registry";
import type { ElementBaseProps, StingKind } from "../types";
import { SUMMER_BASH, SUMMER_BASH_ELEMENTS } from ".";
import { codeSize, SummerBashScoreBug } from "./bug";
import { ResultCard, ScorecardCard } from "./cards";
import {
  hueDistance,
  NEON,
  sideColour,
  summerBashVars,
  teamColours,
  vivid,
} from "./colours";
import { lowerThirdPlace, nameSize, titleSize } from "./kit";
import { SummerBashSting, wordSize } from "./stings";
import { BatterLowerThird, BowlerLowerThird, BreakStrap, ChaseStrap } from "./straps";

const base = (
  state: LiveMatchState,
  over: Partial<ElementBaseProps> = {},
): ElementBaseProps => ({
  state,
  match: DEMO_MATCH_DETAILS,
  snapshots: DEMO_SNAPSHOTS,
  theme: "summer-bash",
  customColors: null,
  layout: "bottom",
  ...over,
});

const bug = (state: LiveMatchState, layout: ElementBaseProps["layout"] = "bottom", match: Match = DEMO_MATCH_DETAILS) => (
  <SummerBashScoreBug
    {...base(state, { layout, match })}
    sponsor="Northfield Builders"
    marginOffsetPx={0}
    phase={overlayPhaseOf(state)}
  />
);

describe("the package", () => {
  it("is registered as a broadcast package and draws every element itself", () => {
    const pkg = resolveOverlayPackage("summer-bash");
    expect(pkg).toBe(SUMMER_BASH);
    expect(pkg.kind).toBe("broadcast");
    expect(Object.keys(SUMMER_BASH_ELEMENTS)).toHaveLength(33);
    expect(pkg.fonts?.display).toContain("Unbounded");
    expect(pkg.fonts?.text).toContain("Archivo");
  });
});

describe("colours", () => {
  it("pushes a team colour to full saturation and leaves greys out", () => {
    expect(vivid(null)).toBeNull();
    expect(vivid("#808080")).toBeNull();
    expect(vivid("#ffffff")).toBeNull();
    expect(vivid("#000000")).toBeNull();
    // A dull navy comes out as a lit blue.
    const navy = vivid("#1a2a4a")!;
    expect(navy).not.toBeNull();
    expect(hueDistance(navy, "#1a2a4a")).toBeLessThan(4);
    expect(contrastRatio(navy, NEON.night)).toBeGreaterThan(contrastRatio("#1a2a4a", NEON.night));
  });

  it("keeps text on every plate readable (AA)", () => {
    for (const c of ["#ff2ea6", "#1fe5ff", "#b8ff2e", "#ffe23d", "#ff1f3d", "#2b5cff", "#14b8a6"]) {
      const plate = sideColour(c);
      expect(contrastRatio(plate.text, plate.bg), c).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses magenta and cyan for sides without colours, and splits two sides in one colour", () => {
    const none = teamColours({ team_colors: null });
    expect(none.team1.glow).toBe(NEON.magenta);
    expect(none.team2.glow).toBe(NEON.cyan);
    const same = teamColours({
      team_colors: {
        team1: { primary: "#c81e1e", secondary: null },
        team2: { primary: "#b91c1c", secondary: "#facc15" },
      },
    });
    // The second side takes its secondary colour.
    expect(hueDistance(same.team1.glow, same.team2.glow)).toBeGreaterThanOrEqual(28);
    expect(same.team2.glow).toBe(vivid("#facc15"));
  });

  it("names the batting and bowling sides' colours for the elements", () => {
    const vars = summerBashVars({ state: DEMO_MATCH_STATE, theme: "summer-bash", customColors: null });
    // Riverside (team 1) bats in the demo chase.
    expect(vars["--sb-bat-glow"]).toBe(vars["--sb-t1-glow"]);
    expect(vars["--sb-bowl-glow"]).toBe(vars["--sb-t2-glow"]);
    const first = summerBashVars({ state: DEMO_FIRST_INNINGS_STATE, theme: "summer-bash", customColors: null });
    expect(first["--sb-bat-glow"]).toBe(first["--sb-t2-glow"]);
  });
});

describe("fitting text", () => {
  it("steps long names, titles, words and codes down", () => {
    expect(nameSize("Ravi Iyer")).toBe(46);
    expect(nameSize("Christopher Montgomery-W")).toBeLessThan(nameSize("Ravi Iyer"));
    expect(titleSize("Run rates")).toBe(40);
    expect(titleSize("Riverside Rangers fall of wickets")).toBeLessThan(40);
    expect(wordSize("SIX", 330)).toBe(330);
    expect(wordSize("THREE WICKETS", 200)).toBeLessThan(200);
    expect(codeSize("RIV", 40)).toBe(40);
    expect(codeSize("RIVER", 40)).toBeLessThan(codeSize("RIVR", 40));
  });

  it("keeps lower thirds clear of the score bug in each layout", () => {
    expect(lowerThirdPlace("bottom").bottom).toBeGreaterThan(54 + 148);
    expect(lowerThirdPlace("top").bottom).toBe(54);
    expect(lowerThirdPlace("compact").left).toBeGreaterThan(96 + 400);
  });
});

describe("score bug", () => {
  it("shows the chase in play, with the figures", () => {
    render(bug(DEMO_MATCH_STATE));
    const el = screen.getByTestId("score-bug");
    expect(el).toHaveAttribute("data-phase", "live");
    expect(el).toHaveTextContent(DEMO_MATCH_STATE.striker_name!);
    expect(el).toHaveTextContent(DEMO_MATCH_STATE.current_bowler_name!);
    expect(el).toHaveTextContent(`Need ${DEMO_MATCH_STATE.runs_needed} off ${DEMO_MATCH_STATE.balls_remaining}`);
    expect(el).toHaveTextContent("2nd innings");
    expect(screen.getByLabelText("This over")).toBeInTheDocument();
  });

  it("draws each phase its own way", () => {
    const { unmount } = render(bug(DEMO_PRE_STATE));
    expect(screen.getByTestId("score-bug")).toHaveAttribute("data-phase", "pre");
    expect(screen.getByTestId("score-bug")).toHaveTextContent(DEMO_PRE_STATE.team1_name!);
    unmount();

    const brk = render(bug(DEMO_BREAK_STATE));
    expect(screen.getByTestId("score-bug")).toHaveAttribute("data-phase", "break");
    expect(screen.getByTestId("score-bug")).toHaveTextContent("Innings break");
    expect(screen.getByTestId("score-bug")).toHaveTextContent(`Target${DEMO_BREAK_STATE.target_runs}`);
    brk.unmount();

    render(bug(DEMO_RESULT_STATE, "bottom", DEMO_RESULT_MATCH));
    const done = screen.getByTestId("score-bug");
    expect(done).toHaveAttribute("data-phase", "done");
    expect(done).toHaveTextContent(DEMO_RESULT_STATE.result_description!);
    // Both innings from the match.
    for (const inn of DEMO_RESULT_MATCH.innings!) {
      expect(done).toHaveTextContent(`${inn.total_runs}/${inn.total_wickets}`);
    }
  });

  it("has a top bar and a corner card", () => {
    const top = render(bug(DEMO_MATCH_STATE, "top"));
    expect(screen.getByTestId("score-bug")).toHaveAttribute("data-layout", "top");
    expect(screen.getByTestId("score-bug").style.top).toBe("54px");
    top.unmount();
    render(bug(DEMO_MATCH_STATE, "compact"));
    expect(screen.getByTestId("score-bug").style.left).toBe("96px");
    expect(screen.getByTestId("score-bug")).toHaveTextContent(DEMO_MATCH_STATE.striker_name!);
  });

  it("shows the powerplay and a free hit only when the live row says so", () => {
    const { unmount } = render(bug(DEMO_MATCH_STATE));
    expect(screen.queryByText("Powerplay")).toBeNull();
    expect(screen.queryByText("Free hit")).toBeNull();
    unmount();
    render(bug({ ...DEMO_MATCH_STATE, powerplay: { end_over: 6 }, free_hit: true }));
    expect(screen.getByText("Powerplay")).toBeInTheDocument();
    expect(screen.getByText("Free hit")).toBeInTheDocument();
  });
});

describe("stings", () => {
  const sting = (kind: StingKind, title: string, state: LiveMatchState | null = DEMO_MATCH_STATE) => (
    <SummerBashSting
      {...base(DEMO_MATCH_STATE)}
      state={state}
      kind={kind}
      sting={{ id: kind, type: kind === "four" || kind === "six" || kind === "wicket" || kind === "free_hit" ? kind : "milestone", title, subtitle: "Ravi Iyer", detail: "34 (28)", durationMs: 4000 }}
    />
  );

  it("draws each event's word and who it was", () => {
    const { unmount } = render(sting("six", "Six"));
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-sting-kind", "six");
    expect(status).toHaveTextContent("SIX");
    expect(status).toHaveTextContent("Ravi Iyer");
    expect(status).toHaveTextContent("34 (28)");
    unmount();

    const fifty = render(sting("fifty", "Fifty"));
    expect(screen.getByRole("status")).toHaveTextContent("50");
    fifty.unmount();

    render(sting("wicket", "Wicket", null));
    expect(screen.getByRole("status")).toHaveTextContent("WICKET");
  });
});

describe("lower thirds", () => {
  it("shows the striker's figures, with their photo when the match has one", () => {
    const withPhoto: Match = {
      ...DEMO_MATCH_DETAILS,
      team1: {
        ...DEMO_MATCH_DETAILS.team1!,
        team_players: DEMO_MATCH_DETAILS.team1!.team_players!.map((tp) =>
          tp.user_id === DEMO_MATCH_STATE.striker_id
            ? { ...tp, user: { ...tp.user!, avatar_url: "https://example.test/p.png" } }
            : tp,
        ),
      },
    };
    const { container } = render(
      <BatterLowerThird {...base(DEMO_MATCH_STATE, { match: withPhoto })} slot="striker" variant="strap" strap={null} />,
    );
    expect(screen.getByText(DEMO_MATCH_STATE.striker_name!)).toBeInTheDocument();
    expect(container).toHaveTextContent(`(${DEMO_MATCH_STATE.striker_balls})`);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.test/p.png");
    // A photo that fails falls back to initials.
    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("RI");
  });

  it("fits a long name on the plate", () => {
    const long = "Christopher Montgomery-W";
    render(
      <BowlerLowerThird
        {...base({ ...DEMO_MATCH_STATE, current_bowler_name: long })}
        variant="strap"
        strap={null}
      />,
    );
    const name = screen.getByText(long);
    expect(name.className).toContain("truncate");
    expect(Number.parseInt(name.style.fontSize, 10)).toBeLessThan(46);
  });

  it("draws nothing without the data", () => {
    const { container } = render(
      <ChaseStrap {...base(DEMO_FIRST_INNINGS_STATE)} strap={null} />,
    );
    expect(container).toBeEmptyDOMElement();
    const pp = render(
      <BreakStrap {...base(DEMO_FIRST_INNINGS_STATE)} kind="powerplay" variant="strap" strap={null} />,
    );
    expect(pp.container).toBeEmptyDOMElement();
  });

  it("draws the powerplay strap and card from the live row", () => {
    const state = { ...DEMO_FIRST_INNINGS_STATE, powerplay: { end_over: 6 } };
    const strap = render(<BreakStrap {...base(state)} kind="powerplay" variant="strap" strap={null} />);
    expect(strap.container).toHaveTextContent("Fielding restrictions");
    expect(strap.container).toHaveTextContent("1-6");
    strap.unmount();
    const card = render(<BreakStrap {...base(state)} kind="powerplay" variant="card" strap={null} />);
    expect(card.container).toHaveTextContent("Powerplay");
    expect(card.container).toHaveTextContent("1-6");
  });
});

describe("cards", () => {
  it("draws the batting card with the current batters marked", () => {
    const innings = DEMO_MATCH_DETAILS.innings!.find((i) => i.innings_number === 2)!;
    render(
      <ScorecardCard {...base(DEMO_MATCH_STATE)} innings={innings} teamName={DEMO_MATCH_STATE.team1_name!} full />,
    );
    expect(screen.getByText(`${DEMO_MATCH_STATE.team1_name} batting`)).toBeInTheDocument();
    expect(screen.getByText(`${DEMO_MATCH_STATE.striker_name} *`)).toBeInTheDocument();
    expect(screen.getAllByText("Bowler").length).toBeGreaterThan(0);
  });

  it("draws the result only after the match", () => {
    const innings = DEMO_RESULT_MATCH.innings!;
    const { container, unmount } = render(
      <ResultCard {...base(DEMO_MATCH_STATE)} innings={innings} />,
    );
    expect(container).toBeEmptyDOMElement();
    unmount();
    render(<ResultCard {...base(DEMO_RESULT_STATE, { match: DEMO_RESULT_MATCH })} innings={innings} />);
    expect(screen.getByText(DEMO_RESULT_STATE.result_description!)).toBeInTheDocument();
    expect(screen.getByText(DEMO_RESULT_MATCH.player_of_the_match!.full_name)).toBeInTheDocument();
  });
});
