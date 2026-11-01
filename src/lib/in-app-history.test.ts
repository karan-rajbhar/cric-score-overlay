import { beforeEach, describe, expect, it } from "vitest";
import { noteVisit, previousPath, resetVisits } from "./in-app-history";

const browserBack = () => window.dispatchEvent(new PopStateEvent("popstate"));

describe("in-app history", () => {
  beforeEach(() => resetVisits());

  it("knows nothing before the first step, so Back uses the page's parent", () => {
    noteVisit("/matches/m1");
    expect(previousPath()).toBeNull();
  });

  it("follows each step", () => {
    noteVisit("/clubs/c1");
    noteVisit("/matches/m1");
    expect(previousPath()).toBe("/clubs/c1");
    noteVisit("/players/p1");
    expect(previousPath()).toBe("/matches/m1");
  });

  it("takes a step off on going back, so it never walks out of the app", () => {
    noteVisit("/clubs/c1");
    noteVisit("/matches/m1");
    browserBack();
    noteVisit("/clubs/c1");
    expect(previousPath()).toBeNull();
  });

  it("does not count a change on the same page", () => {
    noteVisit("/clubs/c1");
    noteVisit("/clubs/c1");
    expect(previousPath()).toBeNull();
  });
});
