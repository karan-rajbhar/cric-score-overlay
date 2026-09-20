import { render, screen, fireEvent } from "@testing-library/react";
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
});
