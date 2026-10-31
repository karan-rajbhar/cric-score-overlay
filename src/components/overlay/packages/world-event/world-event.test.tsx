import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEMO_BREAK_STATE,
  DEMO_FIRST_INNINGS_STATE,
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
  DEMO_PRE_STATE,
  DEMO_RESULT_MATCH,
  DEMO_RESULT_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import { contrastRatio } from "../../overlay-themes";
import type { LiveMatchState } from "../../types";
import { GALLERY_STATES, OverlayGallery } from "../gallery";
import { resolveOverlayPackage } from "../registry";
import { OVERLAY_ELEMENTS } from "../types";
import { chaseLine } from "../shared/derive";
import {
  bugName,
  dismissalText,
  finishAtCurrentRate,
  matchTitleOf,
  ordinal,
  xiOf,
} from "./data";
import { WORLD_EVENT_PACKAGE } from "./index";
import { ballLabel, Balls, Crest } from "./kit";
import { liveContext, WorldEventScoreBug } from "./score-bug";
import { nrrText } from "./standings";
import { STING_LOOK } from "./sting";
import { teamTone, WE, worldEventVars } from "./theme";

const PKG = "world-event";

describe("World event package", () => {
  it("is registered and draws every element itself", () => {
    expect(resolveOverlayPackage(PKG)).toBe(WORLD_EVENT_PACKAGE);
    expect(WORLD_EVENT_PACKAGE.kind).toBe("broadcast");
    for (const el of OVERLAY_ELEMENTS) {
      expect(WORLD_EVENT_PACKAGE.elements[el], el).toBeTypeOf("function");
      expect(WORLD_EVENT_PACKAGE.motion?.[el], el).toBeDefined();
    }
  });

  it("draws every element in its default state from the gallery", () => {
    for (const element of OVERLAY_ELEMENTS) {
      const { container, unmount } = render(<OverlayGallery packageId={PKG} element={element} />);
      const root = container.querySelector(`[data-package="${PKG}"]`);
      expect(root?.querySelector("[data-we]"), element).not.toBeNull();
      expect(root?.textContent?.trim() || root?.querySelector("svg"), element).toBeTruthy();
      unmount();
    }
  });

  it("draws the score bug in every phase", () => {
    for (const state of GALLERY_STATES) {
      const { unmount } = render(<OverlayGallery packageId={PKG} element="scoreBug" state={state} />);
      const bug = screen.getByTestId("we-score-bug");
      expect(bug.dataset.phase, state).toBe(
        state === "first" ? "live" : state === "result" ? "done" : state,
      );
      unmount();
    }
  });

  it("draws the slim and corner layouts in every phase", () => {
    for (const [state, phase] of [
      [DEMO_PRE_STATE, "pre"],
      [DEMO_MATCH_STATE, "live"],
      [DEMO_BREAK_STATE, "break"],
      [DEMO_RESULT_STATE, "done"],
    ] as const) {
      for (const layout of ["top", "compact"] as const) {
        const { unmount } = render(
          <WorldEventScoreBug
            state={state}
            match={DEMO_MATCH_DETAILS}
            snapshots={null}
            theme={PKG}
            customColors={null}
            layout={layout}
            sponsor={null}
            marginOffsetPx={0}
            phase={phase}
          />,
        );
        expect(screen.getByTestId("we-score-bug").textContent, `${layout} ${phase}`).toContain(
          DEMO_MATCH_STATE.team1_short_name!,
        );
        unmount();
      }
    }
  });

  it("draws the variants and kinds it supports", () => {
    const cases: Array<Record<string, string>> = [
      ...Object.keys(STING_LOOK).map((kind) => ({ element: "sting", kind })),
      ...["drinks", "rain_delay", "timeout", "innings_break"].flatMap((kind) => [
        { element: "breakStrap", kind },
        { element: "breakStrap", kind, variant: "card" },
      ]),
      { element: "message", variant: "single" },
      { element: "message", variant: "double" },
      { element: "message", variant: "baseline" },
      { element: "batterLowerThird", variant: "figures" },
      { element: "batterLowerThird", variant: "last_out" },
      { element: "bowlerLowerThird", variant: "figures" },
      { element: "partnership", variant: "card" },
      { element: "partnership", variant: "split" },
      { element: "thisOver", variant: "card" },
      { element: "playingXi", variant: "team1" },
      { element: "playingXi", variant: "team2" },
      { element: "scorecard", variant: "batting" },
      { element: "playerProfile", variant: "tournament" },
      { element: "winPredictor", variant: "strap" },
      { element: "projectedScore", variant: "strap" },
      { element: "projectedScore", state: "first" },
      { element: "projectedScore", state: "first", variant: "strap" },
      { element: "scorecard", state: "first" },
    ];
    for (const c of cases) {
      const { container, unmount } = render(
        <OverlayGallery packageId={PKG} element={c.element!} {...c} />,
      );
      expect(
        container.querySelector(`[data-package="${PKG}"] [data-we]`)?.textContent?.trim(),
        JSON.stringify(c),
      ).toBeTruthy();
      unmount();
    }
  });

  it("draws nothing for an element with no data", () => {
    const empty: LiveMatchState = { ...DEMO_PRE_STATE, toss_winner_team_id: null };
    const { container } = render(
      <WorldEventScoreBug
        state={DEMO_MATCH_STATE}
        match={null}
        snapshots={null}
        theme={PKG}
        customColors={null}
        layout="bottom"
        sponsor={null}
        marginOffsetPx={0}
        phase="live"
      />,
    );
    expect(container.textContent).toContain(DEMO_MATCH_STATE.team1_short_name!);
    const Toss = WORLD_EVENT_PACKAGE.elements.toss!;
    const toss = render(
      <Toss state={empty} match={DEMO_MATCH_DETAILS} snapshots={null} theme={PKG} customColors={null} layout="bottom" />,
    );
    expect(toss.container.textContent).toBe("");
  });
});

describe("World event figures", () => {
  it("puts the chase first on the context line, with where it ends at this rate", () => {
    const chase = chaseLine(DEMO_MATCH_STATE)!;
    expect(finishAtCurrentRate(DEMO_MATCH_STATE, chase)).toBe(
      Math.round(
        DEMO_MATCH_STATE.total_runs! +
          (DEMO_MATCH_STATE.current_run_rate! * DEMO_MATCH_STATE.balls_remaining!) / 6,
      ),
    );
    expect(finishAtCurrentRate(DEMO_MATCH_STATE, null)).toBeNull();
    expect(liveContext(DEMO_MATCH_STATE)[0]).toBe(
      `Need ${chase.runsNeeded} runs from ${chase.ballsRemaining} balls`,
    );
    expect(liveContext(DEMO_MATCH_STATE)[1]).toContain(`Target ${chase.target}`);
    // First innings: the run rate leads.
    expect(liveContext(DEMO_FIRST_INNINGS_STATE)[0]).toMatch(/^Current run rate \d/);
  });

  it("draws this over's balls with the over's empty slots", () => {
    const { container } = render(<Balls tokens={["1", "wd", "4", "0", "W"]} slots={6} />);
    const chips = [...container.querySelectorAll("li")].map((li) => li.className);
    expect(chips.filter((c) => c.includes("we-ball-slot"))).toHaveLength(2);
    expect(chips.slice(0, 5).map((c) => c.match(/we-ball-(\w+)/)![1])).toEqual([
      "run", "extra", "four", "dot", "wicket",
    ]);
  });

  it("writes dismissals scorecard style from the fall of wickets", () => {
    const inn = DEMO_MATCH_DETAILS.innings![1]!;
    const out = inn.batting_performances!.find((b) => b.is_out && b.dismissal_type === "bowled")!;
    const fow = inn.fall_of_wickets!.find((f) => f.batsman_out_id === out.user_id)!;
    const bowler = inn.bowling_performances!.find((b) => b.user_id === fow.bowler_id)!;
    expect(dismissalText(out, inn)).toBe(`b ${bowler.user!.full_name.split(" ").slice(1).join(" ")}`);
    const notOut = inn.batting_performances!.find((b) => !b.is_out)!;
    expect(dismissalText(notOut, inn)).toBe("not out");
    const caught = { ...out, dismissal_type: "caught" };
    const withFielder = {
      ...inn,
      fall_of_wickets: inn.fall_of_wickets!.map((f) =>
        f.batsman_out_id === out.user_id
          ? { ...f, fielder: { id: "x", full_name: "Callum Price" } }
          : f,
      ),
    };
    expect(dismissalText(caught, withFielder)).toMatch(/^c Price b /);
    expect(dismissalText({ ...out, dismissal_type: "run_out" }, withFielder)).toBe("run out (Price)");
  });

  it("marks captains and keepers and keeps playing roles", () => {
    const team = {
      ...DEMO_MATCH_DETAILS.team1,
      captain_id: DEMO_MATCH_DETAILS.team1.team_players![1]!.user_id,
      team_players: DEMO_MATCH_DETAILS.team1.team_players!.map((p, i) =>
        i === 2 ? { ...p, role_in_team: "wicket_keeper" } : p,
      ),
    };
    const xi = xiOf(team);
    expect(xi).toHaveLength(11);
    expect(xi[0]).toMatchObject({ mark: "", role: "Batter" });
    expect(xi[1]!.mark).toBe("(c)");
    expect(xi[2]).toMatchObject({ mark: "(wk)", role: "Wicketkeeper" });
    expect(xiOf(null)).toEqual([]);
  });

  it("formats names, ordinals, titles, chips and NRR", () => {
    expect(bugName("Arjun Mehta")).toBe("A Mehta");
    expect(bugName("Madonna")).toBe("Madonna");
    expect(bugName("Christopher James Montgomery")).toBe("C James Montgomery");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 102].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "102nd",
    ]);
    expect(matchTitleOf(DEMO_MATCH_STATE)).toBe("Final");
    expect(matchTitleOf({ ...DEMO_MATCH_STATE, title: "Metro T20 League" })).toBeNull();
    expect(matchTitleOf({ ...DEMO_MATCH_STATE, title: "Semi-final 2" })).toBe("Semi-final 2");
    expect(ballLabel("0")).toBe("");
    expect(ballLabel("W+3")).toBe("W+3");
    expect(ballLabel("nb+1lb")).toBe("nb+1lb");
    const crest = render(<Crest n={1} code="RIV" name="Riverside Rangers" />);
    expect(crest.container.textContent).toBe("RR");
    const logo = render(<Crest n={2} code="HAW" name="Harbour Hawks" logo="/logo.png" />);
    expect(logo.container.querySelector("img")).not.toBeNull();
    expect(nrrText(0.912)).toBe("+0.912");
    expect(nrrText(-0.118)).toBe("-0.118");
    expect(nrrText(null)).toBe("–");
  });
});

describe("World event colours", () => {
  it("keeps text readable on its panels and the event accent", () => {
    expect(contrastRatio("#ffffff", WE.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", WE.night)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(WE.ink, WE.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(WE.inkMuted, WE.paperLow)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(WE.ink, WE.mint)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(WE.ink, WE.gold)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", WE.wicket)).toBeGreaterThanOrEqual(4.5);
  });

  it("gives any team colour readable text and stripes that show on both panels", () => {
    for (const primary of ["#f8fafc", "#fde68a", "#0f766e", "#b91c1c", "#000000", "#ffffff", "#7dd3fc"]) {
      const t = teamTone({ primary, secondary: null }, "#2f6fe4");
      expect(contrastRatio(t.text, t.base), primary).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.onLight, WE.paper), primary).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.onDark, WE.night), primary).toBeGreaterThanOrEqual(3);
    }
    // No colours: the event's two defaults.
    const vars = worldEventVars({ state: { ...DEMO_MATCH_STATE, team_colors: null }, theme: PKG, customColors: null });
    expect(vars["--we-t1"]).not.toBe(vars["--we-t2"]);
  });

  it("follows the result state's winner on the result card", () => {
    const Result = WORLD_EVENT_PACKAGE.elements.result!;
    render(
      <Result
        state={DEMO_RESULT_STATE}
        match={DEMO_RESULT_MATCH}
        snapshots={null}
        theme={PKG}
        customColors={null}
        layout="bottom"
        innings={DEMO_RESULT_MATCH.innings!}
      />,
    );
    expect(screen.getByTestId("we-result")).toHaveTextContent(DEMO_RESULT_STATE.result_description!);
    expect(screen.getByText("Won")).toBeInTheDocument();
  });
});
