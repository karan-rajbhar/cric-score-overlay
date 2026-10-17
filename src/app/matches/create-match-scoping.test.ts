import { describe, expect, it } from "vitest";
import { teamGroups, type SetupTeam } from "./create/match-setup";

const teams: SetupTeam[] = [
  { id: "team-my-1", name: "My Squad A", created_by: "user-1" },
  { id: "team-my-2", name: "My Squad B", created_by: "user-1" },
  { id: "team-club-1", name: "Club Squad Alpha", club_id: "club-123" },
  { id: "team-club-2", name: "Club Squad Beta", club_id: "club-123" },
  { id: "team-other-club", name: "Rival Club Team", club_id: "club-999" },
  { id: "team-stranger", name: "Random User Team", created_by: "user-999" },
];

// The user plays for team-club-1 but does not run club-123.
function opponents(opts: {
  teams?: SetupTeam[];
  team1Id: string;
  tournamentId?: string;
  clubId?: string;
  tournamentTeamIds?: Set<string>;
}) {
  const groups = teamGroups({
    teams: opts.teams ?? teams,
    userId: "user-1",
    playerTeamIds: ["team-club-1"],
    clubAdminIds: new Set(),
    tournamentId: opts.tournamentId ?? "",
    clubId: opts.clubId ?? "",
    tournamentTeamIds: opts.tournamentTeamIds ?? new Set(),
    isTournamentOrganizer: false,
  });
  // The picker leaves out the team already chosen on the other side.
  return groups.team2
    .flatMap((g) => g.teams)
    .map((t) => t.id)
    .filter((id) => id !== opts.team1Id);
}

describe("Create match: opponent scoping", () => {
  it("tournament match: only teams registered in the tournament", () => {
    expect(
      opponents({
        team1Id: "team-my-1",
        tournamentId: "tourn-1",
        tournamentTeamIds: new Set(["team-my-1", "team-stranger"]),
      }),
    ).toEqual(["team-stranger"]);
  });

  it("club match: club squads and the user's other squads", () => {
    const ids = opponents({ team1Id: "team-club-1", clubId: "club-123" });
    expect(ids).toEqual(
      expect.arrayContaining(["team-club-2", "team-my-1", "team-my-2"]),
    );
    expect(ids).not.toContain("team-other-club");
    expect(ids).not.toContain("team-stranger");
  });

  it("friendly match: only teams the user has a stake in", () => {
    const ids = opponents({ team1Id: "team-my-1" });
    expect(ids).toEqual(["team-my-2", "team-club-1"]);
    expect(ids).not.toContain("team-club-2");
    expect(ids).not.toContain("team-stranger");
  });

  it("a team created in the form is eligible straight away", () => {
    const quick = {
      id: "team-quick-opp",
      name: "Friendly Opponents XI",
      created_by: "user-1",
    };
    expect(
      opponents({ teams: [...teams, quick], team1Id: "team-my-1" }),
    ).toContain("team-quick-opp");
  });

  it("host side: organizers also see tournament and club teams", () => {
    const groups = teamGroups({
      teams,
      userId: "user-1",
      playerTeamIds: [],
      clubAdminIds: new Set(["club-999"]),
      tournamentId: "tourn-1",
      clubId: "",
      tournamentTeamIds: new Set(["team-stranger"]),
      isTournamentOrganizer: true,
    });
    expect(groups.team1.map((g) => g.label)).toEqual([
      "My teams",
      "Tournament teams",
    ]);
    // A club admin's club teams count as their own.
    expect(groups.team1[0]!.teams.map((t) => t.id)).toContain(
      "team-other-club",
    );
    expect(groups.team1[1]!.teams.map((t) => t.id)).toEqual(["team-stranger"]);
  });
});
