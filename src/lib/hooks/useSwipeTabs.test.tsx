import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { swipeDirection, useSwipeTabs } from "./useSwipeTabs";

const at = (x: number, y: number, t = 0) => ({ x, y, t });

describe("swipeDirection", () => {
  it("reads a quick horizontal flick", () => {
    expect(swipeDirection(at(300, 100), at(150, 110, 200))).toBe(1);
    expect(swipeDirection(at(100, 100), at(260, 95, 200))).toBe(-1);
  });
  it("ignores short, mostly vertical or slow gestures", () => {
    expect(swipeDirection(at(200, 100), at(170, 100, 100))).toBe(0);
    expect(swipeDirection(at(200, 100), at(100, 220, 100))).toBe(0);
    expect(swipeDirection(at(300, 100), at(100, 100, 1500))).toBe(0);
  });
});

const TABS = ["summary", "scorecard", "balls"] as const;

function Panels() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("summary");
  const swipe = useSwipeTabs({ tabs: TABS, value: tab, onChange: setTab });
  return (
    <div data-testid="panels" {...swipe}>
      <p>tab:{tab}</p>
      <div data-testid="wide" style={{ overflowX: "auto" }}>
        table
      </div>
    </div>
  );
}

function flick(el: Element, fromX: number, toX: number) {
  fireEvent.touchStart(el, { touches: [{ clientX: fromX, clientY: 200 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: toX, clientY: 205 }] });
}

describe("useSwipeTabs", () => {
  it("moves to the next and previous tab, and stops at the ends", () => {
    render(<Panels />);
    const panels = screen.getByTestId("panels");
    flick(panels, 300, 100);
    expect(screen.getByText("tab:scorecard")).toBeInTheDocument();
    flick(panels, 300, 100);
    flick(panels, 300, 100);
    expect(screen.getByText("tab:balls")).toBeInTheDocument();
    flick(panels, 100, 300);
    expect(screen.getByText("tab:scorecard")).toBeInTheDocument();
  });

  it("leaves a swipe on something that scrolls sideways to it", () => {
    render(<Panels />);
    const wide = screen.getByTestId("wide");
    Object.defineProperty(wide, "scrollWidth", { value: 800 });
    Object.defineProperty(wide, "clientWidth", { value: 300 });
    flick(wide, 300, 100);
    expect(screen.getByText("tab:summary")).toBeInTheDocument();
  });
});
