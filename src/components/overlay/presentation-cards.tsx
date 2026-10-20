"use client";

import { useState, type ReactNode } from "react";
import type {
  LiveMatchState,
  PresentationCardType,
  OverlayTheme,
} from "./types";
import type {
  BattingPerformance,
  BowlingPerformance,
  FallOfWicket,
  Match,
  Innings,
} from "~/lib/match-types";
import { formatDecimalOvers, formatDismissalType } from "~/lib/cricket";
import { Award, X } from "lucide-react";
import { THEME_ACCENT } from "./theme-accent";

interface PresentationCardsProps {
  card: PresentationCardType;
  state: LiveMatchState;
  match: Match | null;
  onClose?: () => void;
  theme?: OverlayTheme;
}

/** What every card needs: the score, the match, and the frame's look. */
interface CardContext {
  state: LiveMatchState;
  match: Match | null;
  team1Name: string;
  team2Name: string;
  accent: string;
  /** Tournament (or match title) shown before each card's label. */
  source: string | null;
}

const CARD_FRAME =
  "overflow-hidden rounded-lg border border-white/10 bg-[#0b0f17]/95 text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)]";

/** The card's frame: width and layout classes, the theme's accent bar. */
function CardShell({
  ctx,
  className,
  children,
}: {
  ctx: CardContext;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${className} duration-300 animate-in slide-in-from-bottom-4 motion-reduce:animate-none ${CARD_FRAME}`}
    >
      <div
        aria-hidden="true"
        className="h-1"
        style={{ background: ctx.accent }}
      />
      {children}
    </div>
  );
}

function Eyebrow({ ctx, label }: { ctx: CardContext; label: string }) {
  return (
    <p className="text-sm text-white/60">
      {ctx.source ? `${ctx.source} · ${label}` : label}
    </p>
  );
}

function TeamMark({
  logoUrl,
  name,
  short,
}: {
  logoUrl: string | null | undefined;
  name: string;
  short: string | null;
}) {
  return logoUrl ? (
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
}

/** "12.3" from a ball count (six-ball overs). */
const oversText = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

function TossTeam({
  logoUrl,
  name,
  short,
}: {
  logoUrl: string | null | undefined;
  name: string;
  short: string | null;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-4">
        <TeamMark logoUrl={logoUrl} name={name} short={short} />
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{name}</p>
    </div>
  );
}

function TossCard({ ctx }: { ctx: CardContext }) {
  const { state, match, team1Name, team2Name } = ctx;
  const winner =
    state.toss_winner_team_id === match?.team1_id ? team1Name : team2Name;
  return (
    <CardShell ctx={ctx} className="w-full max-w-2xl">
      <div className="p-8">
        <div className="text-center">
          <Eyebrow ctx={ctx} label="Toss" />
          <h2 className="mt-1 text-balance text-3xl font-semibold text-white">
            Toss result
          </h2>
          {state.venue && (
            <p className="mt-1 text-sm text-white/60">{state.venue}</p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-around gap-6 border-y border-white/10 py-6">
          <TossTeam
            logoUrl={state.team1_logo_url}
            name={team1Name}
            short={state.team1_short_name}
          />

          <div className="flex flex-col items-center">
            <span className="text-lg font-medium text-white/60">vs</span>
            <span className="mt-1 text-xs text-white/50">
              {state.match_format ?? "Match"}
            </span>
          </div>

          <TossTeam
            logoUrl={state.team2_logo_url}
            name={team2Name}
            short={state.team2_short_name}
          />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xl font-semibold text-white">
            {state.toss_winner_team_id
              ? `${winner} won the toss and elected to ${state.toss_decision === "bowl" ? "bowl" : "bat"} first.`
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
    </CardShell>
  );
}

function PlayingXiCard({ ctx }: { ctx: CardContext }) {
  const { state, match, team1Name, team2Name } = ctx;
  const teams = [
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
  ];
  return (
    <CardShell ctx={ctx} className="w-full max-w-5xl">
      <div className="p-8">
        <div className="border-b border-white/10 pb-4 text-center">
          <Eyebrow ctx={ctx} label="Team lineups" />
          <h2 className="mt-1 text-balance text-3xl font-semibold text-white">
            Playing XI
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {team1Name} vs {team2Name}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:max-h-[65vh] sm:overflow-y-auto sm:pr-1 md:grid-cols-2">
          {teams.map((team, teamIdx) => (
            <div
              key={teamIdx}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/10 p-2">
                  <TeamMark
                    logoUrl={team.logo}
                    name={team.name}
                    short={team.short}
                  />
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
    </CardShell>
  );
}

function InningsTabs({
  ctx,
  innings,
  selectedIdx,
  onSelect,
}: {
  ctx: CardContext;
  innings: Innings[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1">
      {innings.map((inn, idx) => {
        const innTeamName =
          inn.team_id === ctx.match?.team1_id ? ctx.team1Name : ctx.team2Name;
        const isSelected = selectedIdx === idx;
        return (
          <button
            key={inn.id || idx}
            onClick={() => onSelect(idx)}
            aria-pressed={isSelected}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              isSelected
                ? "bg-white text-black"
                : "text-white/70 hover:bg-white/10"
            }`}
          >
            <span>{idx === 0 ? "1st innings" : "2nd innings"}:</span>
            <span className="tabular-nums">
              {innTeamName} {inn.total_runs}/{inn.total_wickets}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TH = "px-3 py-2.5";
const TH_RIGHT = "px-3 py-2.5 text-right";
const TD_FIGURE = "px-3 py-2.5 text-right tabular-nums text-white/70";
const TD_HERO = "px-3 py-2.5 text-right font-bold tabular-nums text-white";

function BattingTable({ rows }: { rows: BattingPerformance[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-white/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-xs font-medium text-white/60">
            <th className={TH}>Batter</th>
            <th className={TH}>Dismissal</th>
            <th className={TH_RIGHT}>R</th>
            <th className={TH_RIGHT}>B</th>
            <th className={TH_RIGHT}>4s</th>
            <th className={TH_RIGHT}>6s</th>
            <th className={TH_RIGHT}>SR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((bp, idx) => (
            <tr key={idx}>
              <td className="px-3 py-2.5 font-medium text-white">
                {bp.user?.full_name ?? "Batter"}
                {!bp.is_out && <span className="text-white/60">*</span>}
              </td>
              <td className="px-3 py-2.5 text-white/60">
                {!bp.is_out
                  ? "not out"
                  : formatDismissalType(bp.dismissal_type)}
              </td>
              <td className={TD_HERO}>{bp.runs_scored}</td>
              <td className={TD_FIGURE}>{bp.balls_faced}</td>
              <td className={TD_FIGURE}>{bp.fours}</td>
              <td className={TD_FIGURE}>{bp.sixes}</td>
              <td className={TD_FIGURE}>
                {bp.balls_faced > 0
                  ? ((bp.runs_scored * 100) / bp.balls_faced).toFixed(1)
                  : "0.0"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BowlingTable({ rows }: { rows: BowlingPerformance[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-white/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-xs font-medium text-white/60">
            <th className={TH}>Bowler</th>
            <th className={TH_RIGHT}>O</th>
            <th className={TH_RIGHT}>M</th>
            <th className={TH_RIGHT}>R</th>
            <th className={TH_RIGHT}>W</th>
            <th className={TH_RIGHT}>Econ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((bw, idx) => (
            <tr key={idx}>
              <td className="px-3 py-2.5 font-medium text-white">
                {bw.user?.full_name ?? "Bowler"}
                {bw.is_current_bowler && (
                  <span className="ml-2 text-xs text-white/60">bowling</span>
                )}
              </td>
              <td className={TD_FIGURE}>{oversText(bw.balls_bowled)}</td>
              <td className={TD_FIGURE}>{bw.maidens}</td>
              <td className={TD_FIGURE}>{bw.runs_conceded}</td>
              <td className={TD_HERO}>{bw.wickets_taken}</td>
              <td className={TD_FIGURE}>
                {bw.balls_bowled > 0
                  ? ((bw.runs_conceded * 6) / bw.balls_bowled).toFixed(2)
                  : "0.00"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FallOfWickets({ wickets }: { wickets: FallOfWicket[] }) {
  return (
    <div className="mt-5 border-t border-white/10 pt-3">
      <h5 className="mb-2 text-sm font-semibold text-white">Fall of wickets</h5>
      <p className="text-sm tabular-nums text-white/70">
        {wickets.map((fow, idx) => (
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
  );
}

/** The batting side of `inn`, or the live one when it is neither team. */
function battingTeamOf(
  ctx: CardContext,
  inn: Innings | null | undefined,
): string {
  if (inn?.team_id === ctx.match?.team1_id) return ctx.team1Name;
  if (inn?.team_id === ctx.match?.team2_id) return ctx.team2Name;
  return ctx.state.batting_team_name ?? ctx.team1Name;
}

/** The innings shown: its side, score and overs (the live ones without it). */
function ScorecardHeading({
  ctx,
  innings,
}: {
  ctx: CardContext;
  innings: Innings | null | undefined;
}) {
  const { state } = ctx;
  return (
    <div>
      <p className="text-sm text-white/60">
        {ctx.source && <span>{ctx.source} · </span>}
        <span>Match scorecard</span>
      </p>
      <h2 className="mt-1 text-3xl font-semibold text-white">
        {battingTeamOf(ctx, innings)}{" "}
        <span className="font-bold tabular-nums">
          {innings?.total_runs ?? state.total_runs ?? 0}/
          {innings?.total_wickets ?? state.total_wickets ?? 0}
        </span>
      </h2>
      <p className="text-sm tabular-nums text-white/60">
        Overs:{" "}
        {innings
          ? oversText(innings.total_balls)
          : `${state.current_over}.${state.current_ball}`}{" "}
        / {state.overs_per_innings} ov
      </p>
    </div>
  );
}

function ScorecardCard({
  ctx,
  innings,
  selectedIdx,
  onSelect,
}: {
  ctx: CardContext;
  innings: Innings[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  const selected =
    innings.length > 0 ? innings[selectedIdx] || innings[0] : null;
  const first = ctx.match?.innings?.[0];
  return (
    <CardShell
      ctx={ctx}
      className="max-h-[90vh] w-full max-w-5xl overflow-y-auto"
    >
      <div className="p-6 md:p-8">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
          <ScorecardHeading ctx={ctx} innings={selected} />

          {innings.length > 0 && (
            <InningsTabs
              ctx={ctx}
              innings={innings}
              selectedIdx={selectedIdx}
              onSelect={onSelect}
            />
          )}
        </div>

        <div className="mt-5">
          <h4 className="mb-2 text-base font-semibold text-white">Batting</h4>
          <BattingTable
            rows={
              selected?.batting_performances ||
              first?.batting_performances ||
              []
            }
          />
          {selected && (
            <div className="mt-2.5 flex items-center justify-between px-3 text-sm text-white/70">
              <span className="font-medium text-white">
                Extras: {selected.extras_total}
              </span>
              <span className="tabular-nums text-white/60">
                (b {selected.extras_byes}, lb {selected.extras_leg_byes}, w{" "}
                {selected.extras_wides}, nb {selected.extras_no_balls})
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <h4 className="mb-2 text-base font-semibold text-white">Bowling</h4>
          <BowlingTable
            rows={
              selected?.bowling_performances ||
              first?.bowling_performances ||
              []
            }
          />
        </div>

        {selected?.fall_of_wickets && selected.fall_of_wickets.length > 0 && (
          <FallOfWickets wickets={selected.fall_of_wickets} />
        )}
      </div>
    </CardShell>
  );
}

function PartnershipCard({ ctx }: { ctx: CardContext }) {
  const { state } = ctx;
  const batters = [
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
  ];
  return (
    <CardShell ctx={ctx} className="w-full max-w-xl">
      <div className="p-7">
        <div className="border-b border-white/10 pb-3 text-center">
          <Eyebrow ctx={ctx} label="Partnership" />
          <h3 className="mt-1 text-4xl font-bold tabular-nums text-white">
            {state.partnership_runs ?? 0} runs
          </h3>
          <p className="mt-0.5 text-sm tabular-nums text-white/60">
            Off {state.partnership_balls ?? 0} balls
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 items-center gap-4">
          {batters.map((b) => (
            <div
              key={b.label}
              className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-center"
            >
              <p className="text-sm text-white/60">{b.label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{b.name}</p>
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
    </CardShell>
  );
}

const BALL_CHIP = new Map([
  ["W", "bg-red-600 text-white"],
  ["4", "bg-sky-600 text-white"],
  ["6", "bg-amber-400 text-black"],
]);

function OverSummaryCard({ ctx }: { ctx: CardContext }) {
  const { state } = ctx;
  const balls = (state.this_over_balls ?? "").split(" ").filter(Boolean);
  return (
    <CardShell ctx={ctx} className="w-full max-w-xl">
      <div className="p-7">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <Eyebrow ctx={ctx} label="Over summary" />
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
            {balls.map((ball, idx) => (
              <span
                key={idx}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${BALL_CHIP.get(ball) ?? "bg-white/15 text-white"}`}
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
              {state.bowler_balls ? oversText(state.bowler_balls) : "0.0"} ov)
            </span>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function ResultCard({ ctx }: { ctx: CardContext }) {
  const { state, match, team1Name, team2Name } = ctx;
  const [first, second] = [match?.innings?.[0], match?.innings?.[1]];
  return (
    <CardShell ctx={ctx} className="w-full max-w-2xl text-center">
      <div className="p-8">
        <Eyebrow ctx={ctx} label="Match result" />
        <h2 className="mt-2 text-balance text-3xl font-semibold text-white">
          {state.result_description ?? "Match completed"}
        </h2>

        <div className="mt-6 flex items-center justify-around border-y border-white/10 py-5">
          <div>
            <p className="text-base font-medium text-white/80">{team1Name}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">
              {first?.total_runs ?? state.total_runs}/
              {first?.total_wickets ?? state.total_wickets}
            </p>
          </div>
          <div className="text-base font-medium text-white/50">vs</div>
          <div>
            <p className="text-base font-medium text-white/80">{team2Name}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">
              {second?.total_runs ?? "—"}/{second?.total_wickets ?? "—"}
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
    </CardShell>
  );
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

  const ctx: CardContext = {
    state,
    match,
    team1Name: state.team1_name ?? "Team 1",
    team2Name: state.team2_name ?? "Team 2",
    accent: THEME_ACCENT[theme] ?? THEME_ACCENT.starsports,
    source: state.tournament_name ?? state.title,
  };

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

      {card === "toss" && <TossCard ctx={ctx} />}
      {card === "playing_xi" && <PlayingXiCard ctx={ctx} />}
      {card === "scorecard" && (
        <ScorecardCard
          ctx={ctx}
          innings={inningsList}
          selectedIdx={selectedInningsIdx}
          onSelect={setSelectedInningsIdx}
        />
      )}
      {card === "partnership" && <PartnershipCard ctx={ctx} />}
      {card === "over_summary" && <OverSummaryCard ctx={ctx} />}
      {card === "result" && <ResultCard ctx={ctx} />}
    </div>
  );
}
