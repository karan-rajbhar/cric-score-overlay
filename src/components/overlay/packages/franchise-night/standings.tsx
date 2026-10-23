"use client";

/**
 * Franchise night's tournament cards, from the snapshots the control room
 * sends (nothing is read): the points table, a leader card (the top
 * player large, the chasers in a list) and the next fixture.
 */

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { teamCode } from "../../overlay-kit";
import type { OverlayElementProps } from "../types";
import {
  CardFrame,
  Crest,
  DISPLAY,
  FIGURE,
  Kicker,
  PlayerSlot,
  TEXT,
  TableHead,
  chamfer,
  deepGlass,
  delay,
  goldFill,
  rowStyle,
  wedge,
} from "./kit";
import { avatarOf } from "../shared/derive";
import { FN, matchTones, teamTone, type TeamTone } from "./theme";

/** The league's own colour for cards that belong to no one side. */
const LEAGUE = teamTone("#2c2378", "#2c2378");

/** The tone of a team on the card: this match's sides keep their colours. */
function toneFor(
  name: string,
  state: OverlayElementProps["pointsTable"]["state"],
): TeamTone | null {
  const tones = matchTones(state);
  if (name === state.team1_name) return tones.team1;
  if (name === state.team2_name) return tones.team2;
  return null;
}

export function FranchisePointsTable(p: OverlayElementProps["pointsTable"]) {
  const rows = p.table.rows;
  if (!rows.length) return null;
  const tied = rows.some((r) => (r.tied ?? 0) > 0);
  const nr = rows.some((r) => (r.noResult ?? 0) > 0);
  return (
    <CardFrame
      label="Points table"
      kicker={p.state.tournament_name ? `${p.state.tournament_name} · Standings` : "Standings"}
      title={p.table.title}
      tone={LEAGUE}
      width={1400}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <TableHead className="w-14 text-left">
              <span className="sr-only">Position</span>
            </TableHead>
            <TableHead className="text-left">Team</TableHead>
            <TableHead>P</TableHead>
            <TableHead>W</TableHead>
            <TableHead>L</TableHead>
            {tied && <TableHead>T</TableHead>}
            {nr && <TableHead>NR</TableHead>}
            <TableHead>NRR</TableHead>
            <TableHead>Pts</TableHead>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tone = toneFor(r.team, p.state);
            const code = teamCode(r.short, r.team);
            return (
              <tr key={`${r.team}-${i}`} className="fn-a-rise" style={{ ...rowStyle(i, !!r.highlight), ...delay(160 + i * 45) }}>
                <td className={cn(FIGURE, "px-3 py-[9px] text-left")} style={{ fontSize: "1.75rem", color: FN.gold }}>
                  {i + 1}
                </td>
                <td className="px-3 py-[9px]">
                  <span className="flex min-w-0 items-center gap-4">
                    <span
                      className={cn(DISPLAY, "flex h-10 w-[4.5rem] shrink-0 items-center justify-center")}
                      style={{ ...(tone ? wedge(tone, 90) : deepGlass()), clipPath: chamfer(6), fontSize: "1.25rem" }}
                    >
                      {code}
                    </span>
                    <span className={cn(DISPLAY, "min-w-0 truncate")} style={{ fontSize: "1.75rem" }}>
                      {r.team}
                    </span>
                  </span>
                </td>
                {[r.played, r.won, r.lost, ...(tied ? [r.tied ?? 0] : []), ...(nr ? [r.noResult ?? 0] : [])].map((v, k) => (
                  <td key={k} className={cn(FIGURE, "px-3 py-[9px] text-right")} style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                    {v}
                  </td>
                ))}
                <td className={cn(FIGURE, "px-3 py-[9px] text-right")} style={{ fontSize: "1.375rem", fontWeight: 600, color: FN.muted }}>
                  {r.nrr === null || r.nrr === undefined ? "-" : `${r.nrr > 0 ? "+" : ""}${r.nrr.toFixed(3)}`}
                </td>
                <td className={cn(FIGURE, "px-3 py-[9px] text-right")} style={{ fontSize: "2rem" }}>
                  {r.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CardFrame>
  );
}

/** A leader card: the top player large, the chasing pack beside. */
export function FranchiseLeaderboard(p: OverlayElementProps["leaderboard"]) {
  const rows = p.board.rows.slice(0, 8);
  const top = rows[0];
  if (!top) return null;
  const tone = (top.team && toneFor(top.team, p.state)) || LEAGUE;
  return (
    <CardFrame
      label={p.board.title}
      kicker={p.state.tournament_name ? `${p.state.tournament_name} · Leaders` : "Leaders"}
      title={p.board.title}
      tone={LEAGUE}
      width={1500}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-10">
        <div className="fn-a-rise relative flex items-stretch overflow-hidden" style={{ ...wedge(tone, 120), clipPath: chamfer(18), ...delay(160) }}>
          <PlayerSlot
            url={avatarOf(p.match, top.playerId)}
            name={top.name}
            tone={tone}
            width={230}
            height={330}
            initials
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between px-7 py-6">
            <div>
              <Kicker size="sm">Leader</Kicker>
              <span className={cn(DISPLAY, "mt-3 block")} style={{ fontSize: "2.75rem", lineHeight: 1.02, color: tone.text }}>
                {top.name}
              </span>
              {top.team && (
                <span className={cn(TEXT, "mt-2 block truncate font-semibold")} style={{ fontSize: "1.25rem", color: tone.textMuted }}>
                  {top.team}
                </span>
              )}
            </div>
            <div>
              <span className={cn(FIGURE, "block")} style={{ fontSize: "6rem", color: tone.text }}>
                {top.value}
              </span>
              <span className={cn(TEXT, "block font-semibold uppercase")} style={{ fontSize: "1.125rem", letterSpacing: "0.08em", color: tone.textMuted }}>
                {p.board.metric}
                {top.detail ? ` · ${top.detail}` : ""}
              </span>
            </div>
          </div>
        </div>
        <ol className="flex flex-col justify-center">
          {rows.slice(1).map((r, i) => (
            <li key={`${r.name}-${i}`} className="fn-a-slide-r flex items-center gap-5 px-4 py-[10px]" style={{ ...rowStyle(i), ...delay(240 + i * 60) }}>
              <span className={FIGURE} style={{ fontSize: "1.75rem", color: FN.gold, width: "2rem" }}>
                {i + 2}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(DISPLAY, "block truncate")} style={{ fontSize: "1.75rem" }}>
                  {r.name}
                </span>
                {(r.team || r.detail) && (
                  <span className={cn(TEXT, "block truncate font-semibold")} style={{ fontSize: "1.0625rem", color: FN.muted }}>
                    {[r.team, r.detail].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className={FIGURE} style={{ fontSize: "2.5rem" }}>
                {r.value}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </CardFrame>
  );
}

/** The start time, formatted after hydration (the server has no zone). */
function useWhen(iso: string | null | undefined): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    const value = d.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    const id = setTimeout(() => setText(value), 0);
    return () => clearTimeout(id);
  }, [iso]);
  return text;
}

export function FranchiseNextFixture(p: OverlayElementProps["nextFixture"]) {
  const f = p.fixture;
  const when = useWhen(f.startsAt);
  if (!f.team1 || !f.team2) return null;
  const sides = [
    { name: f.team1, code: teamCode(f.team1Short, f.team1), logo: f.team1Logo, tone: toneFor(f.team1, p.state) ?? teamTone("#3b3f8f", "#3b3f8f") },
    { name: f.team2, code: teamCode(f.team2Short, f.team2), logo: f.team2Logo, tone: toneFor(f.team2, p.state) ?? teamTone("#6b2a7d", "#6b2a7d") },
  ];
  return (
    <CardFrame
      label="Next match"
      kicker={[p.state.tournament_name, f.round ?? "Coming up"].filter(Boolean).join(" · ")}
      title={f.title ?? "Next match"}
      tone={LEAGUE}
      width={1300}
      footer={
        (when || f.venue) && (
          <p className={cn(TEXT, "truncate text-center font-semibold")} style={{ fontSize: "1.375rem" }}>
            {when && <span style={{ color: FN.gold }}>{when}</span>}
            {when && f.venue && <span style={{ color: FN.muted }}> · </span>}
            {f.venue && <span style={{ color: FN.muted }}>{f.venue}</span>}
          </p>
        )
      }
    >
      <div className="flex items-center justify-around gap-6 py-4">
        {sides.map((s, i) => (
          <div key={i} className={cn("flex min-w-0 flex-1 flex-col items-center gap-4", i === 0 ? "fn-a-slide" : "fn-a-slide-r")} style={delay(200)}>
            <Crest logo={s.logo} code={s.code} name={s.name} tone={s.tone} size={160} />
            <span className={cn(DISPLAY, "max-w-full truncate")} style={{ fontSize: "2.5rem" }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>
      <span
        className={cn(DISPLAY, "fn-a-pop fn-italic pointer-events-none absolute left-1/2 top-[38%] flex h-[96px] w-[96px] items-center justify-center")}
        style={{ ...goldFill(), ...delay(360), marginLeft: -48, fontSize: "3.5rem", clipPath: chamfer(14) }}
      >
        v
      </span>
    </CardFrame>
  );
}
