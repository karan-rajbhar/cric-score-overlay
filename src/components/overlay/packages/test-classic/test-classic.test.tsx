import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../sound-effects", () => ({
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
import { OverlayStage } from "../../overlay-stage";
import type { LiveMatchState } from "../../types";
import { OverlayElement } from "../element";
import { GALLERY_STATES, OverlayGallery, galleryElementProps } from "../gallery";
import { PACKAGE_MANIFEST } from "../manifest";
import { OVERLAY_PACKAGES, OverlayPackageScope, resolveOverlayPackage } from "../registry";
import { STANDARD_ELEMENTS } from "../standard";
import { OVERLAY_ELEMENTS, type OverlayElementId } from "../types";
import { TEST_CLASSIC_ID, testClassicPackage } from "./index";

const ID = TEST_CLASSIC_ID;

/** Every variant / kind each element takes in the gallery. */
const CASES: Partial<Record<OverlayElementId, Array<{ variant?: string; kind?: string }>>> = {
  batterLowerThird: [{}, { variant: "figures" }, { variant: "last_out" }],
  bowlerLowerThird: [{}, { variant: "figures" }],
  partnership: [{}, { variant: "card" }, { variant: "split" }],
  thisOver: [{}, { variant: "card" }],
  sting: [
    "four", "six", "wicket", "fifty", "hundred", "three_for", "five_for", "hat_trick", "free_hit", "milestone",
  ].map((kind) => ({ kind })),
  scorecard: [{}, { variant: "batting" }],
  playingXi: [{}, { variant: "team1" }, { variant: "team2" }],
  playerProfile: [{}, { variant: "tournament" }],
  winPredictor: [{}, { variant: "strap" }],
  projectedScore: [{}, { variant: "strap" }],
  breakStrap: ["drinks", "rain_delay", "timeout", "innings_break", "powerplay"].flatMap((kind) => [
    { kind },
    { kind, variant: "card" },
  ]),
  message: [{ variant: "double" }, { variant: "single" }, { variant: "baseline" }],
};

/**
 * Where Standard draws a card with nothing to say (a "0 runs" partnership
 * with nobody at the crease, an empty over between innings, a result card
 * with no result) and this package, by design, draws nothing.
 */
const STANDARD_WITHOUT_DATA = new Set([
  'partnership pre {"variant":"card"}',
  'partnership pre {"variant":"split"}',
  'partnership break {"variant":"card"}',
  'partnership break {"variant":"split"}',
  'thisOver break {"variant":"card"}',
  "result pre {}",
  "result first {}",
  "result live {}",
  "result break {}",
]);

function drawn(pkg: string, element: string, state: string, c: { variant?: string; kind?: string }) {
  const view = render(
    <OverlayGallery packageId={pkg} element={element} state={state} variant={c.variant} kind={c.kind} />,
  );
  const root = view.container.querySelector(`[data-package="${pkg}"]`);
  const shows = !!(root?.textContent?.trim() || root?.querySelector("svg"));
  const ours = !!root?.querySelector("[data-tc-root]");
  view.unmount();
  return { shows, ours };
}

beforeEach(() => {
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = function () {
    return { finish() {}, cancel() {}, onfinish: null };
  };
});
afterEach(() => {
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
});

describe("the Test classic package", () => {
  it("is registered and named as a broadcast package", () => {
    expect(resolveOverlayPackage(ID)).toBe(testClassicPackage);
    expect(OVERLAY_PACKAGES[ID]).toBe(testClassicPackage);
    const entry = PACKAGE_MANIFEST.find((p) => p.id === ID);
    expect(entry).toMatchObject({ label: "Test classic", kind: "broadcast" });
  });

  it("draws all 33 elements itself, each with its own motion", () => {
    for (const el of OVERLAY_ELEMENTS) {
      expect(testClassicPackage.elements[el], el).toBeTypeOf("function");
      expect(testClassicPackage.elements[el], el).not.toBe(STANDARD_ELEMENTS[el]);
      expect(testClassicPackage.motion?.[el]?.enter, el).toBeTruthy();
      expect(testClassicPackage.motion?.[el]?.exit, el).toBeTruthy();
    }
  });

  it("gives the stage its palette, team stripes and font stacks", () => {
    const ctx = { state: DEMO_MATCH_STATE, theme: ID, customColors: null };
    const palette = testClassicPackage.palette(ctx);
    expect(palette.bar).toBe("#10254a");
    expect(palette.card).toBe("#f3ecda");
    const vars = testClassicPackage.vars!(ctx);
    expect(vars["--tc-team1"]).toBe(DEMO_MATCH_STATE.team_colors!.team1!.primary);
    expect(vars["--tc-team2"]).toBe(DEMO_MATCH_STATE.team_colors!.team2!.primary);
    expect(testClassicPackage.fonts?.display).toContain("Libre Baskerville");
    expect(testClassicPackage.fonts?.text).toContain("Fira Sans Condensed");
    expect(testClassicPackage.fonts?.figures).toContain("Libre Baskerville");
  });
});

describe("every element in every state", () => {
  it.each(OVERLAY_ELEMENTS)("%s: draws wherever Standard has something to show", (element) => {
    const misses: string[] = [];
    for (const state of GALLERY_STATES) {
      for (const c of CASES[element] ?? [{}]) {
        const std = drawn("standard", element, state, c);
        const ours = drawn(ID, element, state, c);
        // Never Standard's component: when it draws, it is ours.
        if (ours.shows) expect(ours.ours, `${element} ${state} ${JSON.stringify(c)}`).toBe(true);
        const name = `${element} ${state} ${JSON.stringify(c)}`;
        if (std.shows && !ours.shows && !STANDARD_WITHOUT_DATA.has(name)) misses.push(name);
      }
    }
    expect(misses, element).toEqual([]);
  });

  it("draws the main elements from the demo match (no empty gallery pages)", () => {
    const mustDraw: Array<[OverlayElementId, string, { variant?: string; kind?: string }]> = [
      ["scoreBug", "live", {}],
      ["scoreBug", "pre", {}],
      ["scoreBug", "break", {}],
      ["scoreBug", "result", {}],
      ["batterLowerThird", "live", {}],
      ["bowlerLowerThird", "live", { variant: "figures" }],
      ["sting", "live", { kind: "hundred" }],
      ["scorecard", "live", {}],
      ["fallOfWickets", "live", {}],
      ["partnership", "live", { variant: "card" }],
      ["runsPerOver", "live", {}],
      ["wagonWheel", "live", {}],
      ["result", "result", {}],
    ];
    for (const [el, state, c] of mustDraw) {
      expect(drawn(ID, el, state, c).shows, `${el} ${state}`).toBe(true);
    }
  });
});

describe("what the graphics say", () => {
  function show(el: OverlayElementId, opts: { state?: LiveMatchState; layout?: string; kind?: string; variant?: string } = {}) {
    const props = galleryElementProps(el, { state: "live", theme: ID, kind: opts.kind, variant: opts.variant });
    const p = { ...props, ...(opts.state ? { state: opts.state } : {}), ...(opts.layout ? { layout: opts.layout } : {}) };
    return render(
      <OverlayPackageScope theme={ID} customColors={null} state={p.state ?? DEMO_MATCH_STATE}>
        <OverlayElement id={el} present props={p as never} />
      </OverlayPackageScope>,
    );
  }

  it("puts the chase in the bug's tab and the partnership first on its strip", () => {
    show("scoreBug");
    const bug = screen.getByTestId("score-bug");
    expect(bug).toHaveTextContent(
      `Need ${DEMO_MATCH_STATE.runs_needed} from ${DEMO_MATCH_STATE.balls_remaining} balls`,
    );
    expect(bug).toHaveTextContent(`Partnership${DEMO_MATCH_STATE.partnership_runs} (${DEMO_MATCH_STATE.partnership_balls})`);
    expect(bug).toHaveTextContent(`${DEMO_MATCH_STATE.total_runs}-${DEMO_MATCH_STATE.total_wickets}`);
    expect(screen.getByRole("list", { name: "This over" })).toBeInTheDocument();
  });

  it("draws the bug in its top and compact layouts", () => {
    const top = show("scoreBug", { layout: "top" });
    expect(screen.getByTestId("score-bug").dataset.layout).toBe("top");
    top.unmount();
    show("scoreBug", { layout: "compact" });
    expect(screen.getByTestId("score-bug")).toHaveTextContent(DEMO_MATCH_STATE.striker_name!);
  });

  it("closes the standing slot when there is none", () => {
    show("scoreBug", {
      state: { ...DEMO_MATCH_STATE, innings_number: 1, target_runs: null, runs_needed: null, balls_remaining: null },
    });
    const bug = screen.getByTestId("score-bug");
    expect(bug).not.toHaveTextContent(/Need|Lead|Trail|Target/);
    // Never a day or a session: the live row has none.
    expect(bug).not.toHaveTextContent(/Day \d|Session|Stumps|Lunch|Tea/);
  });

  it("puts a milestone on an honours board with the opponent, ground and year", () => {
    show("sting", { kind: "hundred" });
    const board = document.querySelector("[data-honours-board]");
    expect(board).not.toBeNull();
    expect(board).toHaveTextContent("Century");
    expect(board).toHaveTextContent(DEMO_MATCH_STATE.striker_name!);
    expect(board).toHaveTextContent(`v ${DEMO_MATCH_STATE.bowling_team_name}`);
    expect(board).toHaveTextContent(DEMO_MATCH_STATE.venue!);
  });

  it("writes the batting card in the scorecard tradition", () => {
    show("scorecard");
    expect(screen.getAllByText("not out").length).toBeGreaterThan(0);
    expect(screen.getByText("Fall of wickets")).toBeInTheDocument();
    expect(screen.getByText(/Yet to bat/i)).toBeInTheDocument();
  });
});

describe("on the stage", () => {
  it("is what the overlay draws for the test-classic theme", () => {
    render(
      <OverlayStage
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
        layers={{
          scene: { ...DEFAULT_SCENE, theme: ID },
          sting: { id: "s", type: "four", title: "Four", subtitle: DEMO_MATCH_STATE.striker_name!, durationMs: 4000 },
          strap: { id: "t", type: "bowler", title: "" },
          card: "none",
        }}
        onDismissSting={() => {}}
        onDismissStrap={() => {}}
      />,
    );
    expect(document.querySelector(`[data-package="${ID}"]`)).not.toBeNull();
    expect(screen.getByTestId("score-bug").closest("[data-tc-root]")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Four");
    expect(document.querySelector('[data-strap-type="bowler"]')).toHaveTextContent(
      DEMO_MATCH_STATE.current_bowler_name!,
    );
  });
});
