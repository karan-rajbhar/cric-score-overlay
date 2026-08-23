import QRCode from "qrcode";
import type { Match } from "./match-types";
import {
    dismissalText,
    economyRate,
    oversFromBalls,
    scoreLine,
    strikeRate,
    topBatters,
    topBowlers,
} from "./cricket";

const esc = (t: unknown) =>
    String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
}

export function buildExportSummary(match: Match, matchUrl: string): MatchExportSummary {
    const teamStats = (team: Match["team1"], battingInnings = inningsFor(match, team.id)): ExportTeamStats => ({
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
            overs: oversFromBalls(b.balls_bowled ?? 0),
            runs: b.runs_conceded ?? 0,
            wickets: b.wickets_taken ?? 0,
            econ: economyRate(b.runs_conceded, b.balls_bowled),
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
        .filter((b) => (b.balls_faced ?? 0) > 0 || b.is_out || (b.runs_scored ?? 0) > 0)
        .sort((a, b) => (b.balls_faced ?? 0) - (a.balls_faced ?? 0));

    if (!batters.length) {
        return `<tr><td colspan="6" class="muted">No batting recorded</td></tr>`;
    }

    return batters
        .map((b) => {
            const runs = b.runs_scored ?? 0;
            return `<tr>
                <td class="name">${esc(b.user?.full_name ?? "—")} <span class="howout">${esc(dismissalText(b, inn.fall_of_wickets ?? []))}</span></td>
                <td class="num ${runs >= 50 ? "fifty" : ""}">${runs}</td>
                <td class="num">${b.balls_faced ?? 0}</td>
                <td class="num">${b.fours ?? 0}</td>
                <td class="num">${b.sixes ?? 0}</td>
                <td class="num">${strikeRate(b.runs_scored, b.balls_faced)}</td>
            </tr>`;
        })
        .join("");
}

function extrasRow(inn: NonNullable<Match["innings"]>[number]): string {
    const parts: string[] = [];
    if (inn.extras_byes) parts.push(`b ${inn.extras_byes}`);
    if (inn.extras_leg_byes) parts.push(`lb ${inn.extras_leg_byes}`);
    if (inn.extras_wides) parts.push(`w ${inn.extras_wides}`);
    if (inn.extras_no_balls) parts.push(`nb ${inn.extras_no_balls}`);
    if (inn.extras_penalties) parts.push(`p ${inn.extras_penalties}`);
    const breakdown = parts.length ? ` <span class="howout">(${parts.join(", ")})</span>` : "";
    return `<tr class="totals">
        <td class="name">Extras${breakdown}</td>
        <td class="num">${inn.extras_total ?? 0}</td>
        <td colspan="4"></td>
    </tr>`;
}

function fowRow(inn: NonNullable<Match["innings"]>[number]): string {
    const entries = [...(inn.fall_of_wickets ?? [])].sort((a, b) => a.wicket_number - b.wicket_number);
    if (!entries.length) return "";
    const items = entries
        .map(
            (f) =>
                `${f.wicket_number}-${f.runs_at_fall} (${esc(f.batsman?.full_name ?? "")}, ${oversFromBalls(f.overs_at_fall ?? 0)})`
        )
        .join(", ");
    return `<p class="fow"><strong>Fall of wickets:</strong> ${items}</p>`;
}

function bowlingRows(inn: NonNullable<Match["innings"]>[number]): string {
    const bowlers = (inn.bowling_performances ?? [])
        .filter((b) => (b.balls_bowled ?? 0) > 0 || (b.overs_bowled ?? 0) > 0)
        .sort(
            (a, b) =>
                (b.wickets_taken ?? 0) - (a.wickets_taken ?? 0) ||
                (a.runs_conceded ?? 0) - (b.runs_conceded ?? 0)
        );

    if (!bowlers.length) {
        return `<tr><td colspan="8" class="muted">No bowling recorded</td></tr>`;
    }

    return bowlers
        .map(
            (b) => `<tr>
                <td class="name">${esc(b.user?.full_name ?? "—")}</td>
                <td class="num">${oversFromBalls(b.balls_bowled ?? 0)}</td>
                <td class="num">${b.maidens ?? 0}</td>
                <td class="num">${b.runs_conceded ?? 0}</td>
                <td class="num"><strong>${b.wickets_taken ?? 0}</strong></td>
                <td class="num">${b.wides ?? 0}</td>
                <td class="num">${b.no_balls ?? 0}</td>
                <td class="num">${economyRate(b.runs_conceded, b.balls_bowled)}</td>
            </tr>`
        )
        .join("");
}

function inningsSection(
    inn: NonNullable<Match["innings"]>[number],
    index: number,
    teamName: string
): string {
    const total = `${inn.total_runs ?? 0}${(inn.total_wickets ?? 0) >= 10 ? "" : `/${inn.total_wickets ?? 0}`}`;
    return `
    <section class="innings">
        <h2>${esc(teamName)} — Innings ${index + 1} <span class="total">${total} <span class="overs">(${oversFromBalls(inn.total_balls ?? 0)} ov${inn.is_completed ? "" : ", in progress"})</span></span></h2>
        <table>
            <thead>
                <tr><th class="name">Batter</th><th class="num">R</th><th class="num">B</th><th class="num">4s</th><th class="num">6s</th><th class="num">SR</th></tr>
            </thead>
            <tbody>
                ${battingRows(inn)}
                ${extrasRow(inn)}
                <tr class="totals">
                    <td class="name">TOTAL</td>
                    <td class="num">${total}</td>
                    <td colspan="4" class="muted">${oversFromBalls(inn.total_balls ?? 0)} overs</td>
                </tr>
            </tbody>
        </table>
        ${fowRow(inn)}
        <table class="bowling">
            <thead>
                <tr><th class="name">Bowler</th><th class="num">O</th><th class="num">M</th><th class="num">R</th><th class="num">W</th><th class="num">Wd</th><th class="num">Nb</th><th class="num">Econ</th></tr>
            </thead>
            <tbody>${bowlingRows(inn)}</tbody>
        </table>
    </section>`;
}

export async function buildMatchReportHtml(match: Match, matchUrl: string): Promise<string> {
    const qrDataUrl = await QRCode.toDataURL(matchUrl, {
        margin: 1,
        width: 220,
        color: { dark: "#0c1210", light: "#ffffff" },
    });

    const toss = match.toss_winner_team_id
        ? `${match.toss_winner_team_id === match.team1.id ? match.team1.name : match.team2.name} won the toss and chose to ${match.toss_decision ?? "bat"}`
        : null;

    const meta = [
        `${match.match_format} · ${match.overs_per_innings} overs`,
        match.venue,
        match.scheduled_at
            ? new Date(match.scheduled_at).toLocaleString("en-GB", {
                  dateStyle: "full",
                  timeStyle: "short",
              })
            : null,
        toss,
    ]
        .filter(Boolean)
        .map((m) => esc(m))
        .join(" &nbsp;·&nbsp; ");

    const inningsHtml = (match.innings ?? [])
        .slice()
        .sort((a, b) => a.innings_number - b.innings_number)
        .map((inn, i) =>
            inningsSection(
                inn,
                i,
                inn.team_id === match.team1_id ? match.team1.name : match.team2.name
            )
        )
        .join("");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(match.title)} — Match Report</title>
<style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Helvetica, Arial, sans-serif; color: #111; margin: 0; font-size: 12px; }
    header { border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #16a34a; text-transform: uppercase; }
    h1 { font-size: 22px; margin: 6px 0 4px; }
    .meta { color: #555; font-size: 11px; }
    .result { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; font-weight: bold; color: #15803d; margin: 0 0 16px; }
    h2 { font-size: 14px; margin: 0 0 8px; display: flex; justify-content: space-between; }
    h2 .total { font-weight: bold; }
    h2 .overs { color: #666; font-weight: normal; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { text-align: right; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 1.5px solid #999; padding: 4px 8px; }
    th.name { text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.name { text-align: left; }
    tr.totals td { font-weight: bold; border-top: 1.5px solid #999; border-bottom: none; background: #fafafa; }
    .howout { color: #777; font-style: italic; font-size: 11px; }
    .fow { font-size: 11px; color: #444; margin: 6px 0 12px; }
    .muted { color: #888; }
    .fifty { color: #15803d; font-weight: bold; }
    .innings { margin-bottom: 22px; page-break-inside: avoid; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ddd; margin-top: 24px; padding-top: 14px; }
    .qr { text-align: center; }
    .qr img { width: 92px; height: 92px; }
    .qr .caption { font-size: 10px; color: #555; margin-top: 4px; }
    .linkline { font-size: 11px; color: #555; }
    .generated { font-size: 10px; color: #999; }
    .noprint { margin-top: 24px; }
    @media print { .noprint { display: none; } }
</style>
</head>
<body>
    <header>
        <div class="brand">CricScore · Match Report</div>
        <h1>${esc(match.title)}</h1>
        <div class="meta">${meta}</div>
    </header>

    ${match.result_description ? `<p class="result">${esc(match.result_description)}</p>` : ""}

    ${inningsHtml}

    <div class="footer">
        <div>
            <div class="linkline">View the full interactive scorecard:</div>
            <div class="linkline"><strong>${esc(matchUrl)}</strong></div>
            <div class="generated">Generated by CricScore on ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
        </div>
        <div class="qr">
            <img src="${qrDataUrl}" alt="QR code to open match" />
            <div class="caption">Scan to open match</div>
        </div>
    </div>

    <p class="noprint">
        <button onclick="window.print()" style="padding:10px 22px;font-size:14px;cursor:pointer;border:1px solid #999;background:#f5f5f5;border-radius:6px">
            Save as PDF
        </button>
    </p>
    <script>window.print()</script>
</body>
</html>`;
}
