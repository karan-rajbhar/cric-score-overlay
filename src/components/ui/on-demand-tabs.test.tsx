import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnDemandPanels, OnDemandTabs } from "./on-demand-tabs";
import { TabsContent, TabsList, TabsTrigger } from "./tabs";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function renderTabs() {
  return render(
    <OnDemandTabs
      fallback="teams"
      tabs={["teams", "stats", "members"]}
      onDemand={["stats", "members"]}
    >
      <TabsList>
        <TabsTrigger value="teams">Teams</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
      </TabsList>
      <TabsContent value="teams">the teams</TabsContent>
      <OnDemandPanels>the page</OnDemandPanels>
    </OnDemandTabs>,
  );
}

const open = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

beforeEach(() => {
  replace.mockClear();
  window.history.replaceState(null, "", "/clubs/c1");
});

describe("OnDemandTabs", () => {
  it("opens the plain URL on the fallback tab, reading nothing", () => {
    renderTabs();
    expect(screen.getByText("the teams")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens the tab a link names", () => {
    window.history.replaceState(null, "", "/clubs/c1?tab=stats");
    renderTabs();
    expect(screen.getByText("the page")).toBeInTheDocument();
  });

  it("ignores a tab this page does not offer", () => {
    window.history.replaceState(null, "", "/clubs/c1?tab=nonsense");
    renderTabs();
    expect(screen.getByText("the teams")).toBeInTheDocument();
  });

  it("fetches a costly tab when it is opened", () => {
    renderTabs();
    open("Stats");
    expect(replace).toHaveBeenCalledWith("/clubs/c1?tab=stats", {
      scroll: false,
    });
  });

  it("shows a skeleton, never another tab's content, until it arrives", () => {
    window.history.replaceState(null, "", "/clubs/c1?tab=stats");
    renderTabs();
    open("Members");
    expect(screen.queryByText("the page")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("does not fetch a cheap tab", () => {
    window.history.replaceState(null, "", "/clubs/c1?tab=stats");
    renderTabs();
    open("Teams");
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("does not fetch again on coming back from a cheap tab", () => {
    renderTabs();
    open("Stats");
    open("Teams");
    open("Stats");
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does not fetch the tab the page opened on", () => {
    window.history.replaceState(null, "", "/clubs/c1?tab=stats");
    renderTabs();
    open("Stats");
    expect(replace).not.toHaveBeenCalled();
  });

  it("fetches again once another costly tab has replaced it", () => {
    renderTabs();
    open("Stats");
    open("Members");
    open("Stats");
    expect(replace).toHaveBeenCalledTimes(3);
  });

  it("keeps the other parameters in the URL", () => {
    window.history.replaceState(null, "", "/clubs/c1?matches=100");
    renderTabs();
    open("Members");
    expect(replace).toHaveBeenCalledWith("/clubs/c1?matches=100&tab=members", {
      scroll: false,
    });
  });
});
