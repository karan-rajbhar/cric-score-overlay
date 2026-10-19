import QRCode from "qrcode";
import type { Match } from "./match-types";
import {
  bowlerEconomy,
  byBattingOrder,
  dismissalText,
  formatBowlerOvers,
  formatDecimalOvers,
  formatMatchResult,
  formatStatus,
  inningsBalls,
  oversFromBalls,
  scoreLine,
  sidesInBattingOrder,
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
    // In batting order: the side that batted first is shown first.
    team1: teamStats(sidesInBattingOrder(match)[0].team),
    team2: teamStats(sidesInBattingOrder(match)[1].team),
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
type Team = Match["team1"];

/** Every innings in the order it was batted (super overs last). */
function inningsInOrder(match: Match): InningsRow[] {
  return [...(match.innings ?? [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );
}

function teamOf(match: Match, teamId: string | null | undefined): Team {
  return teamId === match.team2_id || teamId === match.team2.id
    ? match.team2
    : match.team1;
}

function inningsTitle(match: Match, inn: InningsRow): string {
  const team = teamOf(match, inn.team_id).name;
  if (inn.innings_number <= 2) return `${team} innings`;
  const superOver = Math.ceil((inn.innings_number - 2) / 2);
  return `${team}, super over${superOver > 1 ? ` ${superOver}` : ""}`;
}

/** "178/5 (20.0 ov, RR 8.90)" */
function totalLine(inn: InningsRow, bpo: number): string {
  const balls = inningsBalls(inn, bpo);
  const rr = balls > 0 ? (((inn.total_runs ?? 0) * bpo) / balls).toFixed(2) : "0.00";
  return `${inn.total_runs ?? 0}/${inn.total_wickets ?? 0} <span class="muted">(${oversFromBalls(balls, bpo)} ov, RR ${rr})</span>`;
}

function batted(b: NonNullable<InningsRow["batting_performances"]>[number]) {
  return (
    (b.balls_faced ?? 0) > 0 ||
    b.is_out ||
    (b.runs_scored ?? 0) > 0 ||
    b.is_current_batsman ||
    Boolean(b.dismissal_type)
  );
}

function battingTable(inn: InningsRow, bpo: number): string {
  const batters = (inn.batting_performances ?? [])
    .filter(batted)
    .sort(byBattingOrder);
  const rows = batters.length
    ? batters
        .map((b) => {
          const howOut =
            !b.is_out && b.dismissal_type === "retired_hurt"
              ? "retired hurt"
              : dismissalText(b, inn.fall_of_wickets ?? []);
          return `<tr>
  <td class="name">${esc(b.user?.full_name ?? "—")}${b.is_out ? "" : " *"}</td>
  <td class="how">${esc(howOut)}</td>
  <td class="num strong">${b.runs_scored ?? 0}</td>
  <td class="num">${b.balls_faced ?? 0}</td>
  <td class="num">${b.fours ?? 0}</td>
  <td class="num">${b.sixes ?? 0}</td>
  <td class="num">${strikeRate(b.runs_scored, b.balls_faced)}</td>
</tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="muted">No batting recorded</td></tr>`;

  const extras: string[] = [];
  if (inn.extras_byes) extras.push(`b ${inn.extras_byes}`);
  if (inn.extras_leg_byes) extras.push(`lb ${inn.extras_leg_byes}`);
  if (inn.extras_wides) extras.push(`w ${inn.extras_wides}`);
  if (inn.extras_no_balls) extras.push(`nb ${inn.extras_no_balls}`);
  if (inn.extras_penalties) extras.push(`p ${inn.extras_penalties}`);

  return `<table class="card">
<thead><tr>
  <th class="name">Batter</th><th class="how"></th>
  <th class="num">R</th><th class="num">B</th><th class="num">4s</th><th class="num">6s</th><th class="num">SR</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot>
  <tr><td class="name">Extras</td><td class="how muted">${extras.join(", ")}</td><td class="num strong">${inn.extras_total ?? 0}</td><td colspan="4"></td></tr>
  <tr class="total"><td class="name">Total</td><td colspan="6">${totalLine(inn, bpo)}</td></tr>
</tfoot>
</table>`;
}

function didNotBat(inn: InningsRow, team: Team): string {
  const players = team.team_players ?? [];
  if (!players.length) return "";
  const batted = new Set(
    (inn.batting_performances ?? [])
      .filter(
        (b) =>
          (b.balls_faced ?? 0) > 0 ||
          b.is_out ||
          (b.runs_scored ?? 0) > 0 ||
          b.is_current_batsman ||
          Boolean(b.dismissal_type),
      )
      .map((b) => b.user_id),
  );
  const names = players
    .filter((p) => (p.user?.id ?? p.user_id) && !batted.has(p.user?.id ?? p.user_id))
    .map((p) => p.user?.full_name)
    .filter(Boolean) as string[];
  if (!names.length) return "";
  return `<p class="line"><span class="label">Did not bat</span> ${names.map(esc).join(", ")}</p>`;
}

function fallOfWickets(inn: InningsRow): string {
  const entries = [...(inn.fall_of_wickets ?? [])].sort(
    (a, b) => a.wicket_number - b.wicket_number,
  );
  if (!entries.length) return "";
  const items = entries
    .map(
      (f) =>
        `${f.wicket_number}-${f.runs_at_fall} (${esc(f.batsman?.full_name ?? "Batter")}, ${formatDecimalOvers(f.overs_at_fall)} ov)`,
    )
    .join(", ");
  return `<p class="line"><span class="label">Fall of wickets</span> ${items}</p>`;
}

function bowlingTable(inn: InningsRow): string {
  // In the order they came on (the stored order), as on a scorecard.
  const bowlers = (inn.bowling_performances ?? []).filter(
    (b) =>
      (b.balls_bowled ?? 0) > 0 ||
      (b.overs_bowled ?? 0) > 0 ||
      (b.runs_conceded ?? 0) > 0 ||
      (b.wides ?? 0) > 0 ||
      (b.no_balls ?? 0) > 0,
  );
  if (!bowlers.length) return "";
  const rows = bowlers
    .map(
      (b) => `<tr>
  <td class="name">${esc(b.user?.full_name ?? "—")}</td>
  <td class="num">${formatBowlerOvers(b)}</td>
  <td class="num">${b.maidens ?? 0}</td>
  <td class="num">${b.runs_conceded ?? 0}</td>
  <td class="num strong">${b.wickets_taken ?? 0}</td>
  <td class="num">${bowlerEconomy(b)}</td>
  <td class="num">${b.wides ?? 0}</td>
  <td class="num">${b.no_balls ?? 0}</td>
</tr>`,
    )
    .join("");
  return `<table class="card">
<thead><tr>
  <th class="name">Bowler</th>
  <th class="num">O</th><th class="num">M</th><th class="num">R</th><th class="num">W</th><th class="num">Econ</th><th class="num">Wd</th><th class="num">Nb</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

function inningsSection(match: Match, inn: InningsRow, bpo: number): string {
  const team = teamOf(match, inn.team_id);
  const target =
    inn.target_runs && inn.innings_number % 2 === 0
      ? `<span class="target">Target ${inn.target_runs}</span>`
      : "";
  return `<section class="innings">
<h2><span>${esc(inningsTitle(match, inn))}</span>${target}</h2>
${battingTable(inn, bpo)}
${didNotBat(inn, team)}
${fallOfWickets(inn)}
${bowlingTable(inn)}
</section>`;
}

/** Player of the match with their figures, e.g. "A Smith, 54 (32) and 2/18". */
function playerOfTheMatch(match: Match): string | null {
  const potm = match.player_of_the_match;
  if (!potm) return null;
  const parts: string[] = [];
  for (const inn of match.innings ?? []) {
    const bat = inn.batting_performances?.find((b) => b.user_id === potm.id);
    if (bat && ((bat.balls_faced ?? 0) > 0 || (bat.runs_scored ?? 0) > 0)) {
      parts.push(`${bat.runs_scored ?? 0}${bat.is_out ? "" : "*"} (${bat.balls_faced ?? 0})`);
    }
    const bowl = inn.bowling_performances?.find((b) => b.user_id === potm.id);
    if (bowl && ((bowl.balls_bowled ?? 0) > 0 || (bowl.overs_bowled ?? 0) > 0)) {
      parts.push(`${bowl.wickets_taken ?? 0}/${bowl.runs_conceded ?? 0} (${formatBowlerOvers(bowl)} ov)`);
    }
  }
  return parts.length ? `${potm.full_name}, ${parts.join(" and ")}` : (potm.full_name ?? null);
}

/**
 * The match report: an A4 scorecard for print or "Save as PDF", in the
 * order official scorecards use (the side that batted first first, batters
 * in batting order, bowlers in the order they came on), with a QR code
 * and link to the live match page. Only facts the match holds; no filler.
 */
export async function buildMatchReportHtml(
  match: Match,
  matchUrl: string,
): Promise<string> {
  // Plain black on white with the standard 4-module quiet zone, so phone
  // cameras read it from paper.
  const qrDataUrl = await QRCode.toDataURL(matchUrl, {
    margin: 4,
    width: 240,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const bpo = match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const [first, second] = sidesInBattingOrder(match);
  const organiser = match.tournament?.name ?? match.club?.name ?? null;
  const when = match.actual_start_time ?? match.scheduled_at;
  const date = when
    ? new Date(when).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const toss = match.toss_winner_team_id
    ? `${teamOf(match, match.toss_winner_team_id).name} won the toss and chose to ${match.toss_decision === "bowl" ? "bowl" : "bat"}`
    : null;
  const officials = [
    match.umpire1_name,
    match.umpire2_name,
    match.third_umpire_name,
  ].filter(Boolean) as string[];
  const rules: string[] = [];
  if (match.wickets_per_innings && match.wickets_per_innings < 10) {
    rules.push(`${match.wickets_per_innings} wickets an innings`);
  }
  if (match.last_man_stands) rules.push("last man stands");
  if (match.golden_ball) rules.push("golden ball");
  const potm = playerOfTheMatch(match);
  const result =
    match.status === "completed"
      ? formatMatchResult(match)
      : match.status === "live"
        ? "In progress"
        : formatStatus(match.status);

  const sideScore = (side: { team: Team; innings: InningsRow | undefined }) =>
    `<div class="side"><span class="team">${esc(side.team.name)}</span><span class="score">${
      side.innings
        ? `${side.innings.total_runs ?? 0}/${side.innings.total_wickets ?? 0} <span class="muted">(${oversFromBalls(inningsBalls(side.innings, bpo), bpo)} ov)</span>`
        : `<span class="muted">Yet to bat</span>`
    }</span></div>`;

  const facts = [
    organiser ? ["Competition", organiser] : null,
    ["Format", `${match.match_format}, ${match.overs_per_innings} overs`],
    match.venue ? ["Venue", match.venue] : null,
    date ? ["Date", date] : null,
    toss ? ["Toss", toss] : null,
    officials.length ? ["Umpires", officials.join(", ")] : null,
    match.scorer_name ? ["Scorer", match.scorer_name] : null,
    rules.length ? ["Rules", rules.join(", ")] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const title = `${first.team.name} vs ${second.team.name}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} – match report</title>
<style>
  :root { --ink: #111827; --muted: #6b7280; --line: #e5e7eb; --soft: #f9fafb; --accent: #047857; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: var(--ink); }
  body { font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-variant-numeric: tabular-nums; }
  .page { max-width: 190mm; margin: 0 auto; padding: 12mm 0 10mm; }
  .toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px; background: var(--soft); border-bottom: 1px solid var(--line); }
  .toolbar button { font: inherit; font-weight: 600; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--line); background: #fff; cursor: pointer; }
  .toolbar .primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  header.top { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; padding-bottom: 10px; border-bottom: 2px solid var(--ink); }
  .eyebrow { margin: 0 0 2px; color: var(--muted); font-size: 12px; }
  h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; text-wrap: balance; }
  .side { display: flex; justify-content: space-between; gap: 12px; max-width: 120mm; font-size: 15px; }
  .side .team { font-weight: 600; }
  .side .score { font-weight: 700; white-space: nowrap; }
  .result { margin: 8px 0 0; font-size: 14px; font-weight: 600; color: var(--accent); }
  .potm { margin: 2px 0 0; color: var(--muted); }
  .qr { text-align: center; width: 30mm; }
  .qr img { display: block; width: 28mm; height: 28mm; margin: 0 auto; image-rendering: pixelated; }
  .qr p { margin: 2px 0 0; font-size: 10px; color: var(--muted); }
  dl.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 16px; margin: 10px 0 0; font-size: 12px; }
  dl.facts div { display: flex; gap: 6px; min-width: 0; }
  dt { color: var(--muted); flex: none; }
  dd { margin: 0; overflow-wrap: anywhere; }
  section.innings { margin-top: 14px; break-inside: auto; }
  h2 { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 4px; padding: 4px 6px; font-size: 14px; font-weight: 600; background: var(--soft); border: 1px solid var(--line); border-radius: 4px; break-after: avoid; }
  h2 .target { font-size: 12px; font-weight: 500; color: var(--muted); }
  .scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table.card { width: 100%; border-collapse: collapse; margin: 4px 0; break-inside: avoid; }
  th, td { padding: 3px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  th { font-size: 11px; font-weight: 600; color: var(--muted); }
  th.num, td.num { text-align: right; white-space: nowrap; width: 9mm; }
  td.name { font-weight: 500; white-space: nowrap; }
  td.how { color: var(--muted); }
  td.strong { font-weight: 700; }
  tfoot td { border-bottom: none; }
  tr.total td { border-top: 1px solid var(--ink); font-weight: 600; }
  .muted { color: var(--muted); font-weight: 400; }
  p.line { margin: 3px 6px; font-size: 12px; }
  .label { font-weight: 600; margin-right: 4px; }
  footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; font-size: 10px; color: var(--muted); }
  footer a { color: inherit; overflow-wrap: anywhere; }
  @page { size: A4; margin: 10mm; }
  @media print {
    .toolbar { display: none; }
    .page { padding: 0; max-width: none; }
    a { text-decoration: none; }
  }
  @media screen and (max-width: 640px) {
    .page { padding: 12px 16px; }
    header.top { grid-template-columns: 1fr; }
    .qr { width: auto; text-align: left; display: flex; gap: 8px; align-items: center; }
    .qr img { margin: 0; width: 72px; height: 72px; }
    dl.facts { grid-template-columns: 1fr; }
    td.how { white-space: normal; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button class="primary" onclick="window.print()">Save as PDF</button>
  <button onclick="window.close()">Close</button>
</div>
<main class="page">
<header class="top">
  <div>
    ${organiser ? `<p class="eyebrow">${esc(organiser)}${match.title && match.title !== title ? ` · ${esc(match.title)}` : ""}</p>` : match.title && match.title !== title ? `<p class="eyebrow">${esc(match.title)}</p>` : ""}
    <h1>${esc(title)}</h1>
    ${sideScore(first)}
    ${sideScore(second)}
    <p class="result">${esc(result)}</p>
    ${potm ? `<p class="potm">Player of the match: ${esc(potm)}</p>` : ""}
  </div>
  <div class="qr">
    <img src="${qrDataUrl}" alt="QR code for the match page">
    <p>Scan for the live match page</p>
  </div>
</header>
<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
${inningsInOrder(match)
  .map((inn) => `<div class="scroll">${inningsSection(match, inn, bpo)}</div>`)
  .join("\n")}
<footer>
  <a href="${esc(matchUrl)}">${esc(matchUrl)}</a>
  <span>CricScore · generated ${esc(new Date().toLocaleDateString("en-GB", { dateStyle: "medium" }))}</span>
</footer>
</main>
</body>
</html>`;
}
