"use client";

/**
 * World event's tournament cards, from the control room's snapshots (the
 * overlay reads nothing for them): the standings with P / W / L / NR /
 * Pts / NRR, a leaderboard with its leader on the event accent, and the
 * next fixture.
 */

import { cn } from "~/lib/utils";
import { teamCode } from "../../overlay-kit";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps } from "../types";
import { sideOfName } from "./data";
import { CardFrame, Crest, delay, Root, SAFE_X, Tab, useLocalTime } from "./kit";

const TH = "we-label we-ink-muted px-3 py-2.5 text-right text-[16px]";
const TD = "we-figl px-3 text-right text-[26px]";

/** "+0.912", "-0.118"; "–" when unknown. */
export function nrrText(nrr: number | null | undefined): string {
  if (nrr === null || nrr === undefined || !Number.isFinite(nrr)) return "–";
  return `${nrr > 0 ? "+" : ""}${nrr.toFixed(3)}`;
}

/** The side a listed team is in this match (by name or code), else null. */
function sideOf(state: LiveMatchState, name: string, short?: string | null): 1 | 2 | null {
  return (
    sideOfName(state, name) ??
    (short && short === state.team1_short_name ? 1 : short && short === state.team2_short_name ? 2 : null)
  );
}

const num = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n);

export function WorldEventPointsTable(p: OverlayElementProps["pointsTable"]) {
  const rows = p.table.rows;
  if (!rows.length) return null;
  const ties = rows.some((r) => (r.tied ?? 0) > 0);
  return (
    <CardFrame
      state={p.state}
      testId="we-points"
      eyebrow={p.state.tournament_name ? `Standings  ·  ${p.state.tournament_name}` : "Standings"}
      title={<span className="we-trunc block">{p.table.title}</span>}
      width={1440}
      bodyClassName="px-4 py-3"
    >
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(TH, "w-[64px] text-center")}>
              <span className="sr-only">Position</span>
            </th>
            <th className={cn(TH, "text-left")}>Team</th>
            <th className={TH}>P</th>
            <th className={TH}>W</th>
            <th className={TH}>L</th>
            {ties && <th className={TH}>T</th>}
            <th className={TH}>NR</th>
            <th className={cn(TH, "w-[150px]")}>NRR</th>
            <th className={cn(TH, "w-[110px] text-center")}>Pts</th>
          </tr>
        </thead>
        <tbody className="we-rows">
          {rows.map((r, i) => {
            const n = sideOf(p.state, r.team, r.short);
            const nrr = r.nrr ?? null;
            return (
              <tr key={`${r.team}-${i}`} className={cn("we-a-rise h-[62px]", r.highlight && "we-row-hl")} style={delay(300 + i * 45)}>
                <td className="we-fig px-3 text-center text-[26px]">{i + 1}</td>
                <td className="px-3">
                  <span className="flex min-w-0 items-center gap-4">
                    <Crest n={n} code={teamCode(r.short, r.team)} name={r.team} size={50} />
                    <span className="we-name we-trunc max-w-[620px] text-[25px]">{r.team}</span>
                  </span>
                </td>
                <td className={TD}>{r.played}</td>
                <td className={TD}>{r.won}</td>
                <td className={TD}>{r.lost}</td>
                {ties && <td className={TD}>{num(r.tied)}</td>}
                <td className={TD}>{num(r.noResult)}</td>
                <td
                  className={cn(
                    TD,
                    !r.highlight && nrr !== null && (nrr > 0 ? "text-[#08754f]" : nrr < 0 ? "text-[#b8102a]" : ""),
                  )}
                >
                  {nrrText(nrr)}
                </td>
                <td className="px-3 text-center">
                  <span className={cn("we-fig inline-block min-w-[64px] px-3 py-1 text-[30px]", r.highlight ? "bg-white text-[#120a3d]" : "bg-[#140a4f] text-white")}>
                    {r.points}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CardFrame>
  );
}

export function WorldEventLeaderboard(p: OverlayElementProps["leaderboard"]) {
  const rows = p.board.rows.slice(0, 6);
  if (!rows.length) return null;
  const [lead, ...rest] = rows;
  return (
    <CardFrame
      state={p.state}
      testId="we-leaderboard"
      eyebrow={p.state.tournament_name ? `Leaders  ·  ${p.state.tournament_name}` : "Leaders"}
      title={<span className="we-trunc block">{p.board.title}</span>}
      aside={<span className="we-label we-muted">{p.board.metric}</span>}
      width={1240}
      bodyClassName="px-0 py-0"
    >
      {lead && (
        <div className="we-accent we-sheen we-a-wipe-r relative flex h-[120px] items-center gap-6 px-8" style={delay(260)}>
          <span className="we-fig flex h-[64px] w-[64px] shrink-0 items-center justify-center bg-white text-[36px] text-[#120a3d]">1</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="we-name we-trunc text-[40px] leading-tight">{lead.name}</span>
            {(lead.team || lead.detail) && (
              <span className="we-trunc text-[22px] font-semibold opacity-90">{[lead.team, lead.detail].filter(Boolean).join("  ·  ")}</span>
            )}
          </span>
          <span className="we-fig text-[72px] leading-none">{lead.value}</span>
        </div>
      )}
      <ol className="we-rows">
        {rest.map((r, i) => (
          <li key={`${r.name}-${i}`} className="we-a-rise flex h-[76px] items-center gap-6 px-8" style={delay(380 + i * 50)}>
            <span className="we-fig flex h-[46px] w-[46px] shrink-0 items-center justify-center bg-[#140a4f] text-[24px] text-white">{i + 2}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="we-name we-trunc text-[27px]">{r.name}</span>
              {(r.team || r.detail) && (
                <span className="we-ink-muted we-trunc text-[19px] font-semibold">{[r.team, r.detail].filter(Boolean).join("  ·  ")}</span>
              )}
            </span>
            <span className="we-fig text-[42px]">{r.value}</span>
          </li>
        ))}
      </ol>
    </CardFrame>
  );
}

function FixtureSide({ name, short, logo, n, at }: { name: string; short?: string | null; logo?: string | null; n: 1 | 2 | null; at: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-5 px-10 py-10", at === "left" ? "we-a-slide-r" : "we-a-slide-l")} style={delay(120)}>
      <Crest n={n} logo={logo} code={teamCode(short, name)} name={name} size={170} className="we-a-pop" style={delay(300)} />
      <span className="we-x we-trunc max-w-full text-center text-[40px] leading-tight">{name}</span>
    </div>
  );
}

export function WorldEventNextFixture(p: OverlayElementProps["nextFixture"]) {
  const f = p.fixture;
  const when = useLocalTime(f.startsAt);
  if (!f.team1 || !f.team2) return null;
  return (
    <Root state={p.state} data-testid="we-fixture" className="inset-0 flex items-center justify-center" style={{ padding: `54px ${SAFE_X}px` }}>
      <section className="we-lift relative w-full max-w-[1400px]">
        <div className="absolute -top-[38px] left-0 z-10">
          <Tab className="we-a-drop" style={delay(260)}>
            {[f.title ?? "Next match", f.round].filter(Boolean).join("  ·  ")}
          </Tab>
        </div>
        <div className="we-night we-a-wipe-r relative flex items-stretch">
          <FixtureSide name={f.team1} short={f.team1Short} logo={f.team1Logo} n={sideOf(p.state, f.team1, f.team1Short)} at="left" />
          <span className="absolute left-1/2 top-[130px] h-[96px] w-[96px] -translate-x-1/2">
            <span className="we-accent we-x we-a-pop flex h-full w-full items-center justify-center rounded-full text-[40px] shadow-[0_0_0_6px_#0a0532]" style={delay(480)}>
              v
            </span>
          </span>
          <FixtureSide name={f.team2} short={f.team2Short} logo={f.team2Logo} n={sideOf(p.state, f.team2, f.team2Short)} at="right" />
        </div>
        {(when || f.venue) && (
          <div className="we-paper we-a-wipe-down flex items-center justify-center gap-10 px-10 py-4 text-[26px] font-bold" style={delay(360)}>
            {when && <span>{when}</span>}
            {when && f.venue && <span className="h-[26px] w-[3px] bg-[#dc0078]" />}
            {f.venue && <span className="we-trunc">{f.venue}</span>}
          </div>
        )}
      </section>
    </Root>
  );
}
