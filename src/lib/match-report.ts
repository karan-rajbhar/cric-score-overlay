import QRCode from "qrcode";
import type { Match } from "./match-types";
import {
  bowlerEconomy,
  dismissalText,
  formatBowlerOvers,
  formatDecimalOvers,
  inningsBalls,
  oversFromBalls,
  scoreLine,
  strikeRate,
  topBatters,
  topBowlers,
} from "./cricket";

const esc = (t: unknown) =>
  String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------
// Shareable summary image
// ---------------------------------------------------------------------------

export interface ExportBatter {
  name: string;
  runs: number;
  balls: number;
  sr: string;
}

export interface ExportBowler {
  name: string;
  /** Cricket overs notation, e.g. "3.4". */
  overs: string;
  runs: number;
  wickets: number;
  econ: string;
}

export interface ExportTeamStats {
  name: string;
  shortName: string;
  scoreLine: string;
  batters: ExportBatter[];
  bowlers: ExportBowler[];
}

export interface MatchExportSummary {
  title: string;
  format: string;
  venue?: string | null;
  playedAt?: string | null;
  result: string;
  matchUrl: string;
  team1: ExportTeamStats;
  team2: ExportTeamStats;
  playerOfTheMatch?: string | null;
}

export function buildExportSummary(
  match: Match,
  matchUrl: string,
): MatchExportSummary {
  const teamStats = (
    team: Match["team1"],
    battingInnings = inningsFor(match, team.id),
  ): ExportTeamStats => ({
    name: team.name,
    shortName: team.short_name ?? team.name.slice(0, 3).toUpperCase(),
    scoreLine: scoreLine(battingInnings),
    batters: topBatters(battingInnings).map((b) => ({
      name: b.user?.full_name ?? "—",
      runs: b.runs_scored ?? 0,
      balls: b.balls_faced ?? 0,
      sr: strikeRate(b.runs_scored, b.balls_faced),
    })),
    bowlers: topBowlers(match, team.id).map((b) => ({
      name: b.user?.full_name ?? "—",
      overs: formatBowlerOvers(b),
      runs: b.runs_conceded ?? 0,
      wickets: b.wickets_taken ?? 0,
      econ: bowlerEconomy(b),
    })),
  });

  return {
    title: match.title,
    format: `${match.match_format} · ${match.overs_per_innings} ov`,
    venue: match.venue,
    playedAt: match.scheduled_at
      ? new Date(match.scheduled_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null,
    result: match.result_description ?? "Match completed",
    matchUrl,
    team1: teamStats(match.team1),
    team2: teamStats(match.team2),
    playerOfTheMatch: match.player_of_the_match?.full_name ?? null,
  };
}

function inningsFor(match: Match, teamId: string) {
  return match.innings?.find((i) => i.team_id === teamId);
}

// ---------------------------------------------------------------------------
// Full match report (print-ready HTML -> PDF)
// ---------------------------------------------------------------------------

type InningsRow = NonNullable<Match["innings"]>[number];

function battingRows(inn: InningsRow): string {
  const batters = (inn.batting_performances ?? [])
    .filter(
      (b) => (b.balls_faced ?? 0) > 0 || b.is_out || (b.runs_scored ?? 0) > 0,
    )
    .sort((a, b) => (b.balls_faced ?? 0) - (a.balls_faced ?? 0));

  if (!batters.length) {
    return `<tr><td colspan="6" class="muted text-center py-3">No batting recorded</td></tr>`;
  }

  return batters
    .map((b) => {
      const runs = b.runs_scored ?? 0;
      const isCentury = runs >= 100;
      const isFifty = runs >= 50 && runs < 100;
      const runBadge = isCentury
        ? `<span class="milestone-badge century">${runs} <svg class="inline h-2.5 w-2.5 fill-current" viewBox="0 0 24 24" width="10" height="10" style="display:inline-block;vertical-align:-1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>`
        : isFifty
          ? `<span class="milestone-badge fifty">${runs}</span>`
          : `<span class="run-val font-bold">${runs}</span>`;

      return `<tr>
                <td class="name">
                    <div class="player-name">${esc(b.user?.full_name ?? "—")}</div>
                    <div class="howout">${esc(dismissalText(b, inn.fall_of_wickets ?? []))}</div>
                </td>
                <td class="num">${runBadge}</td>
                <td class="num">${b.balls_faced ?? 0}</td>
                <td class="num">${b.fours ?? 0}</td>
                <td class="num">${b.sixes ?? 0}</td>
                <td class="num font-mono">${strikeRate(b.runs_scored, b.balls_faced)}</td>
            </tr>`;
    })
    .join("");
}

function didNotBat(
  inn: InningsRow,
  team: Match["team1"] | Match["team2"] | undefined,
): string {
  if (!team?.team_players || team.team_players.length === 0) return "";
  const battedIds = new Set(
    (inn.batting_performances ?? [])
      .filter(
        (b) => (b.balls_faced ?? 0) > 0 || b.is_out || (b.runs_scored ?? 0) > 0,
      )
      .map((b) => b.user_id),
  );
  const dnb = team.team_players
    .filter((p) => p.user?.id && !battedIds.has(p.user.id))
    .map((p) => p.user?.full_name)
    .filter(Boolean);

  if (dnb.length === 0) return "";
  return `<div class="dnb-strip"><strong>Did not bat:</strong> ${dnb.map(esc).join(", ")}</div>`;
}

function extrasRow(inn: InningsRow): string {
  const parts: string[] = [];
  if (inn.extras_byes) parts.push(`b ${inn.extras_byes}`);
  if (inn.extras_leg_byes) parts.push(`lb ${inn.extras_leg_byes}`);
  if (inn.extras_wides) parts.push(`wd ${inn.extras_wides}`);
  if (inn.extras_no_balls) parts.push(`nb ${inn.extras_no_balls}`);
  if (inn.extras_penalties) parts.push(`p ${inn.extras_penalties}`);
  const breakdown = parts.length
    ? ` <span class="extras-detail">(${parts.join(" | ")})</span>`
    : "";
  return `<tr class="extras-row">
        <td class="name">Extras ${breakdown}</td>
        <td class="num font-bold font-mono">${inn.extras_total ?? 0}</td>
        <td colspan="4" class="muted text-xs">Byes, Leg Byes, Wides, No Balls</td>
    </tr>`;
}

function fowRow(inn: InningsRow): string {
  const entries = [...(inn.fall_of_wickets ?? [])].sort(
    (a, b) => a.wicket_number - b.wicket_number,
  );
  if (!entries.length) return "";
  const items = entries
    .map(
      (f) =>
        `<span class="fow-item"><strong>${f.wicket_number}-${f.runs_at_fall}</strong> <span class="fow-sub">(${esc(f.batsman?.full_name ?? "Batter")}, ${formatDecimalOvers(f.overs_at_fall)} ov)</span></span>`,
    )
    .join("");
  return `<div class="fow"><div class="fow-label">Fall of Wickets:</div><div class="fow-list">${items}</div></div>`;
}

function bowlingRows(inn: InningsRow): string {
  const bowlers = (inn.bowling_performances ?? [])
    .filter((b) => (b.balls_bowled ?? 0) > 0 || (b.overs_bowled ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.wickets_taken ?? 0) - (a.wickets_taken ?? 0) ||
        (a.runs_conceded ?? 0) - (b.runs_conceded ?? 0),
    );

  if (!bowlers.length) {
    return `<tr><td colspan="11" class="muted text-center py-3">No bowling recorded</td></tr>`;
  }

  const ballLog = inn.ball_by_ball ?? [];

  return bowlers
    .map((b) => {
      const wkts = b.wickets_taken ?? 0;
      const wktBadge =
        wkts >= 5
          ? `<span class="milestone-badge century">${wkts} <svg class="inline h-2.5 w-2.5 fill-current" viewBox="0 0 24 24" width="10" height="10" style="display:inline-block;vertical-align:-1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>`
          : wkts >= 3
            ? `<span class="milestone-badge three-wkt">${wkts}</span>`
            : `<strong>${wkts}</strong>`;

      let dotBalls = 0;
      let fours = 0;
      let sixes = 0;
      if (ballLog.length > 0) {
        for (const d of ballLog) {
          if (d.bowler_id === b.user_id) {
            if ((d.runs_scored ?? 0) === 0 && (d.extras ?? 0) === 0) dotBalls++;
            if ((d.runs_scored ?? 0) === 4) fours++;
            if ((d.runs_scored ?? 0) === 6) sixes++;
          }
        }
      }

      return `<tr>
                <td class="name font-medium">${esc(b.user?.full_name ?? "—")}</td>
                <td class="num font-mono">${formatBowlerOvers(b)}</td>
                <td class="num font-mono">${b.maidens ?? 0}</td>
                <td class="num font-mono">${b.runs_conceded ?? 0}</td>
                <td class="num font-mono">${wktBadge}</td>
                <td class="num font-mono">${bowlerEconomy(b)}</td>
                <td class="num font-mono">${ballLog.length > 0 ? dotBalls : "—"}</td>
                <td class="num font-mono">${ballLog.length > 0 ? fours : "—"}</td>
                <td class="num font-mono">${ballLog.length > 0 ? sixes : "—"}</td>
                <td class="num font-mono">${b.wides ?? 0}</td>
                <td class="num font-mono">${b.no_balls ?? 0}</td>
            </tr>`;
    })
    .join("");
}

interface Partnership {
  wicketNumber: number;
  runs: number;
  balls: number;
  batter1: { name: string; runs: number; balls: number };
  batter2: { name: string; runs: number; balls: number };
  isUnbroken?: boolean;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0] || "th";
}

function getInningsPartnerships(inn: InningsRow): Partnership[] {
  const deliveries = (inn.ball_by_ball ?? []).slice().sort((a, b) => {
    const overDiff = (a.over_number ?? 0) - (b.over_number ?? 0);
    if (overDiff !== 0) return overDiff;
    return (a.ball_number ?? 0) - (b.ball_number ?? 0);
  });

  const partnerships: Partnership[] = [];

  if (deliveries.length > 0) {
    let curWicket = 1;
    let pRuns = 0;
    let pBalls = 0;
    const batterMap = new Map<string, { name: string; runs: number; balls: number }>();

    for (const d of deliveries) {
      const runs = d.runs_scored ?? 0;
      const extras = d.extras ?? 0;
      const isLegal = d.extra_type !== "wide" && d.extra_type !== "no_ball";

      pRuns += runs + extras;
      if (isLegal) pBalls++;

      if (d.batsman_id) {
        const b = batterMap.get(d.batsman_id) ?? {
          name:
            d.batsman?.full_name ??
            inn.batting_performances?.find((bp) => bp.user_id === d.batsman_id)
              ?.user?.full_name ??
            "Batter",
          runs: 0,
          balls: 0,
        };
        b.runs += runs;
        if (d.extra_type !== "wide") b.balls++;
        batterMap.set(d.batsman_id, b);
      }

      if (d.non_striker_id && !batterMap.has(d.non_striker_id)) {
        batterMap.set(d.non_striker_id, {
          name:
            d.non_striker?.full_name ??
            inn.batting_performances?.find(
              (bp) => bp.user_id === d.non_striker_id,
            )?.user?.full_name ??
            "Batter",
          runs: 0,
          balls: 0,
        });
      }

      if (d.is_wicket) {
        const activeBatters = Array.from(batterMap.values());
        const b1 = activeBatters[0] ?? { name: "Batter 1", runs: 0, balls: 0 };
        const b2 = activeBatters[1] ?? { name: "Batter 2", runs: 0, balls: 0 };

        partnerships.push({
          wicketNumber: curWicket,
          runs: pRuns,
          balls: pBalls,
          batter1: { ...b1 },
          batter2: { ...b2 },
          isUnbroken: false,
        });

        curWicket++;
        pRuns = 0;
        pBalls = 0;
        const dismissedId = d.dismissed_player_id || d.batsman_id;
        if (dismissedId) {
          batterMap.delete(dismissedId);
        } else if (activeBatters.length > 0) {
          const firstKey = Array.from(batterMap.keys())[0];
          if (firstKey) batterMap.delete(firstKey);
        }
        for (const [id, val] of batterMap.entries()) {
          batterMap.set(id, { ...val, runs: 0, balls: 0 });
        }
      }
    }

    if (batterMap.size > 0 && (pRuns > 0 || pBalls > 0 || partnerships.length === 0)) {
      const activeBatters = Array.from(batterMap.values());
      const b1 = activeBatters[0] ?? { name: "Batter 1", runs: 0, balls: 0 };
      const b2 = activeBatters[1] ?? { name: "Batter 2", runs: 0, balls: 0 };
      partnerships.push({
        wicketNumber: curWicket,
        runs: pRuns,
        balls: pBalls,
        batter1: { ...b1 },
        batter2: { ...b2 },
        isUnbroken: true,
      });
    }
  } else if (inn.fall_of_wickets && inn.fall_of_wickets.length > 0) {
    const sortedFow = inn.fall_of_wickets
      .slice()
      .sort((a, b) => a.wicket_number - b.wicket_number);
    let prevRuns = 0;
    for (const f of sortedFow) {
      const partRuns = Math.max(0, (f.runs_at_fall ?? 0) - prevRuns);
      partnerships.push({
        wicketNumber: f.wicket_number,
        runs: partRuns,
        balls: 0,
        batter1: {
          name: f.batsman?.full_name ?? "Batter",
          runs: partRuns,
          balls: 0,
        },
        batter2: { name: "Partner", runs: 0, balls: 0 },
        isUnbroken: false,
      });
      prevRuns = f.runs_at_fall ?? 0;
    }
    if ((inn.total_runs ?? 0) > prevRuns) {
      partnerships.push({
        wicketNumber: sortedFow.length + 1,
        runs: (inn.total_runs ?? 0) - prevRuns,
        balls: 0,
        batter1: {
          name: "Active Batters",
          runs: (inn.total_runs ?? 0) - prevRuns,
          balls: 0,
        },
        batter2: { name: "Partner", runs: 0, balls: 0 },
        isUnbroken: true,
      });
    }
  }

  return partnerships;
}

function renderPartnerships(inn: InningsRow): string {
  const parts = getInningsPartnerships(inn);
  if (!parts.length) return "";

  const items = parts
    .map((p) => {
      const totalPartRuns = Math.max(1, p.runs);
      const b1Share = Math.min(
        100,
        Math.max(0, Math.round((p.batter1.runs / totalPartRuns) * 100)),
      );
      const b2Share = 100 - b1Share;
      const badgeText = p.isUnbroken
        ? `${p.wicketNumber}${getOrdinalSuffix(p.wicketNumber)} Wkt (Unbroken)`
        : `${p.wicketNumber}${getOrdinalSuffix(p.wicketNumber)} Wkt`;

      return `
        <div class="partnership-card">
            <div class="part-top-row">
                <span class="part-wkt-badge">${badgeText}</span>
                <span class="part-runs-score font-mono"><strong>${p.runs}</strong> runs ${p.balls > 0 ? `(${p.balls}b)` : ""}</span>
            </div>
            <div class="part-bar-track">
                <div class="part-bar-seg seg-1" style="width: ${b1Share}%"></div>
                <div class="part-bar-seg seg-2" style="width: ${b2Share}%"></div>
            </div>
            <div class="part-batters-row">
                <div class="part-bat-col left">
                    <span class="part-bat-name font-medium">${esc(p.batter1.name)}</span>
                    <span class="part-bat-runs font-mono font-semibold">${p.batter1.runs}${p.batter1.balls > 0 ? ` (${p.batter1.balls}b)` : ""}</span>
                </div>
                <div class="part-bat-col right">
                    <span class="part-bat-runs font-mono font-semibold">${p.batter2.runs}${p.batter2.balls > 0 ? ` (${p.batter2.balls}b)` : ""}</span>
                    <span class="part-bat-name font-medium">${esc(p.batter2.name)}</span>
                </div>
            </div>
        </div>`;
    })
    .join("");

  return `
    <div class="partnerships-wrap">
        <div class="table-subheading">Key Partnerships</div>
        <div class="partnerships-grid">${items}</div>
    </div>`;
}

function inningsSection(
  inn: InningsRow,
  index: number,
  team: Match["team1"] | Match["team2"],
): string {
  const balls = inningsBalls(inn);
  const overs = oversFromBalls(balls);
  const rr =
    balls > 0 ? ((inn.total_runs ?? 0) / (balls / 6)).toFixed(2) : "0.00";
  const total = `${inn.total_runs ?? 0}/${inn.total_wickets ?? 0}`;

  const totalFours = (inn.batting_performances ?? []).reduce(
    (acc, b) => acc + (b.fours ?? 0),
    0,
  );
  const totalSixes = (inn.batting_performances ?? []).reduce(
    (acc, b) => acc + (b.sixes ?? 0),
    0,
  );
  const boundaryRuns = totalFours * 4 + totalSixes * 6;
  const boundaryPct =
    (inn.total_runs ?? 0) > 0
      ? ((boundaryRuns / (inn.total_runs ?? 1)) * 100).toFixed(1)
      : "0.0";

  return `
    <div class="report-page page-break innings-page">
        <div class="page-inner">
            <div class="section-badge-header">
                <div class="section-title-wrap">
                    <h2 class="section-page-title">${index === 0 ? "1st Innings Scorecard" : "2nd Innings Scorecard"}</h2>
                    <span class="innings-team-pill">${esc(team.name)}</span>
                </div>
                <div class="innings-score-pill">
                    <span class="score-main">${total}</span>
                    <span class="score-details">(${overs} ov &bull; RR: ${rr}${inn.is_completed ? "" : ", in progress"})</span>
                </div>
            </div>

            <section class="innings">
                <div class="table-subheading">Batting Performance</div>
                <table class="score-table batting-table">
                    <thead>
                        <tr>
                            <th class="name">Batter</th>
                            <th class="num">R</th>
                            <th class="num">B</th>
                            <th class="num">4s</th>
                            <th class="num">6s</th>
                            <th class="num">SR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${battingRows(inn)}
                        ${extrasRow(inn)}
                        <tr class="totals-row">
                            <td class="name font-bold">TOTAL (${overs} Overs, RR: ${rr})</td>
                            <td class="num font-bold font-mono">${total}</td>
                            <td colspan="4" class="muted text-xs text-right">
                                ${boundaryRuns > 0 ? `Boundaries: ${totalFours}x4, ${totalSixes}x6 (${boundaryRuns} runs, ${boundaryPct}%)` : ""}
                            </td>
                        </tr>
                    </tbody>
                </table>

                ${didNotBat(inn, team)}
                ${fowRow(inn)}
                ${renderPartnerships(inn)}

                <div class="bowling-wrap">
                    <div class="table-subheading">Bowling Performance</div>
                    <table class="score-table bowling-table">
                        <thead>
                            <tr>
                                <th class="name">Bowler</th>
                                <th class="num">O</th>
                                <th class="num">M</th>
                                <th class="num">R</th>
                                <th class="num">W</th>
                                <th class="num">Eco</th>
                                <th class="num">0s</th>
                                <th class="num">4s</th>
                                <th class="num">6s</th>
                                <th class="num">Wd</th>
                                <th class="num">Nb</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bowlingRows(inn)}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>

        <footer class="mini-footer">
            <span>Official Scorecard &bull; Innings ${index + 1}</span>
            <span>CricScore Platform &bull; Match Verification</span>
        </footer>
    </div>`;
}

// ---------------------------------------------------------------------------
// Over Comparison (Page 4)
// ---------------------------------------------------------------------------

interface OverData {
  overNumber: number;
  runs: number;
  wickets: number;
  cumulativeRuns: number;
  cumulativeWickets: number;
  balls: Array<{
    text: string;
    type: "dot" | "single" | "four" | "six" | "wicket" | "extra";
  }>;
  batters: Array<{ name: string; runs: number; balls: number }>;
  bowlerName: string;
  bowlerOvers: string;
  bowlerMaidens: number;
  bowlerRuns: number;
  bowlerWickets: number;
}

function getInningsOverComparison(inn: InningsRow): OverData[] {
  const deliveries = (inn.ball_by_ball ?? []).slice().sort((a, b) => {
    const overDiff = (a.over_number ?? 0) - (b.over_number ?? 0);
    if (overDiff !== 0) return overDiff;
    return (a.ball_number ?? 0) - (b.ball_number ?? 0);
  });

  if (!deliveries.length) return [];

  const oversMap = new Map<number, typeof deliveries>();
  for (const d of deliveries) {
    const ov = d.over_number ?? 0;
    const list = oversMap.get(ov) ?? [];
    list.push(d);
    oversMap.set(ov, list);
  }

  const sortedOverNumbers = Array.from(oversMap.keys()).sort((a, b) => a - b);

  let cumulativeRuns = 0;
  let cumulativeWickets = 0;

  const bowlerStats = new Map<
    string,
    { balls: number; runs: number; wickets: number; maidens: number }
  >();
  const batterStats = new Map<string, { runs: number; balls: number }>();

  const result: OverData[] = [];

  for (const ovNum of sortedOverNumbers) {
    const overDeliveries = oversMap.get(ovNum) ?? [];
    let overRuns = 0;
    let overBowlerRuns = 0;
    let overWickets = 0;
    let overLegalBalls = 0;
    const overBattersSet = new Set<string>();
    let overBowlerId = "";

    const ballsList: OverData["balls"] = [];

    for (const d of overDeliveries) {
      const runsScored = d.runs_scored ?? 0;
      const extras = d.extras ?? 0;
      const totalBallRuns = runsScored + extras;
      overRuns += totalBallRuns;

      const isWkt = Boolean(d.is_wicket);
      if (isWkt) overWickets++;

      const isLegal = d.extra_type !== "wide" && d.extra_type !== "no_ball";
      if (isLegal) overLegalBalls++;
      if (
        d.extra_type !== "bye" &&
        d.extra_type !== "leg_bye" &&
        d.extra_type !== "penalty"
      ) {
        overBowlerRuns += totalBallRuns;
      }

      if (d.batsman_id) {
        overBattersSet.add(d.batsman_id);
        const bStat = batterStats.get(d.batsman_id) ?? { runs: 0, balls: 0 };
        bStat.runs += runsScored;
        if (d.extra_type !== "wide") bStat.balls++;
        batterStats.set(d.batsman_id, bStat);
      }

      if (d.bowler_id) {
        overBowlerId = d.bowler_id;
        const bwStat = bowlerStats.get(d.bowler_id) ?? {
          balls: 0,
          runs: 0,
          wickets: 0,
          maidens: 0,
        };
        // Byes/leg-byes/penalties are never charged to the bowler (engine).
        const bowlerRuns =
          d.extra_type === "bye" ||
          d.extra_type === "leg_bye" ||
          d.extra_type === "penalty"
            ? 0
            : totalBallRuns;
        bwStat.runs += bowlerRuns;
        if (isWkt) bwStat.wickets++;
        if (isLegal) bwStat.balls++;
        bowlerStats.set(d.bowler_id, bwStat);
      }

      let text = "0";
      let type: OverData["balls"][number]["type"] = "dot";
      if (isWkt) {
        text = "W";
        type = "wicket";
      } else if (d.extra_type === "wide") {
        text = extras > 1 ? `${extras}Wd` : "Wd";
        type = "extra";
      } else if (d.extra_type === "no_ball") {
        text = runsScored > 0 ? `${runsScored}Nb` : "Nb";
        type = "extra";
      } else if (d.extra_type === "bye") {
        text = `B${extras}`;
        type = "extra";
      } else if (d.extra_type === "leg_bye") {
        text = `Lb${extras}`;
        type = "extra";
      } else if (runsScored === 4) {
        text = "4";
        type = "four";
      } else if (runsScored === 6) {
        text = "6";
        type = "six";
      } else if (runsScored > 0) {
        text = String(runsScored);
        type = "single";
      }

      ballsList.push({ text, type });
    }

    cumulativeRuns += overRuns;
    cumulativeWickets += overWickets;

    if (overBowlerRuns === 0 && overLegalBalls >= 6 && overBowlerId) {
      const bwStat = bowlerStats.get(overBowlerId);
      if (bwStat) bwStat.maidens++;
    }

    const currentBowlerProg = overBowlerId ? bowlerStats.get(overBowlerId) : null;
    const bowlerOversStr = currentBowlerProg
      ? oversFromBalls(currentBowlerProg.balls)
      : "1.0";

    const bowlerPerf = inn.bowling_performances?.find(
      (bp) => bp.user_id === overBowlerId,
    );
    const bowlerName =
      bowlerPerf?.user?.full_name ??
      (overDeliveries[0] as unknown as { bowler?: { full_name?: string } })
        ?.bowler?.full_name ??
      "Bowler";

    const battersInOver: OverData["batters"] = [];
    for (const bId of overBattersSet) {
      const bPerf = inn.batting_performances?.find((bp) => bp.user_id === bId);
      const bName =
        bPerf?.user?.full_name ??
        (overDeliveries.find((d) => d.batsman_id === bId) as unknown as {
          batsman?: { full_name?: string };
        })?.batsman?.full_name ??
        "Batter";
      const bStat = batterStats.get(bId) ?? { runs: 0, balls: 0 };
      battersInOver.push({
        name: bName,
        runs: bStat.runs,
        balls: bStat.balls,
      });
    }

    result.push({
      overNumber: ovNum + 1,
      runs: overRuns,
      wickets: overWickets,
      cumulativeRuns,
      cumulativeWickets,
      balls: ballsList,
      batters: battersInOver,
      bowlerName,
      bowlerOvers: bowlerOversStr,
      bowlerMaidens: currentBowlerProg?.maidens ?? 0,
      bowlerRuns: currentBowlerProg?.runs ?? overRuns,
      bowlerWickets: currentBowlerProg?.wickets ?? overWickets,
    });
  }

  return result;
}

function renderOverCard(ov: OverData | undefined): string {
  if (!ov) {
    return `<div class="over-card empty"><div class="over-empty-text">—</div></div>`;
  }

  const ballBadges = ov.balls
    .map((b) => `<span class="ball-pill ball-${b.type}">${esc(b.text)}</span>`)
    .join("");

  const batterRows = ov.batters
    .slice(0, 2)
    .map((b) => `<div class="over-crease-batter">${esc(b.name)} <span class="font-mono">${b.runs}(${b.balls})</span></div>`)
    .join("");

  return `
    <div class="over-card">
        <div class="over-balls-row">${ballBadges}</div>
        <div class="over-details-row">
            <div class="over-batters-col">${batterRows}</div>
            <div class="over-bowler-col">
                <div class="over-bowler-name">${esc(ov.bowlerName)}</div>
                <div class="over-bowler-figs font-mono">${ov.bowlerOvers} ov &bull; ${ov.bowlerWickets}/${ov.bowlerRuns}${ov.bowlerMaidens > 0 ? ` (${ov.bowlerMaidens}M)` : ""}</div>
            </div>
        </div>
        <div class="over-footer-row">
            <span>Over ${ov.overNumber}</span>
            <span>Runs ${ov.runs}</span>
            <span class="over-running-score font-mono">Score ${ov.cumulativeRuns}/${ov.cumulativeWickets}</span>
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Phase Analysis (Powerplay, Middle, Death)
// ---------------------------------------------------------------------------

interface PhaseStat {
  phaseName: string;
  oversLabel: string;
  runs: number;
  wickets: number;
  balls: number;
  rr: string;
}

function getPhaseStatsForInnings(
  inn: InningsRow | undefined,
  maxOvers = 20,
): PhaseStat[] {
  if (!inn) return [];

  const ppEnd = maxOvers <= 10 ? 3 : maxOvers <= 20 ? 6 : 10;
  const midEnd = maxOvers <= 10 ? 7 : maxOvers <= 20 ? 15 : 40;

  const phasesDef = [
    { name: "Powerplay", start: 1, end: ppEnd, label: `Ov 1-${ppEnd}` },
    {
      name: "Middle Overs",
      start: ppEnd + 1,
      end: midEnd,
      label: `Ov ${ppEnd + 1}-${midEnd}`,
    },
    {
      name: "Death Overs",
      start: midEnd + 1,
      end: maxOvers,
      label: `Ov ${midEnd + 1}-${maxOvers}`,
    },
  ];

  const deliveries = inn.ball_by_ball ?? [];

  if (deliveries.length > 0) {
    return phasesDef.map((ph) => {
      let pRuns = 0;
      let pWkts = 0;
      let pBalls = 0;

      for (const d of deliveries) {
        const ov = (d.over_number ?? 0) + 1; // 1-indexed over number
        if (ov >= ph.start && ov <= ph.end) {
          pRuns += (d.runs_scored ?? 0) + (d.extras ?? 0);
          if (d.is_wicket) pWkts++;
          if (d.extra_type !== "wide" && d.extra_type !== "no_ball") pBalls++;
        }
      }

      const oversDec = pBalls / 6;
      const rr = oversDec > 0 ? (pRuns / oversDec).toFixed(2) : "0.00";

      return {
        phaseName: ph.name,
        oversLabel: ph.label,
        runs: pRuns,
        wickets: pWkts,
        balls: pBalls,
        rr,
      };
    });
  }

  return [];
}

function renderPhaseAnalysis(match: Match): string {
  const inn1 =
    match.innings?.find((i) => i.team_id === match.team1_id) ??
    match.innings?.[0];
  const inn2 =
    match.innings?.find((i) => i.team_id === match.team2_id) ??
    match.innings?.[1];

  const maxOvers = match.overs_per_innings || 20;
  const p1 = getPhaseStatsForInnings(inn1, maxOvers);
  const p2 = getPhaseStatsForInnings(inn2, maxOvers);

  if (p1.length === 0 && p2.length === 0) return "";

  const rows = p1
    .map((stat1, idx) => {
      const stat2 = p2[idx] ?? { runs: 0, wickets: 0, rr: "0.00", balls: 0 };
      let advantage = "Even";
      let advantageColor = "neutral";

      if (stat1.runs > stat2.runs + 4) {
        advantage = `${match.team1.short_name ?? match.team1.name.slice(0, 3).toUpperCase()}`;
        advantageColor = "team1";
      } else if (stat2.runs > stat1.runs + 4) {
        advantage = `${match.team2.short_name ?? match.team2.name.slice(0, 3).toUpperCase()}`;
        advantageColor = "team2";
      }

      return `
      <tr>
          <td class="phase-name text-left">
              <span class="phase-title">${stat1.phaseName}</span>
              <span class="phase-sub font-mono">${stat1.oversLabel}</span>
          </td>
          <td class="text-center">
              <span class="phase-score font-mono font-bold">${stat1.runs}/${stat1.wickets}</span>
              <span class="phase-rr font-mono">${stat1.rr} RR</span>
          </td>
          <td class="text-center">
              <span class="phase-score font-mono font-bold">${stat2.runs}/${stat2.wickets}</span>
              <span class="phase-rr font-mono">${stat2.rr} RR</span>
          </td>
          <td class="text-right">
              <span class="adv-pill adv-${advantageColor}">${advantage}</span>
          </td>
      </tr>`;
    })
    .join("");

  const t1Header = esc(match.team1.short_name ?? match.team1.name);
  const t2Header = esc(match.team2.short_name ?? match.team2.name);

  return `
    <div class="phase-analysis-card">
        <div class="section-title">Phase-by-Phase Match Comparison</div>
        <table class="phase-table">
            <thead>
                <tr>
                    <th class="text-left" style="width: 28%;">Game Phase</th>
                    <th class="text-center" style="width: 24%;">${t1Header}</th>
                    <th class="text-center" style="width: 24%;">${t2Header}</th>
                    <th class="text-right" style="width: 24%;">Advantage</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

// ---------------------------------------------------------------------------
// Match Impact & MVP Index
// ---------------------------------------------------------------------------

interface ImpactLeader {
  id: string;
  name: string;
  teamName: string;
  teamTag: string;
  points: number;
  highlight: string;
}

function calculateMatchImpactLeaders(match: Match): ImpactLeader[] {
  const scores = new Map<
    string,
    {
      name: string;
      teamName: string;
      teamTag: string;
      points: number;
      highlightParts: string[];
    }
  >();

  const team1Name = match.team1.name;
  const team1Tag =
    match.team1.short_name ?? team1Name.slice(0, 3).toUpperCase();
  const team2Name = match.team2.name;
  const team2Tag =
    match.team2.short_name ?? team2Name.slice(0, 3).toUpperCase();

  for (const inn of match.innings ?? []) {
    const isTeam1 = inn.team_id === match.team1_id;
    const battingTeamName = isTeam1 ? team1Name : team2Name;
    const battingTeamTag = isTeam1 ? team1Tag : team2Tag;
    const bowlingTeamName = isTeam1 ? team2Name : team1Name;
    const bowlingTeamTag = isTeam1 ? team2Tag : team1Tag;

    for (const b of inn.batting_performances ?? []) {
      const uId = b.user_id;
      const uName = b.user?.full_name ?? "Player";
      const cur = scores.get(uId) ?? {
        name: uName,
        teamName: battingTeamName,
        teamTag: battingTeamTag,
        points: 0,
        highlightParts: [],
      };

      const runs = b.runs_scored ?? 0;
      const balls = b.balls_faced ?? 0;
      const fours = b.fours ?? 0;
      const sixes = b.sixes ?? 0;

      let batPts = runs;
      batPts += fours * 1 + sixes * 2;
      if (runs >= 100) batPts += 40;
      else if (runs >= 50) batPts += 20;
      else if (runs >= 30) batPts += 10;

      if (runs >= 15 && balls > 0 && runs / balls >= 1.5) {
        batPts += 10;
      }

      cur.points += batPts;
      if (runs > 0) {
        cur.highlightParts.push(`${runs} runs (${balls}b)`);
      }
      scores.set(uId, cur);
    }

    for (const bw of inn.bowling_performances ?? []) {
      const uId = bw.user_id;
      const uName = bw.user?.full_name ?? "Player";
      const cur = scores.get(uId) ?? {
        name: uName,
        teamName: bowlingTeamName,
        teamTag: bowlingTeamTag,
        points: 0,
        highlightParts: [],
      };

      const wkts = bw.wickets_taken ?? 0;
      const runs = bw.runs_conceded ?? 0;
      const maidens = bw.maidens ?? 0;
      const overs = (bw.balls_bowled ?? 0) / 6 || (bw.overs_bowled ?? 0);

      let bowlPts = wkts * 25;
      if (wkts >= 5) bowlPts += 30;
      else if (wkts >= 3) bowlPts += 15;
      bowlPts += maidens * 15;

      if (overs >= 2) {
        const econ = runs / overs;
        if (econ <= 5.0) bowlPts += 25;
        else if (econ <= 6.0) bowlPts += 15;
      }

      cur.points += bowlPts;
      if (wkts > 0 || maidens > 0) {
        cur.highlightParts.push(`${wkts}/${runs} (${formatBowlerOvers(bw)} ov)`);
      }
      scores.set(uId, cur);
    }
  }

  return Array.from(scores.entries())
    .map(([id, val]) => ({
      id,
      name: val.name,
      teamName: val.teamName,
      teamTag: val.teamTag,
      points: Math.round(val.points),
      highlight:
        val.highlightParts.join(" &bull; ") || "All-round contribution",
    }))
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
}

function renderImpactLeaderboard(match: Match): string {
  const leaders = calculateMatchImpactLeaders(match);
  if (!leaders.length) return "";

  const items = leaders
    .map((ldr, i) => {
      const rankClass =
        i === 0
          ? "rank-gold"
          : i === 1
            ? "rank-silver"
            : i === 2
              ? "rank-bronze"
              : "rank-default";

      return `
      <div class="impact-item">
          <div class="impact-rank ${rankClass}">#${i + 1}</div>
          <div class="impact-details">
              <div class="impact-top-line">
                  <span class="impact-name font-medium">${esc(ldr.name)}</span>
                  <span class="impact-tag font-mono">${esc(ldr.teamTag)}</span>
              </div>
              <div class="impact-highlight font-mono">${ldr.highlight}</div>
          </div>
          <div class="impact-pts">
              <span class="impact-score font-mono font-bold">${ldr.points}</span>
              <span class="impact-pts-label">pts</span>
          </div>
      </div>`;
    })
    .join("");

  return `
    <div class="impact-card">
        <div class="section-title">Match Impact &amp; MVP Index</div>
        <div class="impact-list">${items}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Pure Vector SVG Visual Analytics (Worm & Manhattan)
// ---------------------------------------------------------------------------

function generateWormChartSvg(match: Match): string {
  const inn1 =
    match.innings?.find((i) => i.team_id === match.team1_id) ??
    match.innings?.[0];
  const inn2 =
    match.innings?.find((i) => i.team_id === match.team2_id) ??
    match.innings?.[1];

  if (!inn1) return "";

  const inn1Overs = getInningsOverComparison(inn1);
  const inn2Overs = inn2 ? getInningsOverComparison(inn2) : [];

  if (inn1Overs.length === 0 && inn2Overs.length === 0) return "";

  const team1Name = match.team1.short_name ?? match.team1.name;
  const team2Name = match.team2.short_name ?? match.team2.name;

  const totalOversMax = Math.max(
    match.overs_per_innings || 20,
    inn1Overs.length,
    inn2Overs.length,
    1,
  );
  const maxRunsRaw = Math.max(
    inn1?.total_runs ?? 0,
    inn2?.total_runs ?? 0,
    ...inn1Overs.map((o) => o.cumulativeRuns),
    ...inn2Overs.map((o) => o.cumulativeRuns),
    40,
  );
  const maxRuns = Math.ceil(maxRunsRaw / 25) * 25;

  const w = 550;
  const h = 210;
  const ml = 45;
  const mr = 20;
  const mt = 32;
  const mb = 28;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  const getX = (ov: number) => ml + (ov / totalOversMax) * pw;
  const getY = (r: number) => mt + ph - (r / maxRuns) * ph;

  // Gridlines (4 horizontal steps)
  const gridLines: string[] = [];
  for (let step = 0; step <= 4; step++) {
    const val = Math.round((maxRuns / 4) * step);
    const gy = getY(val);
    gridLines.push(`
      <line x1="${ml}" y1="${gy}" x2="${ml + pw}" y2="${gy}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${ml - 6}" y="${gy + 3}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="8.5" fill="#94a3b8">${val}</text>
    `);
  }

  // X-axis over ticks
  const xTicks: string[] = [];
  const tickStep = totalOversMax <= 10 ? 2 : totalOversMax <= 20 ? 5 : 10;
  for (let ov = tickStep; ov <= totalOversMax; ov += tickStep) {
    const gx = getX(ov);
    xTicks.push(`
      <text x="${gx}" y="${mt + ph + 14}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="8.5" fill="#94a3b8">Ov ${ov}</text>
    `);
  }

  // Points for Team 1
  const p1Points = [
    { over: 0, runs: 0, wickets: 0 },
    ...inn1Overs.map((o) => ({
      over: o.overNumber,
      runs: o.cumulativeRuns,
      wickets: o.wickets,
    })),
  ];
  const d1 = p1Points
    .map(
      (p, idx) =>
        `${idx === 0 ? "M" : "L"} ${getX(p.over).toFixed(1)} ${getY(p.runs).toFixed(1)}`,
    )
    .join(" ");

  // Wicket circles for Team 1
  const w1Circles = p1Points
    .filter((p) => p.wickets > 0)
    .map(
      (p) =>
        `<circle cx="${getX(p.over).toFixed(1)}" cy="${getY(p.runs).toFixed(1)}" r="4" fill="#0f766e" stroke="#ffffff" stroke-width="1.5" />`,
    )
    .join("");

  // Points for Team 2
  const p2Points =
    inn2Overs.length > 0
      ? [
          { over: 0, runs: 0, wickets: 0 },
          ...inn2Overs.map((o) => ({
            over: o.overNumber,
            runs: o.cumulativeRuns,
            wickets: o.wickets,
          })),
        ]
      : [];
  const d2 =
    p2Points.length > 0
      ? p2Points
          .map(
            (p, idx) =>
              `${idx === 0 ? "M" : "L"} ${getX(p.over).toFixed(1)} ${getY(p.runs).toFixed(1)}`,
          )
          .join(" ")
      : "";
  const w2Circles = p2Points
    .filter((p) => p.wickets > 0)
    .map(
      (p) =>
        `<circle cx="${getX(p.over).toFixed(1)}" cy="${getY(p.runs).toFixed(1)}" r="4" fill="#d97706" stroke="#ffffff" stroke-width="1.5" />`,
    )
    .join("");

  const inn1ScoreStr = inn1 ? `${inn1.total_runs}/${inn1.total_wickets}` : "";
  const inn2ScoreStr = inn2 ? `${inn2.total_runs}/${inn2.total_wickets}` : "";

  return `
    <svg viewBox="0 0 ${w} ${h}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">
        <rect x="${ml}" y="10" width="10" height="10" rx="2" fill="#0f766e" />
        <text x="${ml + 15}" y="19" font-family="'Outfit', sans-serif" font-size="10" font-weight="700" fill="#090d16">${esc(team1Name)}: ${inn1ScoreStr}</text>

        ${
          inn2Overs.length > 0
            ? `
        <rect x="${ml + 180}" y="10" width="10" height="10" rx="2" fill="#d97706" />
        <text x="${ml + 195}" y="19" font-family="'Outfit', sans-serif" font-size="10" font-weight="700" fill="#090d16">${esc(team2Name)}: ${inn2ScoreStr}</text>
        `
            : ""
        }

        <circle cx="${ml + 350}" cy="15" r="3.5" fill="#64748b" />
        <text x="${ml + 360}" y="19" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" fill="#64748b">Wicket</text>

        ${gridLines.join("")}
        ${xTicks.join("")}

        <path d="${d1}" fill="none" stroke="#0f766e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${d2 ? `<path d="${d2}" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ""}

        ${w1Circles}
        ${w2Circles}
    </svg>`;
}

function generateManhattanChartSvg(match: Match): string {
  const inn1 =
    match.innings?.find((i) => i.team_id === match.team1_id) ??
    match.innings?.[0];
  const inn2 =
    match.innings?.find((i) => i.team_id === match.team2_id) ??
    match.innings?.[1];

  if (!inn1) return "";

  const inn1Overs = getInningsOverComparison(inn1);
  const inn2Overs = inn2 ? getInningsOverComparison(inn2) : [];

  if (inn1Overs.length === 0 && inn2Overs.length === 0) return "";

  const totalOversMax = Math.max(inn1Overs.length, inn2Overs.length, 1);
  const maxOverRunsRaw = Math.max(
    12,
    ...inn1Overs.map((o) => o.runs),
    ...inn2Overs.map((o) => o.runs),
  );
  const maxOverRuns = Math.ceil(maxOverRunsRaw / 6) * 6;

  const w = 550;
  const h = 210;
  const ml = 35;
  const mr = 15;
  const mt = 32;
  const mb = 28;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  const getY = (r: number) => mt + ph - (r / maxOverRuns) * ph;

  // Gridlines (3 horizontal steps)
  const gridLines: string[] = [];
  for (let step = 0; step <= 3; step++) {
    const val = Math.round((maxOverRuns / 3) * step);
    const gy = getY(val);
    gridLines.push(`
      <line x1="${ml}" y1="${gy}" x2="${ml + pw}" y2="${gy}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${ml - 6}" y="${gy + 3}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="8.5" fill="#94a3b8">${val}</text>
    `);
  }

  const slotW = pw / totalOversMax;
  const barW = Math.max(3, (slotW - 4) / 2);

  const bars: string[] = [];
  const xLabels: string[] = [];
  const tickStep = totalOversMax <= 10 ? 1 : totalOversMax <= 20 ? 2 : 5;

  for (let i = 0; i < totalOversMax; i++) {
    const ovNum = i + 1;
    const o1 = inn1Overs[i];
    const o2 = inn2Overs[i];

    const slotLeft = ml + i * slotW;

    if (o1 && (o1.runs > 0 || o1.wickets > 0)) {
      const bh = (o1.runs / maxOverRuns) * ph;
      const by = mt + ph - bh;
      if (o1.runs > 0) {
        bars.push(
          `<rect x="${(slotLeft + 1).toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="#0f766e" />`,
        );
      }
      if (o1.wickets > 0) {
        bars.push(
          `<circle cx="${(slotLeft + 1 + barW / 2).toFixed(1)}" cy="${(o1.runs > 0 ? Math.max(mt + 4, by - 5) : mt + ph - 4).toFixed(1)}" r="3" fill="#e11d48" />`,
        );
      }
    }

    if (o2 && (o2.runs > 0 || o2.wickets > 0)) {
      const bh = (o2.runs / maxOverRuns) * ph;
      const by = mt + ph - bh;
      if (o2.runs > 0) {
        bars.push(
          `<rect x="${(slotLeft + barW + 2).toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="#d97706" />`,
        );
      }
      if (o2.wickets > 0) {
        bars.push(
          `<circle cx="${(slotLeft + barW + 2 + barW / 2).toFixed(1)}" cy="${(o2.runs > 0 ? Math.max(mt + 4, by - 5) : mt + ph - 4).toFixed(1)}" r="3" fill="#e11d48" />`,
        );
      }
    }

    if (ovNum % tickStep === 0 || ovNum === 1) {
      xLabels.push(
        `<text x="${(slotLeft + slotW / 2).toFixed(1)}" y="${mt + ph + 14}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="8" fill="#94a3b8">${ovNum}</text>`,
      );
    }
  }

  return `
    <svg viewBox="0 0 ${w} ${h}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">
        <rect x="${ml}" y="10" width="10" height="10" rx="2" fill="#0f766e" />
        <text x="${ml + 15}" y="19" font-family="'Outfit', sans-serif" font-size="10" font-weight="700" fill="#090d16">${esc(match.team1.short_name ?? match.team1.name)}</text>

        <rect x="${ml + 150}" y="10" width="10" height="10" rx="2" fill="#d97706" />
        <text x="${ml + 165}" y="19" font-family="'Outfit', sans-serif" font-size="10" font-weight="700" fill="#090d16">${esc(match.team2.short_name ?? match.team2.name)}</text>

        <circle cx="${ml + 300}" cy="15" r="3" fill="#e11d48" />
        <text x="${ml + 308}" y="19" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" fill="#64748b">Wicket</text>

        ${gridLines.join("")}
        ${xLabels.join("")}

        ${bars.join("")}
    </svg>`;
}

// ---------------------------------------------------------------------------
// Official Verification & Sign-off Block
// ---------------------------------------------------------------------------

function renderSignoffBlock(match: Match): string {
  const team1Cap = match.team1.captain?.full_name ?? "Team 1 Captain";
  const team2Cap = match.team2.captain?.full_name ?? "Team 2 Captain";
  const leadUmpire = match.umpire1_name ?? "Lead Match Umpire";
  const scorerRef =
    match.scorer_name ?? match.umpire2_name ?? "Official Scorer";

  const matchIdShort = match.id.slice(0, 8).toUpperCase();
  const dateStr = new Date().toISOString().slice(0, 10);

  const team1Role = match.team1.short_name
    ? `${match.team1.short_name} Captain`
    : `${match.team1.name} Captain`;
  const team2Role = match.team2.short_name
    ? `${match.team2.short_name} Captain`
    : `${match.team2.name} Captain`;

  return `
    <div class="official-signoff-card">
        <div class="signoff-top-bar">
            <div class="signoff-brand-seal">
                <span class="seal-icon"><svg class="inline" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;"><polyline points="20 6 9 17 4 12"/></svg></span>
                <span class="seal-title">Official Verification &amp; Match Sign-off</span>
            </div>
            <div class="signoff-auth-stamp">Certified Official Scoresheet &bull; Laws of Cricket</div>
        </div>

        <div class="signoff-grid">
            <div class="signoff-box">
                <div class="signoff-meta">
                    <div class="signoff-role">${esc(team1Role)}</div>
                    <div class="signoff-name font-medium">${esc(team1Cap)}</div>
                </div>
                <div class="signoff-sig-area">
                    <div class="signoff-sig-line"></div>
                    <div class="signoff-sig-label">Signature &amp; Date</div>
                </div>
            </div>
            <div class="signoff-box">
                <div class="signoff-meta">
                    <div class="signoff-role">${esc(team2Role)}</div>
                    <div class="signoff-name font-medium">${esc(team2Cap)}</div>
                </div>
                <div class="signoff-sig-area">
                    <div class="signoff-sig-line"></div>
                    <div class="signoff-sig-label">Signature &amp; Date</div>
                </div>
            </div>
            <div class="signoff-box">
                <div class="signoff-meta">
                    <div class="signoff-role">Lead Match Umpire</div>
                    <div class="signoff-name font-medium">${esc(leadUmpire)}</div>
                </div>
                <div class="signoff-sig-area">
                    <div class="signoff-sig-line"></div>
                    <div class="signoff-sig-label">Signature &amp; Date</div>
                </div>
            </div>
            <div class="signoff-box">
                <div class="signoff-meta">
                    <div class="signoff-role">Official Scorer / Referee</div>
                    <div class="signoff-name font-medium">${esc(scorerRef)}</div>
                </div>
                <div class="signoff-sig-area">
                    <div class="signoff-sig-line"></div>
                    <div class="signoff-sig-label">Signature &amp; Date</div>
                </div>
            </div>
        </div>

        <div class="signoff-footer">
            <span>By signing above, both teams and officiating umpires ratify this scorecard as the binding and final record of the fixture.</span>
            <span class="font-mono">Match ID: #${matchIdShort} &bull; Verified: ${dateStr}</span>
        </div>
    </div>`;
}

function buildOverComparisonSection(match: Match): string {
  const inn1 = match.innings?.find((i) => i.innings_number === 1) ?? match.innings?.[0];
  const inn2 = match.innings?.find((i) => i.innings_number === 2) ?? match.innings?.[1];

  if (!inn1) return "";

  const inn1Overs = getInningsOverComparison(inn1);
  const inn2Overs = inn2 ? getInningsOverComparison(inn2) : [];

  if (inn1Overs.length === 0 && inn2Overs.length === 0) return "";

  const maxOvers = Math.max(inn1Overs.length, inn2Overs.length);
  const team1Name = inn1.team_id === match.team1_id ? match.team1.name : match.team2.name;
  const team2Name = inn2 ? (inn2.team_id === match.team1_id ? match.team1.name : match.team2.name) : match.team2.name;

  const rows: string[] = [];
  for (let i = 0; i < maxOvers; i++) {
    const o1 = inn1Overs[i];
    const o2 = inn2Overs[i];
    rows.push(`
      <div class="comparison-row">
          <div class="comparison-col">${renderOverCard(o1)}</div>
          <div class="comparison-col">${renderOverCard(o2)}</div>
      </div>
    `);
  }

  return `
    <div class="report-page page-break over-comparison-page">
        <div class="page-inner">
            <div class="section-badge-header">
                <div class="section-title-wrap">
                    <h2 class="section-page-title">Over Comparison &amp; Visual Analytics</h2>
                    <span class="innings-team-pill">Delivery Timeline Analysis</span>
                </div>
            </div>

            <!-- Charts Duo Grid -->
            <div class="charts-duo-grid">
                <div class="chart-panel">
                    <div class="chart-panel-title">Worm Chart &bull; Cumulative Run Progression</div>
                    ${generateWormChartSvg(match)}
                </div>
                <div class="chart-panel">
                    <div class="chart-panel-title">Manhattan Chart &bull; Over-by-Over Runs &amp; Wickets</div>
                    ${generateManhattanChartSvg(match)}
                </div>
            </div>

            <div class="over-comparison-headers">
                <div class="comp-head comp-head-left">
                    <span class="comp-team-label">${esc(team1Name)}</span>
                </div>
                <div class="comp-head comp-head-right">
                    <span class="comp-team-label">${esc(team2Name)}</span>
                </div>
            </div>

            <div class="over-comparison-grid">
                ${rows.join("")}
            </div>

            <!-- Official Signoff & Verification -->
            ${renderSignoffBlock(match)}
        </div>

        <footer class="mini-footer">
            <span>Over Comparison &bull; Stumps Compatible Log</span>
            <span>CricScore Platform &bull; Match Verification</span>
        </footer>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main HTML Builder
// ---------------------------------------------------------------------------

export async function buildMatchReportHtml(
  match: Match,
  matchUrl: string,
): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(matchUrl, {
    margin: 1,
    width: 260,
    color: { dark: "#065f46", light: "#ffffff" },
  });

  const toss = match.toss_winner_team_id
    ? `${match.toss_winner_team_id === match.team1.id ? match.team1.name : match.team2.name} Opted To ${match.toss_decision === "bowl" ? "Bowl" : "Bat"}`
    : null;

  const formattedDate = match.scheduled_at
    ? new Date(match.scheduled_at).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const inn1 =
    match.innings?.find((i) => i.team_id === match.team1_id) ??
    match.innings?.[0];
  const inn2 =
    match.innings?.find((i) => i.team_id === match.team2_id) ??
    match.innings?.[1];

  const formatTeamHeadlineScore = (inn: InningsRow | undefined) => {
    if (!inn) return `<span class="headline-score-empty">Yet to bat</span>`;
    const runs = inn.total_runs ?? 0;
    const wkts = inn.total_wickets ?? 0;
    const balls = inningsBalls(inn);
    const overs = oversFromBalls(balls);
    return `<span class="headline-score font-mono">${runs}/${wkts}</span> <span class="headline-overs">(${overs} ov)</span>`;
  };

  // Top performers summary
  const renderTeamPerformers = (
    battingTeam: Match["team1"],
    bowlingTeam: Match["team2"],
    bInnings: InningsRow | undefined,
  ) => {
    const tBatters = topBatters(bInnings).slice(0, 3);
    const tBowlers = topBowlers(match, bowlingTeam.id).slice(0, 3);

    const bRuns = bInnings?.total_runs ?? 0;
    const bWkts = bInnings?.total_wickets ?? 0;
    const bBalls = inningsBalls(bInnings);
    const bScore = bInnings
      ? `${bRuns}/${bWkts} (${oversFromBalls(bBalls)} ov)`
      : "Yet to bat";

    const batterLines = tBatters.length
      ? tBatters
          .map(
            (b) => `
              <div class="perf-item">
                  <span class="perf-player font-medium">${esc(b.user?.full_name ?? "—")}</span>
                  <span class="perf-metric font-mono font-semibold">${b.runs_scored ?? 0} (${b.balls_faced ?? 0})</span>
              </div>`,
          )
          .join("")
      : `<div class="perf-empty">No batting data</div>`;

    const bowlerLines = tBowlers.length
      ? tBowlers
          .map(
            (b) => `
              <div class="perf-item">
                  <span class="perf-player font-medium">${esc(b.user?.full_name ?? "—")}</span>
                  <span class="perf-metric font-mono font-semibold">${b.wickets_taken ?? 0}/${b.runs_conceded ?? 0}</span>
              </div>`,
          )
          .join("")
      : `<div class="perf-empty">No bowling data</div>`;

    return `
      <div class="summary-team-block">
          <div class="summary-team-bar">
              <span class="summary-team-title">${esc(battingTeam.name)}</span>
              <span class="summary-team-score font-mono">${bScore}</span>
          </div>
          <div class="summary-players-grid">
              <div class="summary-col-batters">${batterLines}</div>
              <div class="summary-col-bowlers">${bowlerLines}</div>
          </div>
      </div>`;
  };

  // POTM
  let potmHtml = "";
  if (match.player_of_the_match) {
    const potmId = match.player_of_the_match.id;
    const potmBat = (match.innings ?? [])
      .flatMap((i) => i.batting_performances ?? [])
      .find((b) => b.user_id === potmId);
    const potmBowl = (match.innings ?? [])
      .flatMap((i) => i.bowling_performances ?? [])
      .find((b) => b.user_id === potmId);

    const stats: string[] = [];
    if (potmBat && (potmBat.runs_scored > 0 || potmBat.balls_faced > 0)) {
      stats.push(
        `${potmBat.runs_scored} (${potmBat.balls_faced}b, ${potmBat.fours}x4, ${potmBat.sixes}x6)`,
      );
    }
    if (
      potmBowl &&
      ((potmBowl.wickets_taken ?? 0) > 0 ||
        (potmBowl.balls_bowled ?? 0) > 0 ||
        (potmBowl.overs_bowled ?? 0) > 0)
    ) {
      stats.push(
        `${potmBowl.wickets_taken}/${potmBowl.runs_conceded} (${formatBowlerOvers(potmBowl)} ov)`,
      );
    }

    potmHtml = `
      <div class="potm-callout">
          <div class="potm-header-label">Player Of The Match</div>
          <div class="potm-hero-name">${esc(match.player_of_the_match.full_name)}</div>
          ${stats.length > 0 ? `<div class="potm-hero-stats">${stats.join(" &bull; ")}</div>` : ""}
      </div>`;
  }

  // Rules List
  const rulesList: string[] = [];
  if (match.wickets_per_innings && match.wickets_per_innings < 10) {
    rulesList.push(`${match.wickets_per_innings} Wickets Cap`);
  }
  if (match.last_man_stands) rulesList.push("Last Man Stands");
  if (match.golden_ball) rulesList.push("Golden Ball Tiebreaker");

  const inningsSectionsHtml = (match.innings ?? [])
    .slice()
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((inn, i) => {
      const team = inn.team_id === match.team1_id ? match.team1 : match.team2;
      return inningsSection(inn, i, team);
    })
    .join("");

  const phaseHtml = renderPhaseAnalysis(match);
  const impactHtml = renderImpactLeaderboard(match);
  const hasPhase = Boolean(phaseHtml);
  const hasImpact = Boolean(impactHtml);
  const narrativeGridHtml =
    hasPhase || hasImpact
      ? `<div class="tactical-narrative-grid ${hasPhase && hasImpact ? "duo-col" : "single-col"}">${phaseHtml}${impactHtml}</div>`
      : "";

  const umpiresStr = [
    match.umpire1_name,
    match.umpire2_name,
    match.third_umpire_name,
  ]
    .filter(Boolean)
    .join(", ");
  const conditionsStr = [match.pitch_conditions, match.weather_conditions]
    .filter(Boolean)
    .join(" &bull; ");

  const overComparisonHtml = buildOverComparisonSection(match);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(match.title)} — Official Match Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>
    @page {
        size: A4 portrait;
        margin: 8mm 10mm 10mm 10mm;
    }

    * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    :root {
        --brand-teal: #0f766e;
        --brand-dark: #042f2e;
        --brand-light: #f0fdfa;
        --slate-900: #090d16;
        --slate-800: #1e293b;
        --slate-700: #334155;
        --slate-600: #475569;
        --slate-400: #94a3b8;
        --slate-200: #e2e8f0;
        --slate-100: #f1f5f9;
        --slate-50: #f8fafc;
    }

    body {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: var(--slate-900);
        background: #f1f5f9;
        margin: 0;
        padding: 0;
        font-size: 11.5px;
        line-height: 1.45;
        -webkit-font-smoothing: antialiased;
    }

    /* Text & Typography Utilities */
    .text-left { text-align: left !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .font-mono { font-family: 'JetBrains Mono', monospace !important; font-variant-numeric: tabular-nums; }
    .font-medium { font-weight: 500 !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-bold { font-weight: 700 !important; }
    .font-black { font-weight: 800 !important; }
    .text-xs { font-size: 10px !important; }
    .py-3 { padding-top: 8px !important; padding-bottom: 8px !important; }
    .muted { color: var(--slate-400) !important; font-style: italic; }

    /* Screen Action Bar */
    #screen-toolbar {
        position: sticky;
        top: 0;
        z-index: 999;
        background: #090d16;
        color: #f8fafc;
        padding: 12px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }
    #screen-toolbar .toolbar-info {
        font-family: 'Outfit', sans-serif;
        font-size: 13px;
        font-weight: 600;
        color: #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    #screen-toolbar .toolbar-actions {
        display: flex;
        gap: 12px;
        align-items: center;
    }
    #screen-toolbar button {
        cursor: pointer;
        padding: 8px 18px;
        font-size: 12px;
        font-weight: 700;
        font-family: 'Plus Jakarta Sans', sans-serif;
        border-radius: 8px;
        border: none;
        transition: transform 0.15s, opacity 0.15s;
    }
    #screen-toolbar .btn-print {
        background: #0d9488;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
    }
    #screen-toolbar .btn-close {
        background: #1e293b;
        color: #f1f5f9;
        border: 1px solid #334155;
    }
    #screen-toolbar button:hover {
        opacity: 0.92;
        transform: translateY(-1px);
    }

    @media print {
        #screen-toolbar { display: none !important; }
        body { background: #ffffff !important; padding: 0 !important; }
        .page-break { page-break-before: always; break-before: page; }
        .report-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
        }
    }

    /* Page Canvas Frame */
    .report-page {
        width: 100%;
        max-width: 840px;
        margin: 20px auto;
        background: #ffffff;
        padding: 24px 28px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 1100px;
    }

    .page-inner {
        flex: 1 0 auto;
    }

    /* Headings & Brand Mark */
    .report-top-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid var(--slate-100);
        padding-bottom: 12px;
        margin-bottom: 16px;
    }
    .brand-mark {
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: var(--brand-teal);
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .brand-mark span.badge-sub {
        font-size: 10.5px;
        font-weight: 600;
        color: var(--slate-600);
        letter-spacing: normal;
        text-transform: none;
    }
    .org-badges {
        display: flex;
        gap: 6px;
    }
    .badge {
        font-size: 10px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .badge-tournament {
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
    }
    .badge-club {
        background: #e0f2fe;
        color: #0369a1;
        border: 1px solid #bae6fd;
    }

    h1.report-main-title {
        font-family: 'Outfit', sans-serif;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0 0 16px;
        color: var(--brand-teal);
    }

    /* Top Head-to-Head Duel Card */
    .match-duel-hero {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 20px;
    }
    .duel-teams-col {
        display: flex;
        flex-direction: column;
        gap: 12px;
        justify-content: center;
    }
    .duel-team-item {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .team-avatar-crest {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0d9488, #0f766e);
        color: #ffffff;
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        flex-shrink: 0;
        overflow: hidden;
    }
    .team-avatar-crest img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .duel-team-info {
        display: flex;
        flex-direction: column;
    }
    .duel-team-name {
        font-family: 'Outfit', sans-serif;
        font-size: 15px;
        font-weight: 800;
        color: var(--slate-900);
        letter-spacing: 0.02em;
        text-transform: uppercase;
    }
    .headline-score {
        font-family: 'JetBrains Mono', monospace;
        font-size: 15px;
        font-weight: 700;
        color: var(--slate-800);
    }
    .headline-overs {
        font-size: 11px;
        color: var(--slate-600);
    }

    .duel-outcome-col {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 8px;
        border-left: 1px dashed #cbd5e1;
        padding-left: 18px;
    }
    .result-pill-box {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .result-pill-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--brand-teal);
    }
    .result-pill-desc {
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        font-weight: 800;
        color: var(--slate-900);
    }

    .potm-callout {
        display: flex;
        flex-direction: column;
        gap: 1px;
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px solid #e2e8f0;
    }
    .potm-header-label {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #d97706;
    }
    .potm-hero-name {
        font-family: 'Outfit', sans-serif;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--slate-900);
    }
    .potm-hero-stats {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        color: var(--slate-600);
    }

    /* Section Headers */
    .section-title {
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: var(--brand-teal);
        margin: 0 0 10px;
        text-transform: capitalize;
    }

    /* Match Information Card */
    .match-info-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 18px;
        margin-bottom: 20px;
    }
    .info-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        column-gap: 28px;
        row-gap: 8px;
    }
    .info-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        font-size: 11px;
        border-bottom: 1px solid #edf2f7;
        padding-bottom: 4px;
        min-width: 0;
    }
    .info-label {
        color: var(--slate-600);
        font-weight: 500;
        white-space: nowrap;
        flex-shrink: 0;
    }
    .info-val {
        color: var(--slate-900);
        font-weight: 700;
        text-align: right;
        word-break: break-word;
        min-width: 0;
    }

    /* Match Summary (Top Performers by Team) */
    .summary-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 18px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .summary-team-block {
        margin-bottom: 14px;
    }
    .summary-team-block:last-child {
        margin-bottom: 0;
        border-top: 1px solid #f1f5f9;
        padding-top: 12px;
    }
    .summary-team-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
    }
    .summary-team-title {
        font-family: 'Outfit', sans-serif;
        font-size: 13px;
        font-weight: 800;
        color: var(--brand-teal);
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }
    .summary-team-score {
        font-size: 12.5px;
        font-weight: 700;
        color: var(--slate-800);
    }
    .summary-players-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }
    .perf-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
        font-size: 11px;
    }
    .perf-player {
        color: var(--slate-800);
    }
    .perf-metric {
        color: var(--brand-teal);
    }
    .perf-empty {
        font-size: 10.5px;
        color: var(--slate-400);
        padding: 4px 0;
    }

    /* Innings Scorecard & Tables */
    .section-badge-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        border-bottom: 2px solid var(--brand-teal);
        padding-bottom: 8px;
    }
    .section-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .section-page-title {
        font-family: 'Outfit', sans-serif;
        font-size: 18px;
        font-weight: 800;
        color: var(--brand-teal);
        margin: 0;
    }
    .innings-team-pill {
        font-size: 11px;
        font-weight: 700;
        color: var(--slate-700);
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        padding: 2px 8px;
        border-radius: 6px;
        text-transform: uppercase;
    }
    .innings-score-pill {
        display: flex;
        align-items: baseline;
        gap: 6px;
    }
    .score-main {
        font-family: 'JetBrains Mono', monospace;
        font-size: 17px;
        font-weight: 800;
        color: var(--brand-teal);
    }
    .score-details {
        font-size: 11px;
        color: var(--slate-600);
    }

    .innings, .card-shell {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
        margin-bottom: 16px;
    }

    .table-subheading {
        font-family: 'Outfit', sans-serif;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--slate-600);
        background: #f8fafc;
        padding: 6px 12px;
        border-bottom: 1px solid #e2e8f0;
    }

    .score-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
    }
    .score-table th {
        background: #fafafa;
        color: var(--slate-600);
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 6px 10px;
        border-bottom: 1.5px solid #cbd5e1;
        text-align: right;
    }
    .score-table th.name { text-align: left; }
    .score-table td {
        padding: 5px 10px;
        border-bottom: 1px solid #f1f5f9;
    }
    .score-table td.name { text-align: left; }
    .score-table td.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .score-table tbody tr:nth-child(even) {
        background: #fbfcfe;
    }

    .player-name {
        font-family: 'Outfit', sans-serif;
        font-weight: 600;
        color: var(--slate-900);
        font-size: 11.5px;
    }
    .howout {
        color: var(--slate-600);
        font-size: 10px;
        font-style: italic;
    }

    .milestone-badge {
        display: inline-block;
        font-weight: 800;
        font-size: 10.5px;
        padding: 1px 5px;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
    }
    .milestone-badge.fifty {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #bbf7d0;
    }
    .milestone-badge.century {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
    }
    .milestone-badge.three-wkt {
        background: #f3e8ff;
        color: #7e22ce;
        border: 1px solid #e9d5ff;
    }

    .extras-row td {
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        color: var(--slate-700);
        font-size: 10.5px;
    }
    .totals-row td {
        background: #f1f5f9;
        font-weight: 700;
        border-top: 1.5px solid #cbd5e1;
        border-bottom: none;
        padding: 6px 10px;
    }

    .dnb-strip {
        font-size: 10.5px;
        color: var(--slate-600);
        padding: 6px 12px;
        background: #fdfdfd;
        border-bottom: 1px solid #f1f5f9;
    }

    .fow {
        padding: 8px 12px;
        background: #f8fafc;
        border-top: 1px solid #f1f5f9;
        font-size: 10.5px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: baseline;
    }
    .fow-label {
        font-family: 'Outfit', sans-serif;
        font-weight: 700;
        color: var(--slate-700);
    }
    .fow-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .fow-item {
        color: var(--slate-800);
    }
    .fow-sub {
        color: var(--slate-600);
    }

    /* Over Comparison (Page 4) */
    .over-comparison-headers {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 12px;
    }
    .comp-head {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 6px 12px;
        text-align: center;
    }
    .comp-team-label {
        font-family: 'Outfit', sans-serif;
        font-size: 12px;
        font-weight: 800;
        color: var(--brand-teal);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .over-comparison-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .comparison-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }
    .over-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .over-card.empty {
        background: transparent;
        border: 1px dashed #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 70px;
    }
    .over-empty-text {
        color: var(--slate-400);
        font-size: 14px;
    }
    .over-balls-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
    }
    .ball-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 20px;
        padding: 0 4px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        font-family: 'JetBrains Mono', monospace;
    }
    .ball-dot { background: #f1f5f9; color: var(--slate-600); border: 1px solid #e2e8f0; }
    .ball-single { background: #ffffff; color: var(--slate-900); border: 1px solid #cbd5e1; }
    .ball-four { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 800; }
    .ball-six { background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; font-weight: 800; }
    .ball-wicket { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: 800; }
    .ball-extra { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }

    .over-details-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10px;
    }
    .over-crease-batter {
        color: var(--slate-800);
        font-weight: 500;
    }
    .over-bowler-col {
        text-align: right;
    }
    .over-bowler-name {
        font-weight: 600;
        color: var(--slate-900);
    }
    .over-bowler-figs {
        color: var(--slate-600);
        font-size: 9.5px;
    }
    .over-footer-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 9.5px;
        font-weight: 700;
        color: var(--slate-600);
        border-top: 1px solid #e2e8f0;
        padding-top: 4px;
        margin-top: 2px;
    }
    .over-running-score {
        color: var(--brand-teal);
        font-weight: 800;
    }

    /* Verification & Footer */
    .report-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 2px solid var(--slate-100);
        margin-top: 24px;
        padding-top: 12px;
    }
    .footer-left-meta {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .footer-title {
        font-family: 'Outfit', sans-serif;
        font-size: 11px;
        font-weight: 700;
        color: var(--brand-teal);
    }
    .footer-url {
        font-size: 10.5px;
        color: var(--slate-600);
        font-family: 'JetBrains Mono', monospace;
    }
    .footer-stamp {
        font-size: 9px;
        color: var(--slate-400);
    }
    .footer-qr-block {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .footer-qr-caption {
        font-size: 9.5px;
        color: var(--slate-600);
        max-width: 120px;
        text-align: right;
        line-height: 1.3;
    }
    .footer-qr-block img {
        width: 72px;
        height: 72px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 2px;
    }

    .mini-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #e2e8f0;
        padding-top: 8px;
        margin-top: 16px;
        font-size: 9.5px;
        color: var(--slate-400);
    }

    /* Partnerships Grid */
    .partnerships-wrap {
        margin: 12px 0 14px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
    }
    .partnerships-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        padding: 8px 10px;
        background: #fcfdfe;
    }
    .partnership-card {
        background: #ffffff;
        border: 1px solid #edf2f7;
        border-radius: 8px;
        padding: 6px 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .part-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
    }
    .part-wkt-badge {
        font-family: 'Outfit', sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: var(--brand-teal);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .part-runs-score {
        font-size: 11px;
        color: var(--slate-700);
        font-variant-numeric: tabular-nums;
    }
    .part-bar-track {
        display: flex;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        background: #f1f5f9;
        margin-bottom: 5px;
    }
    .part-bar-seg.seg-1 {
        background: #0f766e;
    }
    .part-bar-seg.seg-2 {
        background: #d97706;
    }
    .part-batters-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10.5px;
        gap: 8px;
    }
    .part-bat-col {
        display: flex;
        align-items: baseline;
        gap: 5px;
        min-width: 0;
        flex: 1;
    }
    .part-bat-col.left {
        text-align: left;
        justify-content: flex-start;
    }
    .part-bat-col.right {
        text-align: right;
        justify-content: flex-end;
    }
    .part-bat-name {
        color: var(--slate-900);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
    }
    .part-bat-runs {
        color: var(--slate-600);
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }

    /* Tactical Narrative Grid: Phase Analysis & Impact */
    .tactical-narrative-grid {
        display: grid;
        gap: 16px;
        margin-bottom: 20px;
    }
    .tactical-narrative-grid.duo-col {
        grid-template-columns: 1fr 1fr;
    }
    .tactical-narrative-grid.single-col {
        grid-template-columns: 1fr;
    }
    .phase-analysis-card, .impact-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .phase-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
    }
    .phase-table th {
        font-family: 'Outfit', sans-serif;
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--slate-600);
        padding: 6px 8px;
        border-bottom: 1.5px solid #e2e8f0;
    }
    .phase-table td {
        padding: 7px 8px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
    }
    .phase-name {
        display: flex;
        flex-direction: column;
    }
    .phase-title {
        font-weight: 700;
        color: var(--slate-900);
    }
    .phase-sub {
        font-size: 9px;
        color: var(--slate-400);
    }
    .phase-score {
        display: block;
        font-size: 12px;
        font-weight: 700;
        color: var(--slate-900);
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
    }
    .phase-rr {
        display: block;
        font-size: 9.5px;
        color: var(--slate-600);
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
        margin-top: 1px;
    }
    .adv-pill {
        font-family: 'Outfit', sans-serif;
        font-size: 9.5px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        display: inline-block;
        letter-spacing: 0.03em;
    }
    .adv-team1 {
        background: #ccfbf1;
        color: #0f766e;
    }
    .adv-team2 {
        background: #fef3c7;
        color: #b45309;
    }
    .adv-neutral {
        background: #f1f5f9;
        color: #64748b;
    }

    /* Impact Leaderboard */
    .impact-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
    }
    .impact-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        background: #f8fafc;
        border: 1px solid #edf2f7;
        border-radius: 6px;
    }
    .impact-rank {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Outfit', sans-serif;
        font-size: 10px;
        font-weight: 800;
        flex-shrink: 0;
    }
    .rank-gold {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
    }
    .rank-silver {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
    }
    .rank-bronze {
        background: #ffedd5;
        color: #c2410c;
        border: 1px solid #fed7aa;
    }
    .rank-default {
        background: #ffffff;
        color: #64748b;
        border: 1px solid #e2e8f0;
    }
    .impact-details {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .impact-top-line {
        display: flex;
        align-items: baseline;
        gap: 6px;
    }
    .impact-name {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--slate-900);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .impact-tag {
        font-size: 9px;
        color: var(--slate-600);
        background: #ffffff;
        border: 1px solid #e2e8f0;
        padding: 1px 4px;
        border-radius: 3px;
        flex-shrink: 0;
    }
    .impact-highlight {
        font-size: 9.5px;
        color: var(--slate-600);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .impact-pts {
        text-align: right;
        flex-shrink: 0;
        min-width: 36px;
    }
    .impact-score {
        font-size: 13px;
        font-weight: 800;
        color: var(--brand-teal);
        display: block;
        line-height: 1.1;
    }
    .impact-pts-label {
        font-size: 8.5px;
        color: var(--slate-400);
        text-transform: uppercase;
        display: block;
        line-height: 1;
    }

    /* Charts Duo Grid */
    .charts-duo-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-bottom: 16px;
    }
    .chart-panel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        overflow: hidden;
    }
    .chart-panel-title {
        font-family: 'Outfit', sans-serif;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--slate-700);
        letter-spacing: 0.05em;
        margin: 0 0 8px;
    }
    .chart-svg {
        width: 100%;
        height: auto;
        display: block;
    }

    /* Official Verification Sign-off */
    .official-signoff-card {
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        border-radius: 10px;
        padding: 14px 16px;
        margin-top: 16px;
        page-break-inside: avoid;
    }
    .signoff-top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 8px;
        margin-bottom: 12px;
    }
    .signoff-brand-seal {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .seal-icon {
        width: 18px;
        height: 18px;
        background: #0f766e;
        color: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
    }
    .seal-title {
        font-family: 'Outfit', sans-serif;
        font-size: 12px;
        font-weight: 800;
        color: var(--slate-900);
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }
    .signoff-auth-stamp {
        font-size: 9.5px;
        font-weight: 600;
        color: var(--slate-600);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .signoff-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 10px;
    }
    .signoff-box {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 10px 12px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 82px;
    }
    .signoff-role {
        font-family: 'Outfit', sans-serif;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--brand-teal);
        letter-spacing: 0.04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .signoff-name {
        font-size: 11px;
        color: var(--slate-900);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .signoff-sig-area {
        margin-top: 14px;
    }
    .signoff-sig-line {
        border-bottom: 1px dashed #94a3b8;
        height: 18px;
        margin-bottom: 3px;
        width: 100%;
    }
    .signoff-sig-label {
        font-size: 8px;
        color: var(--slate-400);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .signoff-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        font-size: 8.5px;
        color: var(--slate-500);
        padding-top: 8px;
        border-top: 1px solid #f1f5f9;
        margin-top: 4px;
    }
</style>
</head>
<body>
    <div id="screen-toolbar">
        <div class="toolbar-info">
            <span><svg style="width:14px;height:14px;display:inline-block;vertical-align:-2px;margin-right:4px;" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>CricScore Match Report &bull; Print Preview</span>
        </div>
        <div class="toolbar-actions">
            <button class="btn-print" onclick="window.print()">
                Save as PDF / Print
            </button>
            <button class="btn-close" onclick="window.close()">
                Close
            </button>
        </div>
    </div>

    <!-- PAGE 1: Match Report Overview & Top Performers -->
    <div class="report-page match-overview-page">
        <div class="page-inner">
            <header class="report-top-header">
                <div class="brand-mark">
                    <span><svg style="width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:5px;color:#10b981;" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>CricScore</span>
                    <span style="font-weight: normal; color: #cbd5e1;">|</span>
                    <span class="badge-sub">Official Match Record</span>
                </div>
                <div class="org-badges">
                    ${match.tournament ? `<span class="badge badge-tournament"><svg style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>${esc(match.tournament.name)}</span>` : ""}
                    ${match.club ? `<span class="badge badge-club"><svg style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${esc(match.club.name)}</span>` : ""}
                </div>
            </header>

            <h1 class="report-main-title">Match Report</h1>

            <!-- Head-to-Head Duel Card -->
            <div class="match-duel-hero">
                <div class="duel-teams-col">
                    <div class="duel-team-item">
                        <div class="team-avatar-crest">
                            ${match.team1.logo_url ? `<img src="${esc(match.team1.logo_url)}" alt="${esc(match.team1.name)}" />` : esc(match.team1.short_name?.slice(0, 3) || match.team1.name.slice(0, 2).toUpperCase())}
                        </div>
                        <div class="duel-team-info">
                            <span class="duel-team-name">${esc(match.team1.name)}</span>
                            <div>${formatTeamHeadlineScore(inn1)}</div>
                        </div>
                    </div>
                    <div class="duel-team-item">
                        <div class="team-avatar-crest">
                            ${match.team2.logo_url ? `<img src="${esc(match.team2.logo_url)}" alt="${esc(match.team2.name)}" />` : esc(match.team2.short_name?.slice(0, 3) || match.team2.name.slice(0, 2).toUpperCase())}
                        </div>
                        <div class="duel-team-info">
                            <span class="duel-team-name">${esc(match.team2.name)}</span>
                            <div>${formatTeamHeadlineScore(inn2)}</div>
                        </div>
                    </div>
                </div>

                <div class="duel-outcome-col">
                    <div class="result-pill-box">
                        <span class="result-pill-label">Result</span>
                        <span class="result-pill-desc">${esc(match.result_description ?? "Match Completed")}</span>
                    </div>
                    ${potmHtml}
                </div>
            </div>

            <!-- Tactical Narrative Grid: Phase Analysis & Match Impact -->
            ${narrativeGridHtml}

            <!-- Match Information -->
            <div class="section-title">Match Information &amp; Playing Conditions</div>
            <div class="match-info-card">
                <div class="info-grid">
                    <div class="info-row">
                        <span class="info-label">Organiser</span>
                        <span class="info-val">${esc(match.tournament?.name ?? match.club?.name ?? "Host Organiser")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Match Title</span>
                        <span class="info-val">${esc(match.title)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Match Format</span>
                        <span class="info-val">${esc(match.match_format)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Playing</span>
                        <span class="info-val">11 Per Side</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Overs</span>
                        <span class="info-val">${match.overs_per_innings} ov per side</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Venue</span>
                        <span class="info-val">${esc(match.venue ?? "—")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Date &amp; Time</span>
                        <span class="info-val">${formattedDate}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Toss</span>
                        <span class="info-val">${esc(toss ?? "—")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Match Umpires</span>
                        <span class="info-val">${esc(umpiresStr || (match.umpire1_name ?? "Official League Umpires"))}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Official Scorer</span>
                        <span class="info-val">${esc(match.scorer_name ?? match.umpire2_name ?? "Official Scorer")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Ball Type</span>
                        <span class="info-val">${esc(match.ball_type ?? "Standard Leather Ball")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Match ID</span>
                        <span class="info-val font-mono">#${esc(match.id.slice(0, 8))}</span>
                    </div>
                    ${conditionsStr ? `<div class="info-row" style="grid-column: span 2;"><span class="info-label">Pitch &amp; Weather</span><span class="info-val">${conditionsStr}</span></div>` : ""}
                    ${rulesList.length > 0 ? `<div class="info-row" style="grid-column: span 2;"><span class="info-label">Special Rules</span><span class="info-val">${rulesList.map(esc).join(", ")}</span></div>` : ""}
                </div>
            </div>

            <!-- Match Summary (Top Performers by Team) -->
            <div class="section-title">Match Summary</div>
            <div class="summary-card">
                ${renderTeamPerformers(match.team1, match.team2, inn1)}
                ${renderTeamPerformers(match.team2, match.team1, inn2)}
            </div>
        </div>

        <footer class="report-footer">
            <div class="footer-left-meta">
                <div class="footer-title">Interactive Digital Scorecard &bull; CricScore Official Archive</div>
                <div class="footer-url">${esc(matchUrl)}</div>
                <div class="footer-stamp">Download CricScore App &bull; Verified Electronic Record</div>
            </div>
            <div class="footer-qr-block">
                <div class="footer-qr-caption">Scan to view live ball log &amp; wagon wheel</div>
                <img src="${qrDataUrl}" alt="QR code" />
            </div>
        </footer>
    </div>

    <!-- INNINGS SCORECARDS (Pages 2 & 3) -->
    ${inningsSectionsHtml}

    <!-- OVER COMPARISON (Page 4, if delivery ball log exists) -->
    ${overComparisonHtml || `
    <!-- Fallback Signoff Page if no delivery logs -->
    <div class="report-page page-break signoff-page">
        <div class="page-inner">
            <div class="section-badge-header">
                <div class="section-title-wrap">
                    <h2 class="section-page-title">Match Certification &amp; Sign-off</h2>
                    <span class="innings-team-pill">Official Verification</span>
                </div>
            </div>
            ${renderSignoffBlock(match)}
        </div>
        <footer class="mini-footer">
            <span>Official Scorecard &bull; Certified Record</span>
            <span>CricScore Platform &bull; Match Verification</span>
        </footer>
    </div>
    `}
</body>
</html>`;
}
