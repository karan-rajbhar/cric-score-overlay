import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import { overlayPhaseOf } from "../../score-bug";
import type { LayoutMode } from "../../types";
import { GALLERY_STATES, OverlayGallery } from "../gallery";
import { OverlayPackageScope, resolveOverlayPackage } from "../registry";
import { OVERLAY_ELEMENTS, type OverlayElementProps } from "../types";
import { HUNDRED_BALL } from "./index";

const ID = "hundred-ball";

function gallery(element: string, opts: Record<string, string> = {}) {
  return render(<OverlayGallery packageId={ID} element={element} {...opts} />);
}

/** The package's own root drew something (text or a chart). */
function drewOwn(container: HTMLElement): boolean {
  const own = container.querySelector("[data-hb]");
  return !!own && (!!own.textContent?.trim() || !!own.querySelector("svg"));
}

describe("the Hundred-ball package", () => {
  it("is registered and draws all 33 elements itself", () => {
    expect(resolveOverlayPackage(ID).id).toBe(ID);
    expect(Object.keys(HUNDRED_BALL.elements).sort()).toEqual([...OVERLAY_ELEMENTS].sort());
    expect(HUNDRED_BALL.kind).toBe("broadcast");
    for (const el of OVERLAY_ELEMENTS) {
      expect(HUNDRED_BALL.motion?.[el]?.exit, el).toBeTruthy();
    }
  });

  it.each(OVERLAY_ELEMENTS)("draws %s in every state without failing", (element) => {
    for (const state of GALLERY_STATES) {
      const { container, unmount } = gallery(element, { state });
      expect(container.querySelector(`[data-gallery-element="${element}"]`)).not.toBeNull();
      unmount();
    }
  });

  it.each(OVERLAY_ELEMENTS)("draws %s in its own look in its main state", (element) => {
    const { container, unmount } = gallery(element);
    expect(drewOwn(container), element).toBe(true);
    unmount();
  });

  it("draws every variant and kind it lists", () => {
    const cases: Array<Record<string, string>> = [
      { element: "batterLowerThird", variant: "figures" },
      { element: "batterLowerThird", variant: "last_out" },
      { element: "partnership", variant: "card" },
      { element: "partnership", variant: "split" },
      { element: "thisOver", variant: "card" },
      { element: "scorecard", variant: "batting" },
      { element: "playingXi", variant: "team1" },
      { element: "playingXi", variant: "team2" },
      { element: "playerProfile", variant: "tournament" },
      { element: "winPredictor", variant: "strap" },
      { element: "projectedScore", variant: "strap" },
      { element: "message", variant: "single" },
      { element: "message", variant: "baseline" },
      ...["four", "six", "wicket", "fifty", "hundred", "three_for", "five_for", "hat_trick", "free_hit"].map(
        (kind) => ({ element: "sting", kind }),
      ),
      ...["drinks", "rain_delay", "timeout", "innings_break"].flatMap((kind) => [
        { element: "breakStrap", kind },
        { element: "breakStrap", kind, variant: "card" },
      ]),
    ];
    for (const c of cases) {
      const { container, unmount } = gallery(c.element!, c);
      expect(drewOwn(container), JSON.stringify(c)).toBe(true);
      unmount();
    }
  });

  it("shows no powerplay strap when no powerplay is on", () => {
    const { container } = gallery("breakStrap", { kind: "powerplay" });
    expect(container.querySelector("[data-hb]")).toBeNull();
  });
});

describe("its signature pieces", () => {
  const s = DEMO_MATCH_STATE;

  it("counts balls left on the bug and puts the chase in one statement", () => {
    gallery("scoreBug");
    expect(screen.getByText("Balls left")).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Needs ${s.runs_needed} from ${s.balls_remaining} balls`),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(`${s.total_runs} for ${s.total_wickets}`)).toBeInTheDocument();
  });

  it("states the chase as needs X from Y balls", () => {
    gallery("chase");
    expect(
      screen.getByLabelText(`Needs ${s.runs_needed} from ${s.balls_remaining} balls`),
    ).toBeInTheDocument();
  });

  it("shows a bowler as wickets-runs from N balls", () => {
    gallery("bowlerLowerThird");
    expect(screen.getByText(`From ${s.bowler_balls} balls`)).toBeInTheDocument();
    expect(
      screen.getByLabelText(`${s.bowler_wickets} for ${s.bowler_runs}`),
    ).toBeInTheDocument();
  });

  it.each<LayoutMode>(["bottom", "top", "compact", "broadcast"])(
    "draws the %s bug layout",
    (layout) => {
      const Bug = HUNDRED_BALL.elements.scoreBug!;
      const props: OverlayElementProps["scoreBug"] = {
        state: s,
        match: DEMO_MATCH_DETAILS,
        snapshots: null,
        theme: ID,
        customColors: null,
        layout,
        sponsor: null,
        marginOffsetPx: 0,
        phase: overlayPhaseOf(s),
      };
      const { container } = render(
        <OverlayPackageScope theme={ID} customColors={null} state={s}>
          <Bug {...props} />
        </OverlayPackageScope>,
      );
      expect(container.querySelector(`[data-layout="${layout}"]`)).not.toBeNull();
      expect(container.textContent).toContain(String(s.total_runs));
    },
  );

  it("never pins live figures on someone else's name", () => {
    const Batter = HUNDRED_BALL.elements.batterLowerThird!;
    const base = {
      state: s,
      match: null,
      snapshots: null,
      theme: ID,
      customColors: null,
      layout: "bottom" as const,
      slot: "striker" as const,
      variant: "strap" as const,
    };
    const { unmount } = render(
      <Batter {...base} strap={{ id: "a", type: "batsman", title: "" }} />,
    );
    expect(screen.getByText(s.striker_name!)).toBeInTheDocument();
    expect(screen.getByText("Runs")).toBeInTheDocument();
    unmount();
    render(
      <Batter {...base} strap={{ id: "b", type: "batsman", title: "Someone Else", subtitle: "Guest" }} />,
    );
    expect(screen.getByText("Someone Else")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.queryByText("Runs")).toBeNull();
  });

  it("keeps a long name on one truncated line", () => {
    const Bowler = HUNDRED_BALL.elements.bowlerLowerThird!;
    const name = "Bartholomew Featherstone";
    expect(name).toHaveLength(24);
    render(
      <Bowler
        state={{ ...s, current_bowler_name: name }}
        match={null}
        snapshots={null}
        theme={ID}
        customColors={null}
        layout="bottom"
        variant="figures"
        strap={null}
      />,
    );
    expect(screen.getByText(name)).toHaveClass("truncate");
  });
});
