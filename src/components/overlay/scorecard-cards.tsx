"use client";

/**
 * Scorecard graphics shared by the presentation cards and the broadcast
 * suite: an innings' batting card, bowling card, fall of wickets and the
 * full scorecard (batting beside bowling) for the 1920×1080 canvas.
 */

import { formatDismissalType, formatFowOvers } from "~/lib/cricket";
import type { Innings } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import {
  CardShell,
  economyText,
  eyebrowOf,
  OV,
  oversText,
  strikeRateText,
} from "./overlay-kit";
import type { LiveMatchState } from "./types";

const TH = "px-3 py-2 text-right text-base font-medium";
const TD = "px-3 py-2 text-right text-lg tabular-nums";

/** The name of the side batting in `innings` (team 1 / team 2 by id). */
export function inningsTeamName(
  state: LiveMatchState,
  innings: Innings,
  team1Id: string | null | undefined,
): string {
  if (team1Id && innings.team_id === team1Id) return state.team1_name ?? "";
  if (team1Id) return state.team2_name ?? "";
  // No ids: the innings in play is the batting side's.
  return innings.innings_number === state.innings_number
    ? (state.batting_team_name ?? "")
    : (state.bowling_team_name ?? "");
}

/** "Batting · 1st innings". */
export function inningsLabel(n: number): string {
  return n === 1 ? "1st innings" : n === 2 ? "2nd innings" : `Super over ${Math.ceil((n - 2) / 2)}`;
}

export function scoreOf(innings: Innings): string {
  return `${innings.total_runs ?? 0}/${innings.total_wickets ?? 0}`;
}

export function BattingTable({ innings }: { innings: Innings }) {
  const rows = (innings.batting_performances ?? []).filter(
    (b) => b.balls_faced > 0 || b.is_out || b.is_current_batsman,
  );
  return (
    <table className="w-full">
      <thead>
        <tr className={cn("border-b", OV.cardLine, OV.cardMuted)}>
          <th className="px-3 py-2 text-left text-base font-medium">Batter</th>
          <th className="px-3 py-2 text-left text-base font-medium">
            <span className="sr-only">How out</span>
          </th>
          <th className={TH}>R</th>
          <th className={TH}>B</th>
          <th className={TH}>4s</th>
          <th className={TH}>6s</th>
          <th className={TH}>SR</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.id} className={cn("border-b last:border-0", OV.cardLine)}>
            <td className="max-w-[18rem] truncate px-3 py-2 text-lg font-medium">
              {b.user?.full_name ?? ""}
            </td>
            <td
              className={cn(
                "max-w-[12rem] truncate px-3 py-2 text-base",
                OV.cardMuted,
              )}
            >
              {b.is_out ? formatDismissalType(b.dismissal_type) : "not out"}
            </td>
            <td className={cn(TD, "font-bold")}>{b.runs_scored}</td>
            <td className={TD}>{b.balls_faced}</td>
            <td className={TD}>{b.fours}</td>
            <td className={TD}>{b.sixes}</td>
            <td className={TD}>
              {strikeRateText(b.runs_scored, b.balls_faced) ?? "–"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BowlingTable({ innings }: { innings: Innings }) {
  const rows = (innings.bowling_performances ?? []).filter(
    (b) => b.balls_bowled > 0 || b.is_current_bowler,
  );
  return (
    <table className="w-full">
      <thead>
        <tr className={cn("border-b", OV.cardLine, OV.cardMuted)}>
          <th className="px-3 py-2 text-left text-base font-medium">Bowler</th>
          <th className={TH}>O</th>
          <th className={TH}>M</th>
          <th className={TH}>R</th>
          <th className={TH}>W</th>
          <th className={TH}>Econ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.id} className={cn("border-b last:border-0", OV.cardLine)}>
            <td className="max-w-[16rem] truncate px-3 py-2 text-lg font-medium">
              {b.user?.full_name ?? ""}
            </td>
            <td className={TD}>{oversText(b.balls_bowled)}</td>
            <td className={TD}>{b.maidens}</td>
            <td className={TD}>{b.runs_conceded}</td>
            <td className={cn(TD, "font-bold")}>{b.wickets_taken}</td>
            <td className={TD}>
              {economyText(b.runs_conceded, b.balls_bowled) ?? "–"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FallOfWicketsLine({ innings }: { innings: Innings }) {
  const fow = [...(innings.fall_of_wickets ?? [])].sort(
    (a, b) => a.wicket_number - b.wicket_number,
  );
  if (!fow.length) return null;
  return (
    <p className={cn("text-base leading-relaxed tabular-nums", OV.cardMuted)}>
      <span className={cn("mr-2 font-semibold", "text-[color:var(--ov-card-text)]")}>
        Fall of wickets
      </span>
      {fow
        .map(
          (f) =>
            `${f.runs_at_fall}/${f.wicket_number} (${f.batsman?.full_name ?? ""}, ${formatFowOvers(f.overs_at_fall)})`,
        )
        .join(", ")}
    </p>
  );
}

function ExtrasLine({ innings }: { innings: Innings }) {
  return (
    <p className={cn("text-base tabular-nums", OV.cardMuted)}>
      Extras {innings.extras_total ?? 0} (b {innings.extras_byes ?? 0}, lb{" "}
      {innings.extras_leg_byes ?? 0}, w {innings.extras_wides ?? 0}, nb{" "}
      {innings.extras_no_balls ?? 0})
    </p>
  );
}

/** One side's card: "Riverside Rangers · Batting", score in the header. */
export function InningsCard({
  state,
  innings,
  teamName,
  kind,
}: {
  state: LiveMatchState;
  innings: Innings;
  teamName: string;
  kind: "batting" | "bowling" | "full";
}) {
  const title =
    kind === "bowling" ? `${teamName} bowling` : `${teamName} batting`;
  return (
    <CardShell
      className={kind === "full" ? "max-w-[100rem]" : "max-w-[64rem]"}
      eyebrow={eyebrowOf(state, inningsLabel(innings.innings_number))}
      title={title}
      aside={
        <span className="leading-tight">
          <span className="block text-[2.5rem] font-bold tabular-nums">
            {scoreOf(innings)}
          </span>
          <span className={cn("block text-lg tabular-nums", OV.barMuted)}>
            {oversText(innings.total_balls)} overs
          </span>
        </span>
      }
    >
      {kind === "full" ? (
        <div className="grid grid-cols-[3fr_2fr] gap-8">
          <div className="min-w-0 space-y-3">
            <BattingTable innings={innings} />
            <ExtrasLine innings={innings} />
          </div>
          <div className="min-w-0">
            <BowlingTable innings={innings} />
          </div>
          <div className="col-span-2">
            <FallOfWicketsLine innings={innings} />
          </div>
        </div>
      ) : kind === "batting" ? (
        <div className="space-y-3">
          <BattingTable innings={innings} />
          <ExtrasLine innings={innings} />
          <FallOfWicketsLine innings={innings} />
        </div>
      ) : (
        <BowlingTable innings={innings} />
      )}
    </CardShell>
  );
}

/** The fall of wickets on a card of its own. */
export function FallOfWicketsCard({
  state,
  innings,
  teamName,
}: {
  state: LiveMatchState;
  innings: Innings;
  teamName: string;
}) {
  const fow = [...(innings.fall_of_wickets ?? [])].sort(
    (a, b) => a.wicket_number - b.wicket_number,
  );
  if (!fow.length) return null;
  return (
    <CardShell
      className="max-w-[56rem]"
      eyebrow={eyebrowOf(state, inningsLabel(innings.innings_number))}
      title={`${teamName} fall of wickets`}
      aside={
        <span className="text-[2.5rem] font-bold tabular-nums">
          {scoreOf(innings)}
        </span>
      }
    >
      <ol className="space-y-1">
        {fow.map((f) => (
          <li
            key={f.wicket_number}
            className={cn(
              "flex items-baseline gap-4 border-b py-1.5 text-lg last:border-0",
              OV.cardLine,
            )}
          >
            <span className="w-20 font-bold tabular-nums">
              {f.runs_at_fall}/{f.wicket_number}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {f.batsman?.full_name ?? ""}
            </span>
            <span className={cn("tabular-nums", OV.cardMuted)}>
              {formatFowOvers(f.overs_at_fall)} ov
            </span>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}
