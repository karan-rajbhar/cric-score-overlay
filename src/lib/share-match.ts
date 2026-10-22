/**
 * Sharing a match link: the system share sheet on phones (WhatsApp, SMS,
 * …), else copy to clipboard, else WhatsApp. The link opens the public
 * match page, whose Open Graph metadata gives the score-card preview.
 * Sharing a picture of the match (`shareImage`): the image and a message
 * through the share sheet on phones and tablets, a download elsewhere.
 */

import {
  formatBowlerOvers,
  inningsBalls,
  oversFromBalls,
  sidesInBattingOrder,
} from "./cricket";
import { matchSituation } from "./match-report";
import type { Innings, Match } from "./match-types";

export interface ShareScore {
  team1?: string | null;
  team2?: string | null;
}

export function matchShareUrl(matchId: string): string {
  return `${window.location.origin}/matches/${matchId}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "Team A vs Team B", falling back gracefully when names are missing. */
export function matchTitle(score: ShareScore): string {
  const a = score.team1?.trim();
  const b = score.team2?.trim();
  return a && b ? `${a} vs ${b}` : a || b || "Cricket match";
}

export type ShareOutcome = "shared" | "copied" | "whatsapp" | "cancelled";

/**
 * Without `text`, shares just the title and link and copies just the link
 * (the match page's plain share); with it, the message goes along too.
 */
export async function shareMatch(
  url: string,
  title: string,
  text?: string,
): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(text ? { title, text, url } : { title, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
    return "copied";
  } catch {
    window.open(
      whatsappShareUrl(`${text ?? title}\n${url}`),
      "_blank",
      "noopener,noreferrer",
    );
    return "whatsapp";
  }
}

function sideScore(
  name: string,
  inn: Innings | undefined,
  bpo: number,
): string | null {
  if (!inn) return null;
  const overs = oversFromBalls(inningsBalls(inn, bpo), bpo);
  return `${name} ${inn.total_runs}/${inn.total_wickets} (${overs} ov)`;
}

/** "Batting: …" and "Bowling: …" for the innings being played, if any. */
function creaseLines(match: Match, bpo: number): string[] {
  const current = match.innings?.find(
    (i) => i.innings_number === match.current_innings,
  );
  if (!current || current.is_completed) return [];
  const lines: string[] = [];
  const batters = (current.batting_performances ?? [])
    .filter((b) => b.is_current_batsman)
    .sort(
      (a, b) => Number(Boolean(b.is_striker)) - Number(Boolean(a.is_striker)),
    )
    .map(
      (b) =>
        `${b.user?.full_name ?? "Batter"} ${b.runs_scored ?? 0}* (${b.balls_faced ?? 0})`,
    );
  if (batters.length) lines.push(`Batting: ${batters.join(", ")}`);
  const bowler = (current.bowling_performances ?? []).find(
    (b) => b.is_current_bowler,
  );
  if (bowler) {
    lines.push(
      `Bowling: ${bowler.user?.full_name ?? "Bowler"} ${bowler.wickets_taken ?? 0}/${bowler.runs_conceded ?? 0} (${formatBowlerOvers(bowler, bpo)})`,
    );
  }
  return lines;
}

/**
 * The message sent with a shared match, one fact per line, e.g.
 *
 *   Strikers vs Warriors · Live
 *   Warriors 158/9 (20 ov)
 *   Strikers 85/3 (10.2 ov)
 *   Strikers need 74 runs from 58 balls
 *   Batting: J Smith 34* (22), A Kumar 12* (9)
 *   Bowling: R Patel 1/18 (2.2)
 *   Follow ball by ball: <link>
 *
 * Once it is over: the result and player of the match, then the scorecard
 * link. Without `url` the link line is left out (a link share sends the
 * link on its own).
 */
export function matchShareMessage(match: Match, url?: string): string {
  const bpo = match.balls_per_over || 6;
  const live = match.status === "live" || match.status === "innings_break";
  const done = match.status === "completed" || match.status === "abandoned";
  const lines: string[] = [];
  const vs = matchTitle({ team1: match.team1?.name, team2: match.team2?.name });
  lines.push(live ? `${vs} · Live` : vs);
  for (const side of sidesInBattingOrder(match)) {
    const line = sideScore(side.team.name, side.innings, bpo);
    if (line) lines.push(line);
  }
  if (live || done) lines.push(matchSituation(match));

  if (match.status === "live") lines.push(...creaseLines(match, bpo));
  const potm = match.player_of_the_match?.full_name;
  if (match.status === "completed" && potm) {
    lines.push(`Player of the match: ${potm}`);
  }
  if (url) {
    lines.push(`${live ? "Follow ball by ball" : "Full scorecard"}: ${url}`);
  }
  return lines.join("\n");
}

/** A phone or tablet (touch first), where a shared file opens the share sheet. */
export function isTouchDevice(): boolean {
  return Boolean(window.matchMedia?.("(pointer: coarse)").matches);
}

function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === "function" &&
      Boolean(navigator.canShare?.({ files: [file] }))
    );
  } catch {
    return false;
  }
}

export function downloadFile(f: File) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(f);
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2000);
}

export type ImageShareOutcome =
  | "shared"
  | "downloaded"
  | "cancelled"
  | "expired";

/**
 * Shares a picture of the match: on phones and tablets the share sheet with
 * the image and `text` (the link goes in the text; a separate url or title
 * makes some apps send the link alone); elsewhere the image is downloaded.
 * "expired": the browser no longer counts this as following a tap (the
 * image took too long), so it has to be shared from another tap.
 */
export async function shareImage(
  file: File,
  text?: string,
): Promise<ImageShareOutcome> {
  if (isTouchDevice() && canShareFile(file)) {
    try {
      await navigator.share(text ? { files: [file], text } : { files: [file] });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        return "expired";
      }
    }
  }
  downloadFile(file);
  return "downloaded";
}
