import { describe, expect, it } from "vitest";
import {
  backLabelOf,
  matchTrail,
  navSectionOf,
  parentOf,
  teamTrail,
  tournamentTrail,
} from "./navigation";

describe("navSectionOf", () => {
  it.each([
    ["/", "home"],
    ["/dashboard", "home"],
    ["/matches", "matches"],
    ["/matches/abc", "matches"],
    ["/matches/create", "matches"],
    ["/tournaments/abc", "tournaments"],
    ["/clubs", "clubs"],
    ["/clubs/abc", "clubs"],
    ["/teams", "more"],
    ["/teams/abc", "more"],
    ["/players", "more"],
    ["/players/@rahul", "more"],
    ["/more", "more"],
    ["/invitations", "more"],
  ])("puts %s under %s", (path, section) => {
    expect(navSectionOf(path)).toBe(section);
  });

  it("does not take a longer name for a section", () => {
    expect(navSectionOf("/matchesque")).toBeNull();
    expect(navSectionOf("/search")).toBeNull();
  });
});

describe("a page's parent comes from what it shows", () => {
  const tournament = { id: "t1", name: "Summer Cup" };
  const club = { id: "c1", name: "Lions CC" };

  it("a match sits in its tournament, then its club, then the list", () => {
    expect(parentOf(matchTrail({ tournament, club }))).toBe(
      "/tournaments/t1?tab=fixtures",
    );
    expect(parentOf(matchTrail({ club }))).toBe("/clubs/c1?tab=matches");
    expect(parentOf(matchTrail({}))).toBe("/matches");
  });

  it("a team sits in the tournament it is filtered to, then its club, then the list", () => {
    expect(parentOf(teamTrail({ club, tournament }))).toBe(
      "/tournaments/t1?tab=teams",
    );
    expect(parentOf(teamTrail({ club }))).toBe("/clubs/c1?tab=teams");
    expect(parentOf(teamTrail({}))).toBe("/teams");
  });

  it("a tournament sits in its club, else the list", () => {
    expect(parentOf(tournamentTrail({ club }))).toBe(
      "/clubs/c1?tab=tournaments",
    );
    expect(parentOf(tournamentTrail({ club: null }))).toBe("/tournaments");
  });

  it("names Back after where it goes", () => {
    expect(backLabelOf(matchTrail({ club }))).toBe("Back to Lions CC");
    expect(backLabelOf(matchTrail({}))).toBe("Back to Matches");
  });

  it("survives a parent with no name yet", () => {
    expect(matchTrail({ club: { id: "c1" } })[1]?.label).toBe("Club");
  });
});
