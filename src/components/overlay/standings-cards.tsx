"use client";

/**
 * Tournament cards from snapshots the control room sends (the overlay reads
 * nothing for them): the points table, a leaderboard and the next fixture.
 * Each renders nothing without its snapshot.
 *
 * Wiring (control room): build the snapshot from the data its tournament
 * pages already load (`PointsTable` rows, the leaderboard shards, the next
 * scheduled match) and send it with the view command; the overlay keeps it
 * in `overlay_state.snapshots` (`OverlaySnapshots`).
 */

import { cn } from "~/lib/utils";
import {
  CardShell,
  eyebrowOf,
  OV,
  TeamMark,
  teamCode,
  type OverlayThemeProps,
} from "./overlay-kit";
import type {
  FixtureSnapshot,
  LeaderboardSnapshot,
  LiveMatchState,
  PointsTableSnapshot,
} from "./types";

const TH = "px-3 py-2 text-right text-base font-medium";
const TD = "px-3 py-2 text-right text-lg tabular-nums";

export function PointsTableCard({
  state,
  table,
}: OverlayThemeProps & {
  state: LiveMatchState;
  table: PointsTableSnapshot | null | undefined;
}) {
  if (!table?.rows.length) return null;
  return (
    <CardShell
      className="max-w-[64rem]"
      eyebrow={eyebrowOf(state, "Standings")}
      title={table.title}
    >
      <table className="w-full">
        <thead>
          <tr className={cn("border-b", OV.cardLine, OV.cardMuted)}>
            <th className="w-10 px-3 py-2 text-left text-base font-medium">
              <span className="sr-only">Position</span>
            </th>
            <th className="px-3 py-2 text-left text-base font-medium">Team</th>
            <th className={TH}>P</th>
            <th className={TH}>W</th>
            <th className={TH}>L</th>
            <th className={TH}>NRR</th>
            <th className={TH}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr
              key={`${r.team}-${i}`}
              className={cn(
                "border-b last:border-0",
                OV.cardLine,
                r.highlight && "bg-[color:var(--ov-panel)] text-[color:var(--ov-panel-text)]",
              )}
            >
              <td className={cn("px-3 py-2 text-lg tabular-nums", OV.cardMuted)}>
                {i + 1}
              </td>
              <td className="max-w-[28rem] truncate px-3 py-2 text-lg font-medium">
                {r.team}
              </td>
              <td className={TD}>{r.played}</td>
              <td className={TD}>{r.won}</td>
              <td className={TD}>{r.lost}</td>
              <td className={TD}>
                {r.nrr === null || r.nrr === undefined
                  ? "–"
                  : `${r.nrr > 0 ? "+" : ""}${r.nrr.toFixed(3)}`}
              </td>
              <td className={cn(TD, "font-bold")}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardShell>
  );
}

export function LeaderboardCard({
  state,
  board,
}: OverlayThemeProps & {
  state: LiveMatchState;
  board: LeaderboardSnapshot | null | undefined;
}) {
  if (!board?.rows.length) return null;
  return (
    <CardShell
      className="max-w-[56rem]"
      eyebrow={eyebrowOf(state, "Leaders")}
      title={board.title}
    >
      <ol>
        {board.rows.slice(0, 8).map((r, i) => (
          <li
            key={`${r.name}-${i}`}
            className={cn(
              "flex items-baseline gap-4 border-b py-2 last:border-0",
              OV.cardLine,
            )}
          >
            <span className={cn("w-8 text-lg tabular-nums", OV.cardMuted)}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-medium">{r.name}</span>
              {(r.team || r.detail) && (
                <span className={cn("block truncate text-base", OV.cardMuted)}>
                  {[r.team, r.detail].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <span className="text-[1.75rem] font-bold tabular-nums">
              {r.value}
            </span>
          </li>
        ))}
      </ol>
      <p className={cn("mt-2 text-right text-base", OV.cardMuted)}>{board.metric}</p>
    </CardShell>
  );
}

function FixtureTeam({
  name,
  short,
  logo,
}: {
  name: string;
  short?: string | null;
  logo?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
      <span
        className={cn(
          "flex h-24 w-24 items-center justify-center rounded-lg p-3 text-[1.75rem]",
          OV.panel,
        )}
      >
        <TeamMark logoUrl={logo} code={teamCode(short, name)} />
      </span>
      <span className="max-w-full truncate text-[1.5rem] font-semibold">
        {name}
      </span>
    </div>
  );
}

function startText(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NextFixtureCard({
  state,
  fixture,
}: OverlayThemeProps & {
  state: LiveMatchState;
  fixture: FixtureSnapshot | null | undefined;
}) {
  if (!fixture?.team1 || !fixture.team2) return null;
  const when = startText(fixture.startsAt);
  return (
    <CardShell
      className="max-w-[56rem]"
      eyebrow={eyebrowOf(state, fixture.round ?? "Coming up")}
      title={fixture.title ?? "Next match"}
    >
      <div className="flex items-center gap-6 py-2">
        <FixtureTeam
          name={fixture.team1}
          short={fixture.team1Short}
          logo={fixture.team1Logo}
        />
        <span className={cn("text-[1.5rem]", OV.cardMuted)}>v</span>
        <FixtureTeam
          name={fixture.team2}
          short={fixture.team2Short}
          logo={fixture.team2Logo}
        />
      </div>
      {(when || fixture.venue) && (
        <p className={cn("mt-3 text-center text-lg", OV.cardMuted)}>
          {[when, fixture.venue].filter(Boolean).join(" · ")}
        </p>
      )}
    </CardShell>
  );
}
