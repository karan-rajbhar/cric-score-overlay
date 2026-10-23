"use client";

/**
 * Player lower thirds: a batter or bowler's figures this innings, their
 * career (`player_career_stats` and their photo, read when shown) or their
 * tournament figures (a snapshot the control room sends).
 */

import type { ReactNode } from "react";
import type { PlayerCareerStatsRow } from "~/lib/firebase/types";
import { cn } from "~/lib/utils";
import { usePlayerProfile } from "./overlay-data";
import {
  economyText,
  OV,
  oversText,
  PlayerPhoto,
  strikeRateText,
  type OverlayThemeProps,
} from "./overlay-kit";
import type { LiveMatchState, SeriesFigures } from "./types";

export type PlayerSlot = "striker" | "non_striker" | "bowler" | "last_out";

/** Who a slot is right now: id, name and whether they bowl. */
export function playerInSlot(
  state: LiveMatchState,
  slot: PlayerSlot,
): { id: string | null; name: string | null; bowler: boolean } {
  switch (slot) {
    case "striker":
      return { id: state.striker_id ?? null, name: state.striker_name, bowler: false };
    case "non_striker":
      return {
        id: state.non_striker_id ?? null,
        name: state.non_striker_name,
        bowler: false,
      };
    case "bowler":
      return {
        id: state.bowler_id ?? null,
        name: state.current_bowler_name,
        bowler: true,
      };
    case "last_out":
      return {
        id: state.last_wicket?.player_id ?? null,
        name: state.last_wicket?.name ?? null,
        bowler: false,
      };
  }
}

interface Stat {
  label: string;
  value: ReactNode;
}

function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-1">
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline gap-2">
          <dt className={cn("text-base", OV.cardMuted)}>{s.label}</dt>
          <dd className="text-[1.5rem] font-bold tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LowerThird({
  name,
  photo,
  badge,
  headline,
  stats,
}: {
  name: string;
  photo?: string | null;
  badge: string;
  headline?: ReactNode;
  stats: Stat[];
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[64rem] overflow-hidden rounded-lg duration-300 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none",
        OV.shadow,
      )}
    >
      <PlayerPhoto url={photo} name={name} className="h-auto w-[8.5rem] rounded-none" />
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-baseline justify-between gap-4 px-6 py-3", OV.bar)}>
          <span className="min-w-0">
            <span className={cn("block text-base font-medium", OV.barMuted)}>
              {badge}
            </span>
            <span className="block truncate text-[2rem] font-semibold leading-tight">
              {name}
            </span>
          </span>
          {headline && (
            <span className="shrink-0 text-[2rem] font-bold tabular-nums">
              {headline}
            </span>
          )}
        </div>
        <div className={cn("px-6 py-3", OV.card)}>
          <StatRow stats={stats} />
        </div>
      </div>
    </div>
  );
}

/** This innings' figures from the live row (no reads). */
export function inningsStats(state: LiveMatchState, slot: PlayerSlot): {
  headline: string;
  stats: Stat[];
} | null {
  if (slot === "bowler") {
    if (!state.current_bowler_name) return null;
    return {
      headline: `${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`,
      stats: [
        { label: "Overs", value: oversText(state.bowler_balls) },
        { label: "Maidens", value: state.bowler_maidens ?? 0 },
        { label: "Econ", value: economyText(state.bowler_runs, state.bowler_balls) ?? "–" },
      ],
    };
  }
  if (slot === "last_out") {
    const w = state.last_wicket;
    if (!w?.name) return null;
    return {
      headline: `${w.runs} (${w.balls})`,
      stats: [
        { label: "SR", value: strikeRateText(w.runs, w.balls) ?? "–" },
        { label: "At", value: `${w.score}/${w.wicket_number}` },
      ],
    };
  }
  const striker = slot === "striker";
  const name = striker ? state.striker_name : state.non_striker_name;
  if (!name) return null;
  const runs = striker ? state.striker_runs : state.non_striker_runs;
  const balls = striker ? state.striker_balls : state.non_striker_balls;
  const fours = striker ? state.striker_fours : state.non_striker_fours;
  const sixes = striker ? state.striker_sixes : state.non_striker_sixes;
  const stats: Stat[] = [];
  if (fours !== null && fours !== undefined) stats.push({ label: "4s", value: fours });
  if (sixes !== null && sixes !== undefined) stats.push({ label: "6s", value: sixes });
  stats.push({ label: "SR", value: strikeRateText(runs, balls) ?? "–" });
  return { headline: `${runs ?? 0} (${balls ?? 0})`, stats };
}

/** Batter / bowler / last-out figures this innings. */
export function InningsFiguresCard({
  state,
  slot,
}: OverlayThemeProps & { state: LiveMatchState; slot: PlayerSlot }) {
  const who = playerInSlot(state, slot);
  const figures = inningsStats(state, slot);
  if (!who.name || !figures) return null;
  const badge =
    slot === "bowler"
      ? "Bowling"
      : slot === "last_out"
        ? "Out"
        : slot === "striker"
          ? "On strike"
          : "Batting";
  return (
    <LowerThird
      name={who.name}
      badge={badge}
      headline={figures.headline}
      stats={figures.stats}
    />
  );
}

function careerStats(c: PlayerCareerStatsRow, bowler: boolean): Stat[] {
  if (bowler) {
    return [
      { label: "Matches", value: c.total_matches ?? 0 },
      { label: "Wickets", value: c.total_wickets ?? 0 },
      ...(c.bowling_average ? [{ label: "Avg", value: c.bowling_average.toFixed(1) }] : []),
      ...(c.economy_rate ? [{ label: "Econ", value: c.economy_rate.toFixed(2) }] : []),
      ...(c.best_bowling_figures ? [{ label: "Best", value: c.best_bowling_figures }] : []),
    ];
  }
  return [
    { label: "Matches", value: c.total_matches ?? 0 },
    { label: "Runs", value: c.total_runs ?? 0 },
    ...(c.batting_average ? [{ label: "Avg", value: c.batting_average.toFixed(1) }] : []),
    ...(c.strike_rate ? [{ label: "SR", value: c.strike_rate.toFixed(1) }] : []),
    ...(c.highest_score ? [{ label: "Best", value: c.highest_score }] : []),
    { label: "50s / 100s", value: `${c.half_centuries ?? 0} / ${c.centuries ?? 0}` },
  ];
}

/** Career figures and photo (2 reads when shown; nothing without a record). */
export function CareerCard({
  state,
  slot,
}: OverlayThemeProps & { state: LiveMatchState; slot: PlayerSlot }) {
  const who = playerInSlot(state, slot);
  const { profile, loaded } = usePlayerProfile(state, who.id, true);
  if (!who.name || !loaded || !profile.career) return null;
  return (
    <LowerThird
      name={who.name}
      photo={profile.avatarUrl}
      badge="Career"
      stats={careerStats(profile.career, who.bowler)}
    />
  );
}

/** Tournament figures from the control room's snapshot. */
export function SeriesCard({
  state,
  slot,
  series,
}: OverlayThemeProps & {
  state: LiveMatchState;
  slot: PlayerSlot;
  series?: Record<string, SeriesFigures> | null;
}) {
  const who = playerInSlot(state, slot);
  const f = who.id ? series?.[who.id] : null;
  if (!who.name || !f) return null;
  const stats: Stat[] = [{ label: "Matches", value: f.matches }];
  if (who.bowler) {
    if (f.wickets !== null && f.wickets !== undefined)
      stats.push({ label: "Wickets", value: f.wickets });
    if (f.economy) stats.push({ label: "Econ", value: f.economy.toFixed(2) });
    if (f.best) stats.push({ label: "Best", value: f.best });
  } else {
    if (f.runs !== null && f.runs !== undefined) stats.push({ label: "Runs", value: f.runs });
    if (f.average) stats.push({ label: "Avg", value: f.average.toFixed(1) });
    if (f.strikeRate) stats.push({ label: "SR", value: f.strikeRate.toFixed(1) });
    if (f.highest) stats.push({ label: "Best", value: f.highest });
  }
  return (
    <LowerThird
      name={who.name}
      badge={state.tournament_name ?? "This tournament"}
      stats={stats}
    />
  );
}
