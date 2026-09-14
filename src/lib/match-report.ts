import QRCode from "qrcode";
import type { Match } from "./match-types";
import {
  bowlerEconomy,
  dismissalText,
  formatBowlerOvers,
  formatDecimalOvers,
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
    return `<tr><td colspan="6" class="muted text-center py-2">No batting recorded</td></tr>`;
  }

  return batters
    .map((b) => {
      const runs = b.runs_scored ?? 0;
      const isCentury = runs >= 100;
      const isFifty = runs >= 50 && runs < 100;
      const runBadge = isCentury
        ? `<span class="milestone-badge century">${runs} ★</span>`
        : isFifty
          ? `<span class="milestone-badge fifty">${runs}</span>`
          : `<span class="run-val">${runs}</span>`;

      return `<tr>
                <td class="name">
                    <span class="player-name">${esc(b.user?.full_name ?? "—")}</span>
                    <span class="howout">${esc(dismissalText(b, inn.fall_of_wickets ?? []))}</span>
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
    ? ` <span class="extras-detail">(${parts.join(", ")})</span>`
    : "";
  return `<tr class="extras-row">
        <td class="name">Extras ${breakdown}</td>
        <td class="num font-bold">${inn.extras_total ?? 0}</td>
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
    return `<tr><td colspan="8" class="muted text-center py-2">No bowling recorded</td></tr>`;
  }

  return bowlers
    .map((b) => {
      const wkts = b.wickets_taken ?? 0;
      const wktBadge =
        wkts >= 5
          ? `<span class="milestone-badge century">${wkts} ★</span>`
          : wkts >= 3
            ? `<span class="milestone-badge three-wkt">${wkts}</span>`
            : `<strong>${wkts}</strong>`;

      return `<tr>
                <td class="name font-medium">${esc(b.user?.full_name ?? "—")}</td>
                <td class="num">${formatBowlerOvers(b)}</td>
                <td class="num">${b.maidens ?? 0}</td>
                <td class="num">${b.runs_conceded ?? 0}</td>
                <td class="num">${wktBadge}</td>
                <td class="num font-mono">${bowlerEconomy(b)}</td>
                <td class="num">${b.wides ?? 0}</td>
                <td class="num">${b.no_balls ?? 0}</td>
            </tr>`;
    })
    .join("");
}

function inningsSection(
  inn: InningsRow,
  index: number,
  team: Match["team1"] | Match["team2"],
): string {
  const balls = inn.total_balls ?? 0;
  const overs = oversFromBalls(balls);
  const rr =
    balls > 0 ? ((inn.total_runs ?? 0) / (balls / 6)).toFixed(2) : "0.00";
  const total = `${inn.total_runs ?? 0}${(inn.total_wickets ?? 0) >= 10 ? "" : `/${inn.total_wickets ?? 0}`}`;

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
    <section class="innings">
        <div class="innings-header">
            <div class="innings-title">
                <span class="innings-team">${esc(team.name)}</span>
                <span class="innings-tag">Innings ${index + 1}</span>
            </div>
            <div class="innings-score-pill">
                <span class="score-main">${total}</span>
                <span class="score-details">(${overs} ov &bull; RR: ${rr}${inn.is_completed ? "" : ", in progress"})</span>
            </div>
        </div>

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
                        <th class="num">Econ</th>
                        <th class="num">Wd</th>
                        <th class="num">Nb</th>
                    </tr>
                </thead>
                <tbody>
                    ${bowlingRows(inn)}
                </tbody>
            </table>
        </div>
    </section>`;
}

export async function buildMatchReportHtml(
  match: Match,
  matchUrl: string,
): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(matchUrl, {
    margin: 1,
    width: 240,
    color: { dark: "#064e3b", light: "#ffffff" },
  });

  const toss = match.toss_winner_team_id
    ? `${match.toss_winner_team_id === match.team1.id ? match.team1.name : match.team2.name} won the toss and elected to ${match.toss_decision ?? "bat"}`
    : null;

  const formattedDate = match.scheduled_at
    ? new Date(match.scheduled_at).toLocaleString("en-GB", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : null;

  // Team snapshot calculations
  const inn1 =
    match.innings?.find((i) => i.team_id === match.team1_id) ??
    match.innings?.[0];
  const inn2 =
    match.innings?.find((i) => i.team_id === match.team2_id) ??
    match.innings?.[1];

  const formatInningsSnapshot = (inn: InningsRow | undefined) => {
    if (!inn) return `<div class="snapshot-score">—</div>`;
    const total = `${inn.total_runs ?? 0}${(inn.total_wickets ?? 0) >= 10 ? "" : `/${inn.total_wickets ?? 0}`}`;
    const overs = oversFromBalls(inn.total_balls ?? 0);
    const rr =
      (inn.total_balls ?? 0) > 0
        ? ((inn.total_runs ?? 0) / ((inn.total_balls ?? 0) / 6)).toFixed(2)
        : "0.00";
    return `
            <div class="snapshot-score">
                <span class="snapshot-runs">${total}</span>
                <span class="snapshot-overs">(${overs} ov)</span>
            </div>
            <div class="snapshot-meta">RR: ${rr} &bull; Extras: ${inn.extras_total ?? 0}</div>
        `;
  };

  // POTM spotlight data
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
        <div class="potm-card">
            <div class="potm-icon">★</div>
            <div class="potm-text">
                <div class="potm-badge">PLAYER OF THE MATCH</div>
                <div class="potm-name">${esc(match.player_of_the_match.full_name)}</div>
                ${stats.length > 0 ? `<div class="potm-stats">${stats.join(" &bull; ")}</div>` : ""}
            </div>
        </div>`;
  }

  // Rules / Conditions
  const rulesList: string[] = [];
  if (match.wickets_per_innings && match.wickets_per_innings < 10) {
    rulesList.push(`${match.wickets_per_innings} Wickets Cap`);
  }
  if (match.last_man_stands) rulesList.push("Last Man Stands");
  if (match.golden_ball) rulesList.push("Golden Ball Tiebreaker");
  if (match.umpire1_name || match.umpire2_name) {
    const umps = [match.umpire1_name, match.umpire2_name]
      .filter(Boolean)
      .join(" & ");
    rulesList.push(`Umpires: ${umps}`);
  }

  const inningsHtml = (match.innings ?? [])
    .slice()
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((inn, i) => {
      const team = inn.team_id === match.team1_id ? match.team1 : match.team2;
      return inningsSection(inn, i, team);
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(match.title)} — Official Match Report</title>
<style>
    @page {
        size: A4 portrait;
        margin: 10mm 12mm 12mm 12mm;
    }

    * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        margin: 0;
        padding: 0;
        font-size: 11.5px;
        line-height: 1.45;
    }

    /* Screen Action Bar */
    #screen-toolbar {
        position: sticky;
        top: 0;
        z-index: 999;
        background: #0f172a;
        color: #f8fafc;
        padding: 10px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    #screen-toolbar .toolbar-info {
        font-size: 12px;
        font-weight: 500;
        color: #cbd5e1;
    }
    #screen-toolbar .toolbar-actions {
        display: flex;
        gap: 10px;
        align-items: center;
    }
    #screen-toolbar button {
        cursor: pointer;
        padding: 7px 16px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        border: none;
        transition: opacity 0.2s;
    }
    #screen-toolbar .btn-print {
        background: #10b981;
        color: #ffffff;
    }
    #screen-toolbar .btn-close {
        background: #334155;
        color: #f1f5f9;
    }
    #screen-toolbar button:hover { opacity: 0.9; }

    @media print {
        #screen-toolbar { display: none !important; }
        body { padding: 0; }
    }

    .report-sheet {
        max-width: 820px;
        margin: 0 auto;
        padding: 16px 20px 24px;
    }

    /* Header & Badges */
    header {
        border-bottom: 2.5px solid #047857;
        padding-bottom: 14px;
        margin-bottom: 16px;
    }
    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    .brand-mark {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1.5px;
        color: #047857;
        text-transform: uppercase;
    }
    .org-badges {
        display: flex;
        gap: 6px;
    }
    .badge {
        font-size: 10px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
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

    h1 {
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.5px;
        margin: 0 0 6px;
        color: #0f172a;
    }

    .meta-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 11px;
        color: #475569;
        margin-top: 8px;
    }
    .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .meta-item strong { color: #1e293b; }

    /* Result & POTM Hero */
    .hero-summary {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        align-items: center;
    }
    .result-text {
        font-size: 15px;
        font-weight: 800;
        color: #166534;
        margin: 0;
    }
    .toss-info {
        font-size: 11px;
        color: #15803d;
        margin-top: 3px;
    }

    .potm-card {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #ffffff;
        border: 1px solid #fbbf24;
        border-radius: 6px;
        padding: 8px 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .potm-icon {
        font-size: 18px;
        color: #d97706;
    }
    .potm-badge {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.8px;
        color: #b45309;
        text-transform: uppercase;
    }
    .potm-name {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
    }
    .potm-stats {
        font-size: 10.5px;
        color: #64748b;
        font-family: monospace;
    }

    /* Snapshot duel strip */
    .match-snapshot {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px 16px;
        margin-bottom: 18px;
        align-items: center;
    }
    .snapshot-team {
        display: flex;
        flex-direction: column;
    }
    .snapshot-team.right {
        text-align: right;
    }
    .snapshot-team-name {
        font-size: 12px;
        font-weight: 700;
        color: #334155;
    }
    .snapshot-score {
        display: flex;
        align-items: baseline;
        gap: 6px;
    }
    .snapshot-team.right .snapshot-score {
        justify-content: flex-end;
    }
    .snapshot-runs {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        font-family: monospace;
    }
    .snapshot-overs {
        font-size: 11px;
        color: #64748b;
    }
    .snapshot-meta {
        font-size: 10.5px;
        color: #64748b;
    }
    .snapshot-vs {
        font-size: 11px;
        font-weight: 800;
        color: #94a3b8;
        padding: 4px 8px;
        border-radius: 50%;
        background: #ffffff;
        border: 1px solid #e2e8f0;
    }

    /* Innings Section */
    .innings {
        margin-bottom: 22px;
        page-break-inside: avoid;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        background: #ffffff;
    }
    .innings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        padding: 8px 14px;
    }
    .innings-title {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .innings-team {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
    }
    .innings-tag {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 3px;
        background: #e2e8f0;
        color: #475569;
        text-transform: uppercase;
    }
    .innings-score-pill {
        display: flex;
        align-items: baseline;
        gap: 6px;
    }
    .score-main {
        font-size: 16px;
        font-weight: 800;
        font-family: monospace;
        color: #047857;
    }
    .score-details {
        font-size: 11px;
        color: #64748b;
    }

    /* Score Tables */
    .score-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
    }
    .score-table th {
        background: #fafafa;
        color: #475569;
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
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
        font-weight: 600;
        color: #0f172a;
    }
    .howout {
        color: #64748b;
        font-size: 10.5px;
        margin-left: 6px;
        font-style: italic;
    }

    /* Milestones */
    .milestone-badge {
        display: inline-block;
        font-weight: 800;
        font-size: 11px;
        padding: 1px 5px;
        border-radius: 4px;
        font-family: monospace;
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

    /* Table specials */
    .extras-row td {
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        color: #475569;
        font-size: 10.5px;
    }
    .extras-detail {
        font-style: italic;
        color: #64748b;
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
        color: #64748b;
        padding: 6px 12px;
        background: #fdfdfd;
        border-bottom: 1px solid #f1f5f9;
    }

    /* FOW */
    .fow {
        padding: 6px 12px;
        background: #f8fafc;
        border-top: 1px solid #f1f5f9;
        font-size: 10.5px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: baseline;
    }
    .fow-label {
        font-weight: 700;
        color: #475569;
    }
    .fow-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .fow-item {
        color: #334155;
    }
    .fow-sub {
        color: #64748b;
    }

    /* Bowling */
    .bowling-wrap {
        border-top: 1px solid #e2e8f0;
    }
    .table-subheading {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #64748b;
        background: #f8fafc;
        padding: 4px 10px;
        border-bottom: 1px solid #f1f5f9;
    }

    /* Footer / Authenticity */
    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 2px solid #e2e8f0;
        margin-top: 20px;
        padding-top: 12px;
        page-break-inside: avoid;
    }
    .cert-block {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .cert-title {
        font-size: 11px;
        font-weight: 700;
        color: #0f172a;
    }
    .cert-link {
        font-size: 10.5px;
        color: #047857;
        font-weight: 600;
        word-break: break-all;
    }
    .cert-stamp {
        font-size: 9.5px;
        color: #94a3b8;
    }
    .qr-block {
        display: flex;
        align-items: center;
        gap: 8px;
        text-align: right;
    }
    .qr-block img {
        width: 80px;
        height: 80px;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 2px;
    }
    .qr-caption {
        font-size: 9.5px;
        color: #64748b;
        max-width: 110px;
        line-height: 1.3;
    }
</style>
</head>
<body>
    <div id="screen-toolbar">
        <div class="toolbar-info">
            CricScore Match Report &bull; Print Preview
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

    <div class="report-sheet">
        <header>
            <div class="header-top">
                <div class="brand-mark">
                    <span>⚡ CricScore</span>
                    <span style="font-weight: normal; color: #94a3b8;">|</span>
                    <span style="font-weight: 600; font-size: 11px; color: #64748b;">Official Match Record</span>
                </div>
                <div class="org-badges">
                    ${match.tournament ? `<span class="badge badge-tournament">🏆 ${esc(match.tournament.name)}</span>` : ""}
                    ${match.club ? `<span class="badge badge-club">🛡️ ${esc(match.club.name)}</span>` : ""}
                </div>
            </div>

            <h1>${esc(match.title)}</h1>

            <div class="meta-grid">
                <div class="meta-item"><strong>Format:</strong> ${esc(match.match_format)} &bull; ${match.overs_per_innings} ov/side</div>
                ${match.venue ? `<div class="meta-item"><strong>Venue:</strong> ${esc(match.venue)}</div>` : ""}
                ${formattedDate ? `<div class="meta-item"><strong>Date:</strong> ${formattedDate}</div>` : ""}
                ${rulesList.length > 0 ? `<div class="meta-item"><strong>Rules:</strong> ${rulesList.map(esc).join(", ")}</div>` : ""}
            </div>
        </header>

        <div class="hero-summary">
            <div>
                <p class="result-text">${esc(match.result_description ?? "Match Completed")}</p>
                ${toss ? `<div class="toss-info">Toss: ${esc(toss)}</div>` : ""}
            </div>
            ${potmHtml}
        </div>

        <div class="match-snapshot">
            <div class="snapshot-team">
                <div class="snapshot-team-name">${esc(match.team1.name)}</div>
                ${formatInningsSnapshot(inn1)}
            </div>
            <div class="snapshot-vs">VS</div>
            <div class="snapshot-team right">
                <div class="snapshot-team-name">${esc(match.team2.name)}</div>
                ${formatInningsSnapshot(inn2)}
            </div>
        </div>

        ${inningsHtml}

        <div class="footer">
            <div class="cert-block">
                <div class="cert-title">Interactive Digital Scorecard & Wagon Wheel:</div>
                <div class="cert-link">${esc(matchUrl)}</div>
                <div class="cert-stamp">
                    Generated on ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} &bull; CricScore Official Performance Archive
                </div>
            </div>
            <div class="qr-block">
                <div class="qr-caption">Scan to access real-time ball-by-ball analysis & wagon wheels</div>
                <img src="${qrDataUrl}" alt="QR code" />
            </div>
        </div>
    </div>
</body>
</html>`;
}
