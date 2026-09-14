import { describe, expect, it } from "vitest";

interface TeamItem {
  id: string;
  name: string;
  club_id?: string | null;
  created_by?: string;
  captain_id?: string;
  vice_captain_id?: string;
}

// Scoping logic matching src/app/matches/create/page.tsx
function getEligibleOpponents({
  teams,
  team1Id,
  tournamentId,
  clubId,
  tournamentTeamIds,
  myTeamIds,
}: {
  teams: TeamItem[];
  team1Id: string;
  tournamentId?: string;
  clubId?: string;
  tournamentTeamIds: Set<string>;
  myTeamIds: Set<string>;
}) {
  const team2TournamentTeams = tournamentId
    ? teams.filter((t) => t.id !== team1Id && tournamentTeamIds.has(t.id))
    : [];

  const team2ClubTeams =
    clubId && !tournamentId
      ? teams.filter((t) => t.id !== team1Id && t.club_id === clubId)
      : [];

  const team2MyTeams = tournamentId
    ? []
    : teams.filter(
        (t) =>
          t.id !== team1Id &&
          myTeamIds.has(t.id) &&
          (!clubId || t.club_id !== clubId),
      );

  const team2Eligible = tournamentId
    ? team2TournamentTeams
    : clubId
      ? [...team2ClubTeams, ...team2MyTeams]
      : team2MyTeams;

  return {
    team2TournamentTeams,
    team2ClubTeams,
    team2MyTeams,
    team2Eligible,
  };
}

describe("Create Match - Option 1 Opponent Scoping Rules", () => {
  const teams: TeamItem[] = [
    { id: "team-my-1", name: "My Squad A", created_by: "user-1" },
    { id: "team-my-2", name: "My Squad B", created_by: "user-1" },
    { id: "team-club-1", name: "Club Squad Alpha", club_id: "club-123" },
    { id: "team-club-2", name: "Club Squad Beta", club_id: "club-123" },
    { id: "team-other-club", name: "Rival Club Team", club_id: "club-999" },
    { id: "team-stranger", name: "Random User Team", created_by: "user-999" },
  ];

  const myTeamIds = new Set(["team-my-1", "team-my-2", "team-club-1"]);

  it("Tournament match: strictly restricts opponents to teams registered in the tournament", () => {
    const tournamentTeamIds = new Set(["team-my-1", "team-stranger"]);

    const result = getEligibleOpponents({
      teams,
      team1Id: "team-my-1",
      tournamentId: "tourn-1",
      tournamentTeamIds,
      myTeamIds,
    });

    // Only team-stranger is registered and distinct from team1
    expect(result.team2Eligible.map((t) => t.id)).toEqual(["team-stranger"]);
    expect(result.team2TournamentTeams.length).toBe(1);
    expect(result.team2ClubTeams.length).toBe(0);
    expect(result.team2MyTeams.length).toBe(0);
  });

  it("Club match: restricts opponents to club squads and user squads, hiding unrelated teams", () => {
    const result = getEligibleOpponents({
      teams,
      team1Id: "team-club-1",
      clubId: "club-123",
      tournamentTeamIds: new Set(),
      myTeamIds,
    });

    const eligibleIds = result.team2Eligible.map((t) => t.id);
    // Should include club-123 squads (team-club-2) and user's other squads (team-my-1, team-my-2)
    expect(eligibleIds).toContain("team-club-2");
    expect(eligibleIds).toContain("team-my-1");
    expect(eligibleIds).toContain("team-my-2");

    // Must NOT include rival club or stranger teams
    expect(eligibleIds).not.toContain("team-other-club");
    expect(eligibleIds).not.toContain("team-stranger");
  });

  it("Independent friendly match: restricts opponents strictly to user squads", () => {
    const result = getEligibleOpponents({
      teams,
      team1Id: "team-my-1",
      tournamentTeamIds: new Set(),
      myTeamIds,
    });

    const eligibleIds = result.team2Eligible.map((t) => t.id);
    // Can only pick between other squads user manages
    expect(eligibleIds).toEqual(["team-my-2", "team-club-1"]);

    // Cannot hijack external teams
    expect(eligibleIds).not.toContain("team-other-club");
    expect(eligibleIds).not.toContain("team-stranger");
    expect(eligibleIds).not.toContain("team-club-2");
  });

  it("Quickly created opponent team is immediately eligible for friendly matches", () => {
    const newTeam: TeamItem = {
      id: "team-quick-opp",
      name: "Friendly Opponents XI",
      created_by: "user-1",
    };
    const updatedTeams = [...teams, newTeam];
    const updatedMyTeamIds = new Set([...myTeamIds, newTeam.id]);

    const result = getEligibleOpponents({
      teams: updatedTeams,
      team1Id: "team-my-1",
      tournamentTeamIds: new Set(),
      myTeamIds: updatedMyTeamIds,
    });

    expect(result.team2Eligible.map((t) => t.id)).toContain("team-quick-opp");
  });
});
