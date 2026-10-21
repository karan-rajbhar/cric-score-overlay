import { render, screen, fireEvent } from "@testing-library/react";
import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

describe("Tabs UI Primitives", () => {
  it("renders TabsList with justify-start and proper accessible attributes", () => {
    render(
      <Tabs defaultValue="first">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="first">First Tab</TabsTrigger>
          <TabsTrigger value="second">Second Tab</TabsTrigger>
        </TabsList>
        <TabsContent value="first">First content</TabsContent>
        <TabsContent value="second">Second content</TabsContent>
      </Tabs>,
    );

    const list = screen.getByTestId("tabs-list");
    expect(list).toBeInTheDocument();
    expect(list.className).toContain("justify-start");
    expect(list.className).not.toContain("justify-center");

    const firstTrigger = screen.getByRole("tab", { name: "First Tab" });
    expect(firstTrigger.className).toContain("shrink-0");
  });

  it("switches tab content on click", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Tab 1 Content</TabsContent>
        <TabsContent value="tab2">Tab 2 Content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText("Tab 1 Content")).toBeInTheDocument();
    expect(screen.queryByText("Tab 2 Content")).not.toBeInTheDocument();

    const tab2 = screen.getByRole("tab", { name: "Tab 2" });
    fireEvent.pointerDown(tab2, { button: 0, ctrlKey: false });
    fireEvent.click(tab2);
    fireEvent.keyDown(tab2, { key: "Enter" });
    fireEvent.keyDown(tab2, { key: " " });

    expect(screen.getByText("Tab 2 Content")).toBeInTheDocument();
    expect(screen.queryByText("Tab 1 Content")).not.toBeInTheDocument();
  });

  it("allows custom class override while maintaining start-aligned layout for overflowing tabs", () => {
    render(
      <Tabs defaultValue="summary">
        <TabsList
          data-testid="overflow-list"
          className="flex h-auto w-full justify-start overflow-x-auto no-scrollbar gap-1 rounded-xl p-1"
        >
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
          <TabsTrigger value="superstars">Super Stars</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">Summary Content</TabsContent>
      </Tabs>,
    );

    const list = screen.getByTestId("overflow-list");
    expect(list.className).toContain("justify-start");
    expect(list.className).toContain("overflow-x-auto");
    expect(list.className).not.toContain("justify-center");
  });

  describe("swiping", () => {
    function flick(el: Element, fromX: number, toX: number) {
      fireEvent.touchStart(el, {
        touches: [{ clientX: fromX, clientY: 200 }],
      });
      fireEvent.touchEnd(el, {
        changedTouches: [{ clientX: toX, clientY: 205 }],
      });
    }
    const active = () =>
      screen
        .getAllByRole("tab")
        .filter((t) => t.getAttribute("data-state") === "active")
        .map((t) => t.textContent);

    function Nested({ portal }: { portal?: Element }) {
      return (
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <p data-testid="summary">Summary panel</p>
            {portal && createPortal(<p data-testid="dialog">Dialog</p>, portal)}
          </TabsContent>
          <TabsContent value="scorecard">
            <Tabs defaultValue="inn1">
              <TabsList>
                <TabsTrigger value="inn1">Innings 1</TabsTrigger>
                <TabsTrigger value="inn2">Innings 2</TabsTrigger>
              </TabsList>
              <TabsContent value="inn1">
                <p data-testid="card">First innings card</p>
              </TabsContent>
              <TabsContent value="inn2">
                <p data-testid="card">Second innings card</p>
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="stats">Stats panel</TabsContent>
        </Tabs>
      );
    }

    it("moves between tabs, and tabs inside a panel take the swipe first", () => {
      render(<Nested />);
      flick(screen.getByTestId("summary"), 300, 100);
      expect(active()).toEqual(["Scorecard", "Innings 1"]);
      // Inside the scorecard: its innings first...
      flick(screen.getByTestId("card"), 300, 100);
      expect(active()).toEqual(["Scorecard", "Innings 2"]);
      // ...then, past the last one, the page's tabs.
      flick(screen.getByTestId("card"), 300, 100);
      expect(active()).toEqual(["Stats"]);
      flick(screen.getByText("Stats panel"), 100, 300);
      expect(active()).toEqual(["Scorecard", "Innings 1"]);
      flick(screen.getByTestId("card"), 100, 300);
      expect(active()).toEqual(["Summary"]);
    });

    it("leaves touches from a portal (a dialog) and unswipeable tabs alone", () => {
      const portal = document.createElement("div");
      document.body.appendChild(portal);
      const { unmount } = render(<Nested portal={portal} />);
      flick(screen.getByTestId("dialog"), 300, 100);
      expect(active()).toEqual(["Summary"]);
      unmount();
      portal.remove();

      render(
        <Tabs defaultValue="a" swipeable={false}>
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel A</TabsContent>
        </Tabs>,
      );
      flick(screen.getByText("Panel A"), 300, 100);
      expect(active()).toEqual(["A"]);
    });
  });
});
