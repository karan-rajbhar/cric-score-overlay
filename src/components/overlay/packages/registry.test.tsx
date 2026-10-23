import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../sound-effects", () => ({
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
import { OverlayStage } from "../overlay-stage";
import { overlayPalette } from "../overlay-themes";
import type { OverlayLayers } from "../use-overlay-state";
import { AnimatedNumber, MOTION, MotionPreferenceContext } from "./motion";
import {
  OVERLAY_PACKAGES,
  OverlayPackageScope,
  resolveOverlayPackage,
} from "./registry";
import type { BroadcastPackage } from "./types";

const TEST_ID = "test-stripes";

const testPackage: BroadcastPackage = {
  id: TEST_ID,
  kind: "broadcast",
  palette: () => ({ ...overlayPalette("standard"), bar: "#123456" }),
  vars: () => ({ "--pkg-stripe": "#ff0066" }),
  fonts: { className: "font-test-pkg", display: "'Test Display', sans-serif" },
  motion: {
    sting: { enter: MOTION.slideUp(300), exit: MOTION.slideDown(200) },
  },
  elements: {
    scoreBug: ({ state }) => (
      <div data-testid="pkg-bug">
        Stripes {state.total_runs}/{state.total_wickets}
      </div>
    ),
  },
};

const layers = (over: Partial<OverlayLayers> = {}): OverlayLayers => ({
  scene: { ...DEFAULT_SCENE, theme: TEST_ID },
  sting: null,
  strap: null,
  card: "none",
  ...over,
});

function stage(over: Partial<OverlayLayers> = {}, preview = false) {
  return render(
    <OverlayStage
      state={DEMO_MATCH_STATE}
      match={DEMO_MATCH_DETAILS}
      layers={layers(over)}
      onDismissSting={() => {}}
      onDismissStrap={() => {}}
      preview={preview}
    />,
  );
}

type Anim = { keyframes: Keyframe[]; finish: () => void; cancel: () => void };
let anims: Anim[] = [];

beforeEach(() => {
  OVERLAY_PACKAGES[TEST_ID] = testPackage;
  anims = [];
  (HTMLElement.prototype as unknown as { animate: unknown }).animate =
    function (keyframes: Keyframe[]) {
      const a = {
        keyframes,
        onfinish: null as null | (() => void),
        finish() {
          this.onfinish?.();
        },
        cancel() {},
      };
      anims.push(a);
      return a;
    };
});

afterEach(() => {
  delete OVERLAY_PACKAGES[TEST_ID];
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
});

describe("resolveOverlayPackage", () => {
  it("knows the plain packages and sends anything else to Standard", () => {
    for (const id of ["standard", "light", "team", "custom"]) {
      expect(resolveOverlayPackage(id).id).toBe(id);
    }
    expect(resolveOverlayPackage("starsports").id).toBe("standard");
    expect(resolveOverlayPackage("nope").id).toBe("standard");
    expect(resolveOverlayPackage(TEST_ID).id).toBe(TEST_ID);
  });
});

describe("the stage with a package", () => {
  it("draws the package's elements and falls back to Standard per element", () => {
    stage({
      strap: { id: "s", type: "batsman", title: "" },
    });
    // The package's score bug...
    expect(screen.getByTestId("pkg-bug")).toHaveTextContent(
      `Stripes ${DEMO_MATCH_STATE.total_runs}/${DEMO_MATCH_STATE.total_wickets}`,
    );
    expect(screen.queryByTestId("score-bug")).toBeNull();
    // ...and Standard's lower third, in the package's palette.
    expect(screen.getByText(DEMO_MATCH_STATE.striker_name!)).toBeInTheDocument();
    const root = document.querySelector(`[data-package="${TEST_ID}"]`) as HTMLElement;
    expect(root.style.getPropertyValue("--ov-bar")).toBe("#123456");
    expect(root.style.getPropertyValue("--pkg-stripe")).toBe("#ff0066");
    expect(root.style.getPropertyValue("--pkg-font-display")).toBe(
      "'Test Display', sans-serif",
    );
    expect(root.className).toContain("font-test-pkg");
    const strap = document.querySelector("[data-strap-type]") as HTMLElement;
    expect(strap.style.getPropertyValue("--ov-bar")).toBe("#123456");
  });

  it("plays an element's enter and keeps it on air until its exit ends", () => {
    const sting = {
      id: "x",
      type: "six" as const,
      title: "Six",
      durationMs: 5000,
    };
    const view = stage({ sting });
    expect(screen.getByRole("status")).toHaveTextContent("Six");
    expect(anims[0]?.keyframes).toEqual(MOTION.slideUp(300).keyframes);

    view.rerender(
      <OverlayStage
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
        layers={layers({ sting: null })}
        onDismissSting={() => {}}
        onDismissStrap={() => {}}
      />,
    );
    // Still drawn while the exit plays.
    expect(screen.getByRole("status")).toBeInTheDocument();
    const exit = anims.at(-1)!;
    expect(exit.keyframes).toEqual(MOTION.slideDown(200).keyframes);
    act(() => exit.finish());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("draws the plain packages exactly as before (no motion layer)", () => {
    render(
      <OverlayStage
        state={DEMO_MATCH_STATE}
        match={DEMO_MATCH_DETAILS}
        layers={{ ...layers(), scene: DEFAULT_SCENE }}
        onDismissSting={() => {}}
        onDismissStrap={() => {}}
      />,
    );
    expect(screen.getByTestId("score-bug")).toBeInTheDocument();
    expect(document.querySelector("[data-element]")).toBeNull();
    expect(anims).toHaveLength(0);
  });
});

describe("motion preferences", () => {
  const reduce = (on: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      (q: string) => ({ matches: on && q.includes("reduce"), media: q }),
    );
  afterEach(() => vi.unstubAllGlobals());

  it("previews honour reduced motion; the OBS output always animates", () => {
    reduce(true);
    stage({ sting: { id: "p", type: "four", title: "Four", durationMs: 4000 } }, true);
    expect(anims).toHaveLength(0);
    stage({ sting: { id: "o", type: "four", title: "Four", durationMs: 4000 } }, false);
    expect(anims.length).toBeGreaterThan(0);
  });

  it("rolls a figure when it changes", () => {
    reduce(false);
    const view = render(
      <MotionPreferenceContext.Provider value={{ respectReducedMotion: false }}>
        <AnimatedNumber value={138} />
      </MotionPreferenceContext.Provider>,
    );
    expect(anims).toHaveLength(0);
    view.rerender(
      <MotionPreferenceContext.Provider value={{ respectReducedMotion: false }}>
        <AnimatedNumber value={142} />
      </MotionPreferenceContext.Provider>,
    );
    expect(screen.getByText("142")).toBeInTheDocument();
    expect(anims).toHaveLength(1);
  });

  it("scopes a package for any children (the gallery)", () => {
    render(
      <OverlayPackageScope theme={TEST_ID} customColors={null} state={DEMO_MATCH_STATE}>
        <span>inside</span>
      </OverlayPackageScope>,
    );
    expect(screen.getByText("inside").closest(`[data-package="${TEST_ID}"]`)).not.toBeNull();
  });
});
