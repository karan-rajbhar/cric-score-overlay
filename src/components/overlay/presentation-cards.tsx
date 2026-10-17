"use client";

import { useState } from "react";
import type {
  LiveMatchState,
  PresentationCardType,
  OverlayTheme,
} from "./types";
import type { Match, Innings } from "~/lib/match-types";
import { formatDecimalOvers } from "~/lib/cricket";
import { Award, X } from "lucide-react";
import { THEME_ACCENT } from "./theme-accent";

interface PresentationCardsProps {
  card: PresentationCardType;
  state: LiveMatchState;
  match: Match | null;
  onClose?: () => void;
  theme?: OverlayTheme;
}

export function PresentationCards({
  card,
  state,
  match,
  onClose,
  theme = "starsports",
}: PresentationCardsProps) {
  const inningsList: Innings[] = match?.innings || [];
  const currentInningsNumber = state.innings_number ?? 1;
  const initialIdx = Math.min(
    Math.max(0, currentInningsNumber - 1),
    Math.max(0, inningsList.length - 1),
  );
  const [selectedInningsIdx, setSelectedInningsIdx] =
    useState<number>(initialIdx);

  if (card === "none") return null;

  const team1Name = state.team1_name ?? "Team 1";
  const team2Name = state.team2_name ?? "Team 2";

  const selectedInnings =
    inningsList.length > 0
      ? inningsList[selectedInningsIdx] || inningsList[0]
      : null;

  const activeBattingTeamName =
    selectedInnings?.team_id === match?.team1_id
      ? team1Name
      : selectedInnings?.team_id === match?.team2_id
        ? team2Name
        : (state.batting_team_name ?? team1Name);

  const accent = THEME_ACCENT[theme] ?? THEME_ACCENT.starsports;
  const source = state.tournament_name ?? state.title;
  const cardFrame =
    "overflow-hidden rounded-lg border border-white/10 bg-[#0b0f17]/95 text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)]";
  const accentBar = (
    <div aria-hidden="true" className="h-1" style={{ background: accent }} />
  );
  const eyebrow = (label: string) => (
    <p className="text-sm text-white/60">
      {source ? `${source} · ${label}` : label}
    </p>
  );
  const teamMark = (
    logoUrl: string | null | undefined,
    name: string,
    short: string | null,
  ) =>
    logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className="max-h-full max-w-full object-contain"
      />
    ) : (
      <span className="text-lg font-semibold text-white/80">
        {short ?? name.slice(0, 3).toUpperCase()}
      </span>
    );

  return (
    <div
      data-theme={theme}
      className="pointer-events-auto fixed inset-0 z-50 flex select-none items-center justify-center bg-black/70 p-4 font-score duration-200 animate-in fade-in motion-reduce:animate-none md:p-8"
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white transition-colors hover:bg-white/15"
          aria-label="Close presentation card"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Toss */}
      {card === "toss" && (
        <div
          className={`w-full max-w-2xl duration-300 animate-in slide-in-from-bottom-4 motion-reduce:animate-none ${cardFrame}`}
        >
          {accentBar}
          <div className="p-8">
            <div className="text-center">
              {eyebrow("Toss")}
              <h2 className="mt-1 text-balance text-3xl font-semibold text-white">
                Toss result
              </h2>
              {state.venue && (
                <p className="mt-1 text-sm text-white/60">{state.venue}</p>
              )}
            </div>

            <div className="mt-8 flex items-center justify-around gap-6 border-y border-white/10 py-6">
              <div className="text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-4">
                  {teamMark(
                    state.team1_logo_url,
                    team1Name,
                    state.team1_short_name,
                  )}
                </div>
                <p className="mt-3 text-lg font-semibold text-white">
                  {team1Name}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-lg font-medium text-white/60">vs</span>
                <span className="mt-1 text-xs text-white/50">
                  {state.match_format ?? "Match"}
                </span>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-4">
                  {teamMark(
                    state.team2_logo_url,
                    team2Name,
                    state.team2_short_name,
                  )}
                </div>
                <p className="mt-3 text-lg font-semibold text-white">
                  {team2Name}
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xl font-semibold text-white">
                {state.toss_winner_team_id
                  ? `${state.toss_winner_team_id === match?.team1_id ? team1Name : team2Name} won the toss and elected to ${state.toss_decision === "bowl" ? "bowl" : "bat"} first.`
                  : "Toss completed. Match underway."}
              </p>
              {state.umpire1_name && (
                <p className="mt-2 text-sm text-white/60">
                  Umpires: {state.umpire1_name}
                  {state.umpire2_name ? ` & ${state.umpire2_name}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Playing XI */}
      {card === "playing_xi" && (
        <div
          className={`w-full max-w-5xl duration-300 animate-in slide-in-from-bottom-4 motion-reduce:animate-none ${cardFrame}`}
        >
          {accentBar}
          <div className="p-8">
            <div className="border-b border-white/10 pb-4 text-center">
              {eyebrow("Team lineups")}
              <h2 className="mt-1 text-balance text-3xl font-semibold text-white">
                Playing XI
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {team1Name} vs {team2Name}
              </p>
            </div>

            <div className="mt-6 grid max-h-[65vh] grid-cols-1 gap-6 overflow-y-auto pr-1 md:grid-cols-2">
              {[
                {
                  name: team1Name,
                  logo: state.team1_logo_url,
                  short: state.team1_short_name,
                  players: match?.team1.team_players || [],
                },
                {
                  name: team2Name,
                  logo: state.team2_logo_url,
                  short: state.team2_short_name,
                  players: match?.team2.team_players || [],
                },
              ].map((team, teamIdx) => (
                <div
                  key={teamIdx}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/10 p-2">
                      {teamMark(team.logo, team.name, team.short)}
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      {team.name}
                    </h3>
                  </div>
                  <ul className="mt-3 divide-y divide-white/5 text-sm">
                    {team.players.length > 0 ? (
                      team.players.map((tp, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between px-1 py-2"
                        >
                          <span className="font-medium text-white">
                            {idx + 1}. {tp.user?.full_name ?? "Player"}
                          </span>
                          {tp.role_in_team && (
                            <span className="text-xs text-white/60">
                              {tp.role_in_team}
                            </span>
                          )}
                        </li>
                      ))
                    ) : (
                      <li className="py-4 text-center text-sm text-white/50">
                        Squad details confirmed at toss.
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full scorecard with innings tabs and fall of wickets */}
      {card === "scorecard" && (
        <div
          className={`max-h-[90vh] w-full max-w-5xl overflow-y-auto duration-300 animate-in slide-in-from-bottom-4 motion-reduce:animate-none ${cardFrame}`}
        >
          {accentBar}
          <div className="p-6 md:p-8">
            <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-white/60">
                  {source && <span>{source} · </span>}
                  <span>Match scorecard</span>
                </p>
                <h2 className="mt-1 text-3xl font-semibold text-white">
                  {activeBattingTeamName}{" "}
                  <span className="font-bold tabular-nums">
                    {selectedInnings?.total_runs ?? state.total_runs ?? 0}/
                    {selectedInnings?.total_wickets ?? state.total_wickets ?? 0}
                  </span>
                </h2>
                <p className="text-sm tabular-nums text-white/60">
                  Overs:{" "}
                  {selectedInnings
                    ? `${Math.floor(selectedInnings.total_balls / 6)}.${selectedInnings.total_balls % 6}`
                    : `${state.current_over}.${state.current_ball}`}{" "}
                  / {state.overs_per_innings} ov
                </p>
              </div>

              {inningsList.length > 0 && (
                <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1">
                  {inningsList.map((inn, idx) => {
                    const innTeamName =
                      inn.team_id === match?.team1_id ? team1Name : team2Name;
                    const isSelected = selectedInningsIdx === idx;
                    return (
                      <button
                        key={inn.id || idx}
                        onClick={() => setSelectedInningsIdx(idx)}
                        aria-pressed={isSelected}
                        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-white text-black"
                            : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <span>
                          {idx === 0 ? "1st innings" : "2nd innings"}:
                        </span>
                        <span className="tabular-nums">
                          {innTeamName} {inn.total_runs}/{inn.total_wickets}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5">
              <h4 className="mb-2 text-base font-semibold text-white">
                Batting
              </h4>

              <div className="overflow-x-auto rounded-md border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-xs font-medium text-white/60">
                      <th className="px-3 py-2.5">Batter</th>
                      <th className="px-3 py-2.5">Dismissal</th>
                      <th className="px-3 py-2.5 text-right">R</th>
                      <th className="px-3 py-2.5 text-right">B</th>
                      <th className="px-3 py-2.5 text-right">4s</th>
                      <th className="px-3 py-2.5 text-right">6s</th>
                      <th className="px-3 py-2.5 text-right">SR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(
                      selectedInnings?.batting_performances ||
                      match?.innings?.[0]?.batting_performances ||
                      []
                    ).map((bp, idx) => {
                      const sr =
                        bp.balls_faced > 0
                          ? ((bp.runs_scored * 100) / bp.balls_faced).toFixed(1)
                          : "0.0";

                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2.5 font-medium text-white">
                            {bp.user?.full_name ?? "Batter"}
                            {!bp.is_out && (
                              <span className="text-white/60">*</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-white/60">
                            {!bp.is_out
                              ? "not out"
                              : (bp.dismissal_type ?? "out")}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-white">
                            {bp.runs_scored}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {bp.balls_faced}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {bp.fours}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {bp.sixes}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {sr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedInnings && (
                <div className="mt-2.5 flex items-center justify-between px-3 text-sm text-white/70">
                  <span className="font-medium text-white">
                    Extras: {selectedInnings.extras_total}
                  </span>
                  <span className="tabular-nums text-white/60">
                    (b {selectedInnings.extras_byes}, lb{" "}
                    {selectedInnings.extras_leg_byes}, w{" "}
                    {selectedInnings.extras_wides}, nb{" "}
                    {selectedInnings.extras_no_balls})
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="mb-2 text-base font-semibold text-white">
                Bowling
              </h4>
              <div className="overflow-x-auto rounded-md border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-xs font-medium text-white/60">
                      <th className="px-3 py-2.5">Bowler</th>
                      <th className="px-3 py-2.5 text-right">O</th>
                      <th className="px-3 py-2.5 text-right">M</th>
                      <th className="px-3 py-2.5 text-right">R</th>
                      <th className="px-3 py-2.5 text-right">W</th>
                      <th className="px-3 py-2.5 text-right">Econ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(
                      selectedInnings?.bowling_performances ||
                      match?.innings?.[0]?.bowling_performances ||
                      []
                    ).map((bw, idx) => {
                      const ovText = `${Math.floor(bw.balls_bowled / 6)}.${bw.balls_bowled % 6}`;
                      const econ =
                        bw.balls_bowled > 0
                          ? ((bw.runs_conceded * 6) / bw.balls_bowled).toFixed(
                              2,
                            )
                          : "0.00";

                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2.5 font-medium text-white">
                            {bw.user?.full_name ?? "Bowler"}
                            {bw.is_current_bowler && (
                              <span className="ml-2 text-xs text-white/60">
                                bowling
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {ovText}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {bw.maidens}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {bw.runs_conceded}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-white">
                            {bw.wickets_taken}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                            {econ}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedInnings?.fall_of_wickets &&
              selectedInnings.fall_of_wickets.length > 0 && (
                <div className="mt-5 border-t border-white/10 pt-3">
                  <h5 className="mb-2 text-sm font-semibold text-white">
                    Fall of wickets
                  </h5>
                  <p className="text-sm tabular-nums text-white/70">
                    {selectedInnings.fall_of_wickets.map((fow, idx) => (
                      <span key={idx}>
                        {idx > 0 && ", "}
                        <span className="font-semibold text-white">
                          {fow.runs_at_fall}/{fow.wicket_number}
                        </span>{" "}
                        ({fow.batsman?.full_name ?? "Batter"},{" "}
                        {formatDecimalOvers(fow.overs_at_fall)} ov)
                      </span>
                    ))}
                  </p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Partnership */}
      {card === "partnership" && (
        <div
          className={`w-full max-w-xl duration-300 animate-in slide-in-from-bottom-4 motion-reduce:animate-none ${cardFrame}`}
        >
          {accentBar}
          <div className="p-7">
            <div className="border-b border-white/10 pb-3 text-center">
              {eyebrow("Partnership")}
              <h3 className="mt-1 text-4xl font-bold tabular-nums text-white">
                {state.partnership_runs ?? 0} runs
              </h3>
              <p className="mt-0.5 text-sm tabular-nums text-white/60">
                Off {state.partnership_balls ?? 0} balls
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 items-center gap-4">
              {[
                {
                  label: "Striker",
                  name: `${state.striker_name ?? "Striker"} *`,
                  runs: state.striker_runs,
                  balls: state.striker_balls,
                },
                {
                  label: "Non-striker",
                  name: state.non_striker_name ?? "Non-striker",
                  runs: state.non_striker_runs,
                  balls: state.non_striker_balls,
                },
              ].map((b) => (
                <div
                  key={b.label}
                  className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-center"
                >
                  <p className="text-sm text-white/60">{b.label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {b.name}
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-white">
                    {b.runs ?? 0}
                    <span className="ml-1 text-sm font-normal text-white/60">
                      ({b.balls ?? 0}b)
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Over summary */}
      {card === "over_summary" && (
        <div
          className={`w-full max-w-xl duration-300 animate-in slide-in-from-bottom-4 motion-reduce:animate-none ${cardFrame}`}
        >
          {accentBar}
          <div className="p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                {eyebrow("Over summary")}
                <h3 className="mt-1 text-2xl font-semibold text-white">
                  End of over {state.current_over}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold tabular-nums text-white">
                  {state.total_runs ?? 0}/{state.total_wickets ?? 0}
                </p>
                <p className="text-sm tabular-nums text-white/60">
                  CRR {state.current_run_rate ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm font-medium text-white/70">This over</p>
              <div className="flex items-center gap-2">
                {(state.this_over_balls ?? "")
                  .split(" ")
                  .filter(Boolean)
                  .map((ball, idx) => (
                    <span
                      key={idx}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                        ball === "W"
                          ? "bg-red-600 text-white"
                          : ball === "4"
                            ? "bg-sky-600 text-white"
                            : ball === "6"
                              ? "bg-amber-400 text-black"
                              : "bg-white/15 text-white"
                      }`}
                    >
                      {ball}
                    </span>
                  ))}
              </div>
            </div>

            {state.current_bowler_name && (
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                <span className="font-medium text-white/90">
                  Bowler: {state.current_bowler_name}
                </span>
                <span className="font-semibold tabular-nums text-white">
                  {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0} (
                  {state.bowler_balls
                    ? `${Math.floor(state.bowler_balls / 6)}.${state.bowler_balls % 6}`
                    : "0.0"}{" "}
                  ov)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result and player of the match */}
      {card === "result" && (
        <div
          className={`w-full max-w-2xl text-center duration-300 animate-in slide-in-from-bottom-4 motion-reduce:animate-none ${cardFrame}`}
        >
          {accentBar}
          <div className="p-8">
            {eyebrow("Match result")}
            <h2 className="mt-2 text-balance text-3xl font-semibold text-white">
              {state.result_description ?? "Match completed"}
            </h2>

            <div className="mt-6 flex items-center justify-around border-y border-white/10 py-5">
              <div>
                <p className="text-base font-medium text-white/80">
                  {team1Name}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white">
                  {match?.innings?.[0]?.total_runs ?? state.total_runs}/
                  {match?.innings?.[0]?.total_wickets ?? state.total_wickets}
                </p>
              </div>
              <div className="text-base font-medium text-white/50">vs</div>
              <div>
                <p className="text-base font-medium text-white/80">
                  {team2Name}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white">
                  {match?.innings?.[1]?.total_runs ?? "—"}/
                  {match?.innings?.[1]?.total_wickets ?? "—"}
                </p>
              </div>
            </div>

            {match?.player_of_the_match && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Award className="h-6 w-6 text-white/70" aria-hidden="true" />
                <div className="text-left">
                  <span className="block text-sm text-white/60">
                    Player of the match
                  </span>
                  <p className="text-lg font-semibold text-white">
                    {match.player_of_the_match.full_name}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
