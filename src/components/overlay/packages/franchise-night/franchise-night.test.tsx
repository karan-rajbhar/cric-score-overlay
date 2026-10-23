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
import { contrastRatio } from "../../overlay-themes";
import type { LiveMatchState } from "../../types";
import { galleryElementProps } from "../gallery";
import { resolveOverlayPackage } from "../registry";
import type { ElementBaseProps, OverlayElementProps } from "../types";
import { FRANCHISE_NIGHT } from ".";
import { BallChip, CHIP_FILL, Crest } from "./kit";
import { FranchiseScoreBug } from "./score-bug";
import { lookOf } from "./sting";
import { BreakBandStrap } from "./straps";
import { DEFAULT_TEAM_COLOURS, FN, franchisePalette, matchTones, teamTone } from "./theme";

const base = (state: LiveMatchState, over: Partial<ElementBaseProps> = {}): ElementBaseProps => ({
  state,
  match: DEMO_MATCH_DETAILS,
  snapshots: DEMO_SNAPSHOTS,
  theme: "franchise-night",
  customColors: null,
  layout: "bottom",
  ...over,
});

const bug = (state: LiveMatchState, layout: ElementBaseProps["layout"] = "bottom") => (
  <FranchiseScoreBug
    {...base(state, { layout })}
    sponsor={null}
    marginOffsetPx={0}
    phase="live"
  />
);

describe("the package", () => {
  it("is registered as a broadcast package", () => {
    const pkg = resolveOverlayPackage("franchise-night");
    expect(pkg).toBe(FRANCHISE_NIGHT);
    expect(pkg.kind).toBe("broadcast");
    expect(pkg.fonts?.display).toContain("Saira");
  });
});

describe("team colours", () => {
  it("uses the match's colours, with strong defaults for a side without", () => {
    const tones = matchTones(DEMO_MATCH_STATE);
    expect(tones.team1.base).toBe("#0f766e");
    expect(tones.bat).toBe(tones.team1);
    expect(tones.bowl).toBe(tones.team2);
    const none = matchTones({ ...DEMO_MATCH_STATE, team_colors: null });
    expect(none.team1.base).toBe(DEFAULT_TEAM_COLOURS.team1);
    expect(none.team2.base).toBe(DEFAULT_TEAM_COLOURS.team2);
    expect(matchTones(null).bat.base).toBe(DEFAULT_TEAM_COLOURS.team1);
  });

  it("keeps text readable on any team colour, light ones included", () => {
    for (const colour of ["#ffd400", "#ffffff", "#0b0b0b", "#0f766e", "#e8590c", "#1d1d6b"]) {
      const t = teamTone(colour, "#000000");
      expect(contrastRatio(t.text, t.base), colour).toBeGreaterThanOrEqual(4.5);
    }
    // A colour too dark for the glass gets a lit edge well above it.
    const dark = teamTone("#0b0b0b", "#000000");
    expect(contrastRatio(dark.light, FN.glassMid)).toBeGreaterThan(2);
  });

  it("tells two sides in the same colour apart where they sit side by side", () => {
    const same = matchTones({
      ...DEMO_MATCH_STATE,
      team_colors: {
        team1: { primary: "#1d4ed8", secondary: null },
        team2: { primary: "#1e40af", secondary: "#facc15" },
      },
    });
    expect(same.team2Contrast).toBe("#facc15");
  });

  it("gives Standard fallbacks the same glass and gold", () => {
    const p = franchisePalette(DEMO_MATCH_STATE);
    expect(p.accent).toBe(FN.gold);
    expect(contrastRatio(p.barText, p.bar)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.barMuted, p.bar)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the score bug", () => {
  it("draws each phase", () => {
    for (const [state, phase] of [
      [DEMO_PRE_STATE, "pre"],
      [DEMO_FIRST_INNINGS_STATE, "live"],
      [DEMO_MATCH_STATE, "live"],
      [DEMO_BREAK_STATE, "break"],
      [DEMO_RESULT_STATE, "done"],
    ] as const) {
      const { unmount } = render(bug(state));
      expect(screen.getByTestId("fn-score-bug").getAttribute("data-phase")).toBe(phase);
      unmount();
    }
  });

  it("shows the chase and its rate meter, from the live row", () => {
    render(bug(DEMO_MATCH_STATE));
    expect(
      screen.getByText(
        `Need ${DEMO_MATCH_STATE.runs_needed} from ${DEMO_MATCH_STATE.balls_remaining} balls`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /below the required rate/ })).toBeInTheDocument();
  });

  it("projects a first innings at its rate and at fixed rates", () => {
    render(bug(DEMO_FIRST_INNINGS_STATE));
    expect(screen.getByText("Projected")).toBeInTheDocument();
    expect(screen.getByText("(8 rpo)")).toBeInTheDocument();
  });

  it("shortens a long name where space is tight", () => {
    render(bug({ ...DEMO_MATCH_STATE, striker_name: "Sri Venkatesh Ramanathan" }));
    expect(screen.getByText("S. V. Ramanathan")).toBeInTheDocument();
  });

  it("draws the top and compact layouts", () => {
    for (const layout of ["top", "compact"] as const) {
      const { unmount } = render(bug(DEMO_MATCH_STATE, layout));
      expect(screen.getByTestId("fn-score-bug").getAttribute("data-layout")).toBe(layout);
      unmount();
    }
  });
});

describe("pieces", () => {
  it("falls back from a broken logo to the team's monogram", () => {
    const tone = matchTones(DEMO_MATCH_STATE).team1;
    const { container } = render(
      <Crest logo="https://x/broken.png" code="RIV" name="Riverside Rangers" tone={tone} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("RR");
  });

  it("labels each delivery as scored, no-ball byes included", () => {
    const { container } = render(<BallChip token="nb+2b" />);
    expect(container.textContent).toBe("nb+2b");
  });

  it("keeps every chip's figure legible, the dot ball's included", () => {
    for (const [kind, { bg, fg }] of Object.entries(CHIP_FILL)) {
      // Large bold figures: 3:1 at least (the dot ball well above).
      expect(contrastRatio(fg, bg), kind).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(CHIP_FILL.dot.fg, CHIP_FILL.dot.bg)).toBeGreaterThanOrEqual(4.5);
    // Still told apart from a run.
    expect(CHIP_FILL.dot.bg).not.toBe(CHIP_FILL.run.bg);
  });

  it("writes a sting's word in dark ink on a light side's band", () => {
    const sting = galleryElementProps("sting", { state: "live", theme: "franchise-night", kind: "four" });
    expect(lookOf(sting).fill).not.toContain("#10131d");
    const yellow: OverlayElementProps["sting"] = {
      ...sting,
      state: {
        ...DEMO_MATCH_STATE,
        team_colors: { team1: { primary: "#ffd400", secondary: null }, team2: null },
      },
    };
    expect(lookOf(yellow).fill).toContain("#10131d");
  });
});

describe("real data only", () => {
  it("draws nothing without the data", () => {
    const powerplay = render(
      <BreakBandStrap state={DEMO_MATCH_STATE} kind="powerplay" strap={null} />,
    );
    expect(powerplay.container.textContent).toBe("");
    powerplay.unmount();
    render(
      <BreakBandStrap
        state={{ ...DEMO_MATCH_STATE, powerplay: { end_over: 6 } }}
        kind="powerplay"
        strap={null}
      />,
    );
    expect(screen.getByText("Fielding restrictions, overs 1 to 6")).toBeInTheDocument();
  });

  it("names the player of the match only when the match has one", () => {
    const pkg = FRANCHISE_NIGHT.elements;
    const Potm = pkg.playerOfTheMatch!;
    const innings = DEMO_RESULT_MATCH.innings ?? [];
    const none = render(<Potm {...base(DEMO_RESULT_STATE)} innings={innings} />);
    expect(none.container.textContent).toBe("");
    none.unmount();
    render(<Potm {...base(DEMO_RESULT_STATE, { match: DEMO_RESULT_MATCH })} innings={innings} />);
    expect(screen.getByText(DEMO_RESULT_MATCH.player_of_the_match!.full_name)).toBeInTheDocument();
  });
});
