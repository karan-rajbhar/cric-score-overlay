/**
 * Tournament Fixture Scheduling Algorithm.
 * Generates round-robin fixtures using the polygon / circle rotation method.
 * Guarantees each pair of teams meets exactly once.
 */

export interface ScheduledFixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

export function generateRoundRobinFixtures(
  teamIds: string[],
): ScheduledFixture[] {
  if (teamIds.length < 2) return [];

  const teams = [...teamIds];
  const isOdd = teams.length % 2 !== 0;
  if (isOdd) {
    teams.push("__BYE__");
  }

  const n = teams.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const fixtures: ScheduledFixture[] = [];

  // Circle method: Fix index 0, rotate indices 1 to n-1
  for (let round = 1; round <= totalRounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];

      // Ignore byes and undefined
      if (home && away && home !== "__BYE__" && away !== "__BYE__") {
        // Alternate home and away across rounds
        if (round % 2 === 1) {
          fixtures.push({ round, homeTeamId: home, awayTeamId: away });
        } else {
          fixtures.push({ round, homeTeamId: away, awayTeamId: home });
        }
      }
    }

    // Rotate array keeping teams[0] fixed
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return fixtures;
}
