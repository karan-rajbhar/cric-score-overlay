/**
 * Cricsheet Universal Open Standard Exporter
 *
 * Formats match scorecard and full delivery events into the standard Cricsheet JSON format (v1.2.0)
 * used across the cricket open-source ecosystem, ESPN Cricinfo researchers, and data analytics tools.
 */

import type { Match, BallEvent } from "./match-types";

export interface CricsheetDelivery {
  batter: string;
  bowler: string;
  non_striker: string;
  runs: {
    batter: number;
    extras: number;
    total: number;
    non_boundary?: boolean;
  };
  extras?: {
    wides?: number;
    noballs?: number;
    byes?: number;
    legbyes?: number;
    penalty?: number;
  };
  wickets?: Array<{
    player_out: string;
    kind: string;
    fielders?: Array<{ name: string; substitute?: boolean }>;
  }>;
}

export interface CricsheetOver {
  over: number;
  deliveries: CricsheetDelivery[];
}

export interface CricsheetInnings {
  team: string;
  super_over?: boolean;
  target?: {
    runs: number;
    overs?: number;
  };
  penalty_runs?: {
    pre?: number;
    post?: number;
  };
  overs: CricsheetOver[];
}

export interface CricsheetMatch {
  meta: {
    data_version: string;
    created: string;
    revision: number;
  };
  info: {
    balls_per_over: number;
    city?: string;
    dates: string[];
    event?: {
      name: string;
      match_number?: number | string;
      stage?: string;
    };
    gender?: "male" | "female";
    match_type: string;
    match_type_number?: number;
    officials?: {
      umpires?: string[];
      tv_umpires?: string[];
      match_referees?: string[];
      reserve_umpires?: string[];
    };
    overs: number;
    team_type?: "club" | "international";
    teams: [string, string];
    toss: {
      winner: string;
      decision: "bat" | "field";
    };
    outcome?: {
      winner?: string;
      by?: {
        runs?: number;
        wickets?: number;
      };
      result?: string;
      eliminator?: string;
      method?: string;
    };
    player_of_match?: string[];
    players: Record<string, string[]>;
    registry: {
      people: Record<string, string>;
    };
    venue?: string;
  };
  innings: CricsheetInnings[];
}

/**
 * Maps database/internal dismissal types to official Cricsheet dismissal kind strings.
 */
export function toCricsheetDismissalKind(
  rawDismissal: string | null | undefined,
  isCaughtAndBowled: boolean = false,
): string {
  if (isCaughtAndBowled) return "caught and bowled";
  const normalized = (rawDismissal ?? "bowled")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "caught":
      return "caught";
    case "bowled":
      return "bowled";
    case "lbw":
      return "lbw";
    case "run_out":
    case "runout":
      return "run out";
    case "stumped":
      return "stumped";
    case "hit_wicket":
    case "hitwicket":
      return "hit wicket";
    case "obstructing":
    case "obstructing_the_field":
      return "obstructing the field";
    case "handled_ball":
    case "hit_the_ball_twice":
    case "hit_twice":
      return "hit the ball twice";
    case "timed_out":
    case "timedout":
      return "timed out";
    case "retired_hurt":
      return "retired hurt";
    case "retired_out":
      return "retired out";
    default:
      return "bowled";
  }
}

export function buildCricsheetJson(
  match: Match,
  externalBalls?: BallEvent[],
): CricsheetMatch {
  const team1Name = match.team1?.name ?? "Team 1";
  const team2Name = match.team2?.name ?? "Team 2";

  const dateStr = (
    match.actual_start_time ||
    match.scheduled_at ||
    new Date().toISOString()
  ).split("T")[0]!;

  const peopleRegistry: Record<string, string> = {};
  const peopleNameById = new Map<string, string>();
  const playersByTeam: Record<string, string[]> = {
    [team1Name]: [],
    [team2Name]: [],
  };

  const registerPerson = (
    name: string | null | undefined,
    id: string | null | undefined,
    teamName?: string,
  ) => {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (id && id.trim()) {
      peopleRegistry[trimmed] = id.trim();
      peopleNameById.set(id.trim(), trimmed);
    } else if (!peopleRegistry[trimmed]) {
      // Deterministic pseudo-ID for officials/players lacking DB UUID
      peopleRegistry[trimmed] =
        `person-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    }
    if (
      teamName &&
      playersByTeam[teamName] &&
      !playersByTeam[teamName].includes(trimmed)
    ) {
      playersByTeam[teamName].push(trimmed);
    }
  };

  // 1. Populate squad players from team rosters (playing XI & squad)
  for (const tp of match.team1?.team_players || []) {
    if (tp.user?.full_name) {
      registerPerson(tp.user.full_name, tp.user.id || tp.user_id, team1Name);
    }
  }
  for (const tp of match.team2?.team_players || []) {
    if (tp.user?.full_name) {
      registerPerson(tp.user.full_name, tp.user.id || tp.user_id, team2Name);
    }
  }

  // 2. Populate players from innings scorecards (batting & bowling performances)
  for (const inn of match.innings || []) {
    const isTeam1 = inn.team_id === match.team1_id;
    const battingTeam = isTeam1 ? team1Name : team2Name;
    const bowlingTeam = isTeam1 ? team2Name : team1Name;

    for (const bp of inn.batting_performances || []) {
      if (bp.user?.full_name) {
        registerPerson(
          bp.user.full_name,
          bp.user.id || bp.user_id,
          battingTeam,
        );
      }
    }
    for (const bowl of inn.bowling_performances || []) {
      if (bowl.user?.full_name) {
        registerPerson(bowl.user.full_name, bowl.user_id, bowlingTeam);
      }
    }
    for (const fow of inn.fall_of_wickets || []) {
      if (fow.batsman?.full_name) {
        registerPerson(fow.batsman.full_name, fow.batsman_out_id, battingTeam);
      }
      if (fow.bowler?.full_name) {
        registerPerson(fow.bowler.full_name, fow.bowler_id, bowlingTeam);
      }
      if (fow.fielder?.full_name) {
        registerPerson(fow.fielder.full_name, fow.fielder_id, bowlingTeam);
      }
    }
  }

  // 3. Match Officials
  const umpires: string[] = [];
  if (match.umpire1_name?.trim()) {
    const u1 = match.umpire1_name.trim();
    umpires.push(u1);
    registerPerson(u1, `umpire-1-${match.id}`);
  }
  if (match.umpire2_name?.trim()) {
    const u2 = match.umpire2_name.trim();
    umpires.push(u2);
    registerPerson(u2, `umpire-2-${match.id}`);
  }
  const tvUmpires: string[] = [];
  if (match.third_umpire_name?.trim()) {
    const tv = match.third_umpire_name.trim();
    tvUmpires.push(tv);
    registerPerson(tv, `tv-umpire-${match.id}`);
  }
  const officials: CricsheetMatch["info"]["officials"] =
    umpires.length > 0 || tvUmpires.length > 0
      ? {
          ...(umpires.length > 0 ? { umpires } : {}),
          ...(tvUmpires.length > 0 ? { tv_umpires: tvUmpires } : {}),
        }
      : undefined;

  // 4. Event / Tournament
  let event: CricsheetMatch["info"]["event"] = undefined;
  if (match.tournament?.name) {
    event = {
      name: match.tournament.name,
      match_number: match.title,
    };
  } else if (match.club?.name) {
    event = {
      name: match.club.name,
      match_number: match.title,
    };
  }

  // 5. Toss info
  const tossWinnerName =
    match.toss_winner_team_id === match.team1_id
      ? team1Name
      : match.toss_winner_team_id === match.team2_id
        ? team2Name
        : team1Name;
  const tossDecision = match.toss_decision === "bowl" ? "field" : "bat";

  // 6. Outcome
  let outcome: CricsheetMatch["info"]["outcome"] = undefined;
  if (match.status === "completed") {
    const desc = match.result_description?.toLowerCase() ?? "";
    const isTie =
      match.result_type === "tie" ||
      desc.includes("tie") ||
      desc.includes("tied");
    const isSuperOver =
      desc.includes("super over") || desc.includes("eliminator");

    if (isTie && isSuperOver && match.winning_team_id) {
      const winnerName =
        match.winning_team_id === match.team1_id ? team1Name : team2Name;
      outcome = {
        winner: winnerName,
        result: "tie",
        eliminator: winnerName,
      };
    } else if (isTie) {
      outcome = { result: "tie" };
    } else if (match.winning_team_id) {
      const winnerName =
        match.winning_team_id === match.team1_id ? team1Name : team2Name;
      let by: { runs?: number; wickets?: number } | undefined = undefined;

      if (match.win_margin_type === "runs" && match.win_margin) {
        by = { runs: match.win_margin };
      } else if (match.win_margin_type === "wickets" && match.win_margin) {
        by = { wickets: match.win_margin };
      } else {
        const runsMatch =
          match.result_description?.match(/by\s+(\d+)\s+runs?/i);
        const wktsMatch = match.result_description?.match(
          /by\s+(\d+)\s+wickets?/i,
        );
        if (runsMatch?.[1]) {
          by = { runs: parseInt(runsMatch[1], 10) };
        } else if (wktsMatch?.[1]) {
          by = { wickets: parseInt(wktsMatch[1], 10) };
        }
      }

      outcome = {
        winner: winnerName,
        ...(by ? { by } : {}),
      };
    }
    if (
      desc.includes("d/l") ||
      desc.includes("dls") ||
      desc.includes("duckworth")
    ) {
      if (!outcome) outcome = {};
      outcome.method = "D/L";
    }
  } else if (
    match.status === "abandoned" ||
    match.result_type === "no_result"
  ) {
    outcome = { result: "no result" };
  }

  // 7. Venue
  const venue = match.venue?.trim() || "Unknown Venue";

  // 8. Player of the Match
  if (match.player_of_the_match?.full_name) {
    registerPerson(
      match.player_of_the_match.full_name,
      match.player_of_the_match.id,
    );
  }

  // 9. Prepare external balls indexing if provided
  const externalBallsByInnings = new Map<string, BallEvent[]>();
  if (externalBalls && externalBalls.length > 0) {
    for (const b of externalBalls) {
      const arr = externalBallsByInnings.get(b.innings_id) ?? [];
      arr.push(b);
      externalBallsByInnings.set(b.innings_id, arr);
    }
  }

  // 10. Innings & deliveries
  const cricsheetInnings: CricsheetInnings[] = [];
  const sortedInnings = [...(match.innings || [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );

  for (const inn of sortedInnings) {
    const isTeam1 = inn.team_id === match.team1_id;
    const battingTeam = isTeam1 ? team1Name : team2Name;
    const bowlingTeam = isTeam1 ? team2Name : team1Name;

    // Use deliveries from inn.ball_by_ball or fallback to externalBalls
    const rawBalls =
      inn.ball_by_ball && inn.ball_by_ball.length > 0
        ? inn.ball_by_ball
        : (externalBallsByInnings.get(inn.id) ?? []);

    const sortedBalls = [...rawBalls].sort((a, b) => {
      if (a.over_number !== b.over_number) return a.over_number - b.over_number;
      if (a.seq != null && b.seq != null) return a.seq - b.seq;
      return a.ball_number - b.ball_number;
    });

    const oversMap = new Map<number, CricsheetDelivery[]>();

    for (const b of sortedBalls) {
      const overNum = b.over_number;
      const batterName =
        b.batsman?.full_name ||
        (b.batsman_id ? peopleNameById.get(b.batsman_id) : undefined) ||
        "Unknown Batter";

      const bowlerName =
        b.bowler?.full_name ||
        (b.bowler_id ? peopleNameById.get(b.bowler_id) : undefined) ||
        "Unknown Bowler";

      // Resolve non-striker player name
      let nonStrikerName =
        b.non_striker?.full_name ||
        (b.non_striker_id ? peopleNameById.get(b.non_striker_id) : undefined);

      if (!nonStrikerName) {
        // Find other batter in current innings scorecard
        const otherBat = inn.batting_performances?.find(
          (bp) => bp.user_id !== b.batsman_id && bp.user?.full_name,
        );
        nonStrikerName = otherBat?.user?.full_name ?? "Non-Striker";
      }

      registerPerson(batterName, b.batsman_id, battingTeam);
      if (b.bowler_id) registerPerson(bowlerName, b.bowler_id, bowlingTeam);
      if (b.non_striker_id)
        registerPerson(nonStrikerName, b.non_striker_id, battingTeam);

      const batRuns = b.runs_scored ?? 0;
      const extraRuns = b.extras ?? 0;
      const totalRuns = batRuns + extraRuns;

      const delivery: CricsheetDelivery = {
        batter: batterName,
        bowler: bowlerName,
        non_striker: nonStrikerName,
        runs: {
          batter: batRuns,
          extras: extraRuns,
          total: totalRuns,
        },
      };

      if (b.extra_type && extraRuns > 0) {
        delivery.extras = {};
        if (b.extra_type === "wide") delivery.extras.wides = extraRuns;
        else if (b.extra_type === "no_ball")
          delivery.extras.noballs = extraRuns;
        else if (b.extra_type === "bye") delivery.extras.byes = extraRuns;
        else if (b.extra_type === "leg_bye")
          delivery.extras.legbyes = extraRuns;
        else if (b.extra_type === "penalty")
          delivery.extras.penalty = extraRuns;
      }

      if (b.is_wicket) {
        const outPlayerName =
          b.dismissed_player?.full_name ||
          (b.dismissed_player_id
            ? peopleNameById.get(b.dismissed_player_id)
            : undefined) ||
          batterName;

        registerPerson(
          outPlayerName,
          b.dismissed_player_id || b.batsman_id,
          battingTeam,
        );

        const isCaughtAndBowled =
          (b.dismissal_type === "caught" ||
            b.dismissal_type === "caught and bowled") &&
          !!b.fielder_id &&
          b.fielder_id === b.bowler_id;

        const kind = toCricsheetDismissalKind(
          b.dismissal_type,
          isCaughtAndBowled,
        );

        let fielders: Array<{ name: string }> | undefined = undefined;
        const fielderName =
          b.fielder?.full_name ||
          (b.fielder_id ? peopleNameById.get(b.fielder_id) : undefined);

        if (fielderName && !isCaughtAndBowled) {
          fielders = [{ name: fielderName }];
          registerPerson(fielderName, b.fielder_id, bowlingTeam);
        }

        delivery.wickets = [
          {
            player_out: outPlayerName,
            kind,
            ...(fielders ? { fielders } : {}),
          },
        ];
      }

      if (!oversMap.has(overNum)) {
        oversMap.set(overNum, []);
      }
      oversMap.get(overNum)!.push(delivery);
    }

    const cricsheetOvers: CricsheetOver[] = Array.from(oversMap.entries())
      .sort(([o1], [o2]) => o1 - o2)
      .map(([over, deliveries]) => ({
        over,
        deliveries,
      }));

    const isSuperOver = inn.innings_number > 2;
    const innObj: CricsheetInnings = {
      team: battingTeam,
      ...(isSuperOver ? { super_over: true } : {}),
      overs: cricsheetOvers,
    };
    if (inn.target_runs) {
      innObj.target = {
        runs: inn.target_runs,
        overs: match.overs_per_innings,
      };
    }
    if (inn.extras_penalties && inn.extras_penalties > 0) {
      innObj.penalty_runs = {
        post: inn.extras_penalties,
      };
    }
    cricsheetInnings.push(innObj);
  }

  return {
    meta: {
      data_version: "1.2.0",
      created: dateStr,
      revision: 1,
    },
    info: {
      balls_per_over: 6,
      dates: [dateStr],
      event,
      gender: "male",
      match_type: match.match_format ? match.match_format.toUpperCase() : "T20",
      officials,
      overs: match.overs_per_innings,
      outcome,
      player_of_match: match.player_of_the_match?.full_name
        ? [match.player_of_the_match.full_name]
        : undefined,
      players: playersByTeam,
      registry: {
        people: peopleRegistry,
      },
      team_type: "club",
      teams: [team1Name, team2Name],
      toss: {
        winner: tossWinnerName,
        decision: tossDecision,
      },
      venue,
    },
    innings: cricsheetInnings,
  };
}

export function downloadCricsheetJson(
  match: Match,
  externalBalls?: BallEvent[],
) {
  const data = buildCricsheetJson(match, externalBalls);
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = match.title
    ? match.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "match";
  const fileName = `${slug}-cricsheet.json`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
