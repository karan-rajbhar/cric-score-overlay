import { beforeEach, describe, expect, it } from "vitest";
import { backTarget, noteVisit, resetVisits } from "./in-app-history";

const browserBack = () => window.dispatchEvent(new PopStateEvent("popstate"));

describe("in-app history", () => {
  beforeEach(() => resetVisits());

  it("knows nothing before the first step, so Back uses the page's parent", () => {
    noteVisit("/matches/m1", 1);
    expect(backTarget()).toBeNull();
  });

  it("follows each step", () => {
    noteVisit("/clubs/c1", 1);
    noteVisit("/matches/m1", 2);
    expect(backTarget()).toBe("/clubs/c1");
    noteVisit("/players/p1", 3);
    expect(backTarget()).toBe("/matches/m1");
  });

  it("takes a step off on going back, so it never walks out of the app", () => {
    noteVisit("/clubs/c1", 1);
    noteVisit("/matches/m1", 2);
    browserBack();
    noteVisit("/clubs/c1", 2);
    expect(backTarget()).toBeNull();
  });

  it("does not count a change on the same page", () => {
    noteVisit("/clubs/c1", 1);
    noteVisit("/clubs/c1", 1);
    expect(backTarget()).toBeNull();
  });

  it("a replace takes the old page's place, as it does in the browser", () => {
    // A match opened from a shared link, deleted: the app replaces it with
    // the club. Back must not go through history, out of the app.
    noteVisit("/matches/m1", 1);
    noteVisit("/clubs/c1", 1);
    expect(backTarget()).toBeNull();
  });

  it("keeps what came before a replace", () => {
    noteVisit("/clubs/c1", 1);
    noteVisit("/matches/m1", 2);
    noteVisit("/tournaments/t1", 2);
    expect(backTarget()).toBe("/clubs/c1");
  });

  it.each(["/clubs/create", "/matches/create", "/teams/create", "/auth/login"])(
    "never returns to the spent page %s",
    (spent) => {
      noteVisit(spent, 1);
      noteVisit("/clubs/c1", 2);
      expect(backTarget()).toBeNull();
    },
  );

  it("skips a page that would send you straight back", () => {
    noteVisit("/matches/m1/score", 1);
    noteVisit("/matches/m1", 2);
    expect(backTarget("/matches/m1/score")).toBeNull();
    expect(backTarget()).toBe("/matches/m1/score");
  });
});
