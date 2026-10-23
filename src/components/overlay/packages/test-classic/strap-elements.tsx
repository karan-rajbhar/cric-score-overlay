"use client";

/**
 * Test classic lower-third elements: batter and bowler (strap and figures
 * card), new batter, new bowler, partnership strap, chase, end of over,
 * the estimates' straps, stoppages, messages, profiles and the player of
 * the match. Each draws only what its props carry; without data, nothing.
 */

import type { ReactNode } from "react";
import { formatDismissalType, formatFowOvers } from "~/lib/cricket";
import type { PlayerCareerStatsRow } from "~/lib/firebase/types";
import { usePlayerProfile } from "../../overlay-data";
import { playerInSlot } from "../../profile-card";
import type { LiveMatchState } from "../../types";
import {
  avatarOf,
  ballsPerOverOf,
  batterNow,
  bowlerNow,
  economyText,
  estimateOf,
  oversText,
  partnershipOf,
  sidesOf,
  strapText,
  strikeRateText,
  teamCode,
  thisOverBalls,
} from "../shared";
import type { OverlayElementProps } from "../types";
import {
  delay,
  DROP_FILTER,
  FIGS,
  GOLD_LEAF,
  GoldRule,
  IVORY,
  Label,
  NAVY,
  RADIUS,
  SAFE,
  SERIF,
  TC,
  TcRoot,
} from "./kit";
import { bowlingFigures, ordinal, plural, scoreText, standingOf } from "./logic";
import {
  NameStrap,
  OverRow,
  Portrait,
  sideColour,
  TextStrap,
  type Cell,
} from "./straps";

type P<E extends keyof OverlayElementProps> = OverlayElementProps[E];

// ---- batter --------------------------------------------------------------

/** A batter's figures row: balls, fours, sixes (when the row has them), strike rate. */
function batterCells(b: NonNullable<ReturnType<typeof batterNow>>): Cell[] {
  const cells: Cell[] = [{ label: "Balls", value: b.balls }];
  if (b.fours !== null) cells.push({ label: "Fours", value: b.fours });
  if (b.sixes !== null) cells.push({ label: "Sixes", value: b.sixes });
  cells.push({ label: "Strike rate", value: b.strikeRate ?? "–" });
  return cells;
}

function LastOut({
  state,
  layout,
  figures,
}: {
  state: LiveMatchState;
  layout: P<"batterLowerThird">["layout"];
  figures: boolean;
}) {
  const w = state.last_wicket;
  if (!w?.name) return null;
  const cells: Cell[] = [
    { label: "How out", value: formatDismissalType(w.dismissal_type) },
  ];
  if (w.bowler_name) cells.push({ label: "Bowler", value: w.bowler_name });
  cells.push({ label: "Fell at", value: `${w.score}-${w.wicket_number}` });
  return (
    <NameStrap
      testId="last_wicket"
      layout={layout}
      label={`${figures ? "Out" : "Last wicket"} · ${ordinal(w.wicket_number)} wicket`}
      name={w.name}
      headline={w.runs}
      headlineNote={`${plural(w.balls, "ball")} · ${formatFowOvers(w.overs)} ov`}
      cells={cells}
      sub={
        figures && strikeRateText(w.runs, w.balls)
          ? `Strike rate ${strikeRateText(w.runs, w.balls)}`
          : undefined
      }
      stripe={TC.claret}
    />
  );
}

export function BatterLowerThird(p: P<"batterLowerThird">) {
  const { state, layout } = p;
  if (p.slot === "last_out") {
    if (p.variant === "strap" && p.strap?.title) {
      return <TextStrap strap={p.strap} state={state} layout={layout} stripe={TC.claret} />;
    }
    return <LastOut state={state} layout={layout} figures={p.variant === "figures"} />;
  }
  if (p.variant === "strap" && p.strap?.title) {
    return <TextStrap strap={p.strap} state={state} layout={layout} stripe={sideColour(state, true)} />;
  }
  const striker = p.slot === "striker";
  const f = batterNow(state, p.slot);
  if (!f) return null;
  const stand =
    p.variant === "figures" ? partnershipOf(state, p.match?.innings ?? []) : null;
  const share = stand?.split ? stand.batters[striker ? 0 : 1] : null;
  const partner = stand?.batters[striker ? 1 : 0]?.name;
  const { batting } = sidesOf(state);
  return (
    <NameStrap
      testId={p.variant === "strap" ? "batsman" : "batter-figures"}
      layout={layout}
      label={[
        batting.name,
        striker ? "On strike" : "Batting",
      ]
        .filter(Boolean)
        .join(" · ")}
      name={f.name}
      headline={
        <>
          {f.runs}
          <span className="text-[1.75rem]">*</span>
        </>
      }
      headlineNote={`${plural(f.balls, "ball")}, not out`}
      cells={batterCells(f)}
      sub={
        share && share.runs !== null && stand
          ? `${share.runs} of the ${stand.runs}-run stand with ${partner}`
          : stand
            ? `Partnership ${stand.runs} (${stand.balls})`
            : undefined
      }
      stripe={sideColour(state, true)}
      lead={
        p.variant === "figures" ? (
          <Portrait name={f.name} url={avatarOf(p.match, f.id)} size={76} />
        ) : undefined
      }
    />
  );
}

// ---- bowler --------------------------------------------------------------

export function BowlerLowerThird(p: P<"bowlerLowerThird">) {
  const { state, layout, match } = p;
  if (p.variant === "strap" && p.strap?.title) {
    return <TextStrap strap={p.strap} state={state} layout={layout} stripe={sideColour(state, false)} />;
  }
  const bpo = ballsPerOverOf(match);
  const b = bowlerNow(state, bpo);
  if (!b) return null;
  const row =
    p.variant === "figures"
      ? match?.innings
          ?.find((i) => i.innings_number === state.innings_number)
          ?.bowling_performances?.find((b) => b.user_id === state.bowler_id)
      : undefined;
  const cells: Cell[] = [
    { label: "Overs", value: b.overs },
    { label: "Maidens", value: b.maidens ?? 0 },
    { label: "Runs", value: b.runs },
    { label: "Wkts", value: b.wickets },
    { label: "Econ", value: b.economy ?? "–" },
  ];
  if (row) {
    cells.push({ label: "Wd", value: row.wides }, { label: "Nb", value: row.no_balls });
  }
  const { bowling } = sidesOf(state);
  return (
    <NameStrap
      testId={p.variant === "strap" ? "bowler" : "bowler-figures"}
      layout={layout}
      label={[bowling.name, "Bowling"].filter(Boolean).join(" · ")}
      name={b.name}
      headline={b.figures}
      headlineNote={`${b.overs} overs`}
      cells={cells}
      stripe={sideColour(state, false)}
      lead={
        p.variant === "figures" ? (
          <Portrait name={b.name} url={avatarOf(match, b.id)} size={76} />
        ) : undefined
      }
      width={p.variant === "figures" ? 1180 : 1040}
    />
  );
}

// ---- arrivals --------------------------------------------------------------

export function NewBatter(p: P<"newBatter">) {
  const text = strapText(p.strap, p.state);
  if (!text?.title) return null;
  return (
    <NameStrap
      testId="new_batter"
      layout={p.layout}
      label={text.badge || "New batter"}
      name={text.title}
      sub={[text.subtitle, text.detail].filter(Boolean).join(" · ") || undefined}
      stripe={sideColour(p.state, true)}
      lead={<Portrait name={text.title} size={72} />}
    />
  );
}

export function NewBowler(p: P<"newBowler">) {
  const { state } = p;
  const text = strapText(p.strap, state);
  if (!text?.title) return null;
  const bpo = ballsPerOverOf(p.match);
  // Figures only when this is the bowler on now and has bowled.
  const own =
    text.title === state.current_bowler_name && (state.bowler_balls ?? 0) > 0;
  return (
    <NameStrap
      testId="new_bowler"
      layout={p.layout}
      label={text.badge || "Into the attack"}
      name={text.title}
      headline={
        own
          ? bowlingFigures(state.bowler_balls, state.bowler_maidens, state.bowler_runs, state.bowler_wickets, bpo)
          : undefined
      }
      headlineNote={own ? "O-M-R-W" : undefined}
      sub={[text.subtitle, text.detail].filter(Boolean).join(" · ") || undefined}
      stripe={sideColour(state, false)}
      lead={<Portrait name={text.title} size={72} />}
    />
  );
}

// ---- partnership, chase, this over -------------------------------------------

export function PartnershipStrap(p: P<"partnership">) {
  const { state } = p;
  if (p.strap?.title) {
    return <TextStrap strap={p.strap} state={state} layout={p.layout} stripe={sideColour(state, true)} />;
  }
  if (
    state.partnership_runs === null ||
    state.partnership_runs === undefined ||
    !state.striker_name ||
    !state.non_striker_name
  ) {
    return null;
  }
  const balls = state.partnership_balls ?? 0;
  const cells: Cell[] = [
    { label: "Runs", value: state.partnership_runs },
    { label: "Balls", value: balls },
  ];
  const rate = economyText(state.partnership_runs, balls);
  if (rate) cells.push({ label: "Run rate", value: rate });
  return (
    <NameStrap
      testId="partnership"
      layout={p.layout}
      label={`Partnership · ${ordinal((state.total_wickets ?? 0) + 1)} wicket`}
      name={`${state.striker_name} & ${state.non_striker_name}`}
      headline={state.partnership_runs}
      headlineNote={plural(balls, "ball")}
      cells={cells}
      stripe={sideColour(state, true)}
    />
  );
}

export function ChaseStrap(p: P<"chase">) {
  const { state } = p;
  if (p.strap?.title) {
    return <TextStrap strap={p.strap} state={state} layout={p.layout} stripe={sideColour(state, true)} />;
  }
  const standing = standingOf(state, p.match);
  if (standing?.kind !== "chase") return null;
  const cells: Cell[] = [];
  if (state.required_run_rate !== null && standing.balls !== null) {
    cells.push({ label: "Req rate", value: state.required_run_rate.toFixed(2) });
  }
  if (state.current_run_rate !== null) {
    cells.push({ label: "Run rate", value: state.current_run_rate.toFixed(2) });
  }
  cells.push({
    label: "Score",
    value: scoreText(state.total_runs, state.total_wickets),
  });
  return (
    <NameStrap
      testId="target"
      layout={p.layout}
      label={`${state.batting_team_name ?? "The chase"} · The chase`}
      name={standing.text}
      headline={standing.target}
      headlineNote="Target"
      cells={cells}
      stripe={sideColour(state, true)}
    />
  );
}

export function ThisOverStrap(p: P<"thisOver">) {
  const { state } = p;
  const strap = p.strap ?? { id: "tc-over", type: "over_end" as const, title: "" };
  const text = strapText(strap, state);
  const balls = thisOverBalls(state);
  if (!text?.title && !balls.length) return null;
  const bpo = ballsPerOverOf(p.match);
  const runs = state.this_over_runs ?? null;
  return (
    <NameStrap
      testId="over_end"
      layout={p.layout}
      label={text?.badge || `Over ${(state.current_over ?? 0) + (balls.length ? 1 : 0)}`}
      name={text?.title || (runs !== null ? plural(runs, "run") : "This over")}
      headline={scoreText(state.total_runs, state.total_wickets)}
      headlineNote={`${oversText(state.total_balls, bpo)} overs`}
      stripe={sideColour(state, false)}
      sub={
        state.current_bowler_name
          ? `${state.current_bowler_name}  ${bowlingFigures(state.bowler_balls, state.bowler_maidens, state.bowler_runs, state.bowler_wickets, bpo)}`
          : undefined
      }
    >
      {balls.length > 0 && <OverRow balls={balls} ballsPerOver={bpo} />}
    </NameStrap>
  );
}

// ---- estimates ---------------------------------------------------------------

/** Two sides' chances as one bar, each in its stripe colour. */
export function ChanceBar({
  state,
  battingPct,
  height = 14,
}: {
  state: LiveMatchState;
  battingPct: number;
  height?: number;
}) {
  return (
    <div
      role="img"
      aria-label={`${state.batting_team_name} ${battingPct} percent, ${state.bowling_team_name} ${100 - battingPct} percent`}
      className="tc-a-grow flex overflow-hidden"
      style={{ height, borderRadius: 2, boxShadow: `inset 0 0 0 1px ${TC.ivoryLine}`, ...delay(360) }}
    >
      <span style={{ width: `${battingPct}%`, background: sideColour(state, true) }} />
      <span style={{ width: 2, background: GOLD_LEAF }} />
      <span className="flex-1" style={{ background: sideColour(state, false) }} />
    </div>
  );
}

export function WinPredictorStrap(p: P<"winPredictor">) {
  const { state } = p;
  const est = estimateOf(state);
  if (!est || est.kind !== "chase") return null;
  const bat = teamCode(state.batting_team_short_name, state.batting_team_name);
  const bowl = teamCode(state.bowling_team_short_name, state.bowling_team_name);
  return (
    <NameStrap
      testId="win_predictor"
      layout={p.layout}
      label="Win predictor · Estimate"
      name={
        <span style={FIGS}>
          {bat} {est.battingPct}%
          <span className="mx-4 text-[1.75rem] italic" style={{ color: TC.goldText }}>
            v
          </span>
          {bowl} {est.bowlingPct}%
        </span>
      }
      sub={`Need ${est.runsNeeded} from ${plural(est.ballsLeft, "ball")}`}
    >
      <div className="mt-3">
        <ChanceBar state={state} battingPct={est.battingPct} />
      </div>
    </NameStrap>
  );
}

export function ProjectedStrap(p: P<"projectedScore">) {
  const { state } = p;
  const est = estimateOf(state);
  if (!est || est.kind !== "projection") return null;
  return (
    <NameStrap
      testId="win_predictor"
      layout={p.layout}
      label="Projected score · Estimate"
      name={`${est.low} to ${est.high}`}
      headline={scoreText(state.total_runs, state.total_wickets)}
      headlineNote={`${oversText(state.total_balls)} overs`}
      sub={`${state.batting_team_name ?? "The batting side"} at this rate, with the overs and wickets left`}
      stripe={sideColour(state, true)}
    />
  );
}

// ---- stoppages and messages ----------------------------------------------------

/** The score as a stoppage shows it: side, score, overs, the stand. */
function stoppageCells(state: LiveMatchState): Cell[] {
  if (state.total_runs === null || state.total_runs === undefined) return [];
  const cells: Cell[] = [
    {
      label: teamCode(state.batting_team_short_name, state.batting_team_name),
      value: scoreText(state.total_runs, state.total_wickets),
    },
    { label: "Overs", value: oversText(state.total_balls) },
  ];
  if (state.partnership_runs && state.striker_name) {
    cells.push({
      label: "Stand",
      value: `${state.partnership_runs} (${state.partnership_balls ?? 0})`,
    });
  }
  return cells;
}

export function BreakStrapView(p: P<"breakStrap">) {
  const { state } = p;
  const strap = p.strap ?? { id: `tc-${p.kind}`, type: p.kind, title: "" };
  const text = strapText(strap, state);
  if (!text?.title) return null;
  const withScore = p.kind === "drinks" || p.kind === "rain_delay" || p.kind === "timeout";
  return (
    <NameStrap
      testId={p.kind}
      layout={p.layout}
      label={text.badge || " "}
      name={text.title}
      cells={withScore ? stoppageCells(state) : undefined}
      sub={
        withScore
          ? text.detail || (p.kind === "drinks" ? undefined : text.subtitle) || undefined
          : [text.subtitle, text.detail].filter(Boolean).join(" · ") || undefined
      }
      stripe={p.kind === "rain_delay" ? TC.ivoryLine : TC.gold}
    />
  );
}

export function MessageView(p: P<"message">) {
  const { state, strap } = p;
  const text = strapText(strap, state);
  if (!text?.title) return null;
  const form = strap.type === "message" ? (strap.form ?? "double") : "double";
  if (form === "single") {
    return (
      <TcRoot
        data-strap-type="message"
        className="fixed z-30"
        style={{ left: SAFE.x, right: SAFE.x, bottom: SAFE.y, filter: DROP_FILTER }}
      >
        <div
          className="tc-a-wipe relative flex h-[4.75rem] items-center gap-6 overflow-hidden px-8"
          style={{ ...NAVY, borderRadius: RADIUS }}
        >
          <GoldRule height={2} className="absolute inset-x-0 top-0" sheen />
          {text.badge && (
            <Label className="tc-a-fade shrink-0" style={{ color: TC.goldText, ...delay(160) }}>
              {text.badge}
            </Label>
          )}
          <span
            className="tc-a-rise truncate text-[2.125rem] font-bold"
            style={{ fontFamily: SERIF, ...delay(100) }}
          >
            {text.title}
          </span>
        </div>
      </TcRoot>
    );
  }
  if (form === "baseline") {
    return (
      <TcRoot
        data-strap-type="message"
        className="fixed z-30"
        style={{ left: SAFE.x, right: SAFE.x, bottom: 12 }}
      >
        <div
          className="tc-a-wipe flex h-9 items-center gap-5 overflow-hidden px-6"
          style={{ ...IVORY, borderRadius: RADIUS, boxShadow: `${IVORY.boxShadow}, 0 4px 12px rgba(3,9,22,0.35)` }}
        >
          {text.badge && (
            <span
              className="rounded-[3px] px-2 py-1 text-[1rem] font-semibold uppercase leading-none tracking-[0.14em]"
              style={{ background: TC.navy, color: TC.goldText }}
            >
              {text.badge}
            </span>
          )}
          <span className="truncate text-[1.25rem] font-medium" style={{ color: TC.ink }}>
            {text.title}
          </span>
        </div>
      </TcRoot>
    );
  }
  return (
    <NameStrap
      testId="message"
      layout={p.layout}
      label={text.badge || "Notice"}
      name={text.title}
      width={1120}
    >
      {text.subtitle && (
        <p
          className="tc-a-fade line-clamp-3 text-[1.5rem] leading-snug"
          style={{ color: TC.ink, fontFamily: SERIF, ...delay(360) }}
        >
          {text.subtitle}
        </p>
      )}
    </NameStrap>
  );
}

// ---- profiles ------------------------------------------------------------------

function careerCells(c: PlayerCareerStatsRow, bowler: boolean): Cell[] {
  if (bowler) {
    return [
      { label: "Matches", value: c.total_matches ?? 0 },
      { label: "Wkts", value: c.total_wickets ?? 0 },
      ...(c.bowling_average ? [{ label: "Avg", value: c.bowling_average.toFixed(2) }] : []),
      ...(c.economy_rate ? [{ label: "Econ", value: c.economy_rate.toFixed(2) }] : []),
      ...(c.best_bowling_figures ? [{ label: "Best", value: c.best_bowling_figures }] : []),
      ...(c.five_wicket_hauls ? [{ label: "Five-fors", value: c.five_wicket_hauls }] : []),
    ];
  }
  return [
    { label: "Matches", value: c.total_matches ?? 0 },
    { label: "Runs", value: c.total_runs ?? 0 },
    ...(c.batting_average ? [{ label: "Avg", value: c.batting_average.toFixed(2) }] : []),
    ...(c.highest_score ? [{ label: "HS", value: c.highest_score }] : []),
    { label: "Hundreds", value: c.centuries ?? 0 },
    { label: "Fifties", value: c.half_centuries ?? 0 },
    ...(c.strike_rate ? [{ label: "SR", value: c.strike_rate.toFixed(1) }] : []),
  ];
}

export function PlayerProfile(p: P<"playerProfile">) {
  const { state } = p;
  const who = playerInSlot(state, p.slot);
  const career = p.mode === "career";
  const read = usePlayerProfile(
    state,
    career && p.profile === undefined ? who.id : null,
    career,
  );
  if (!who.name) return null;
  if (career) {
    const profile = p.profile ?? read.profile;
    const loaded = p.profile !== undefined || read.loaded;
    if (!loaded || !profile?.career) return null;
    return (
      <NameStrap
        testId="career"
        layout={p.layout}
        label={`Career record · ${who.bowler ? "Bowling" : "Batting"}`}
        name={who.name}
        cells={careerCells(profile.career, who.bowler)}
        stripe={sideColour(state, !who.bowler)}
        lead={<Portrait name={who.name} url={profile.avatarUrl} size={76} />}
        width={1180}
      />
    );
  }
  const f = who.id ? p.snapshots?.series?.[who.id] : null;
  if (!f) return null;
  const cells: Cell[] = [{ label: "Matches", value: f.matches }];
  if (who.bowler) {
    if (f.wickets !== null && f.wickets !== undefined) cells.push({ label: "Wkts", value: f.wickets });
    if (f.economy) cells.push({ label: "Econ", value: f.economy.toFixed(2) });
    if (f.best) cells.push({ label: "Best", value: f.best });
  } else {
    if (f.runs !== null && f.runs !== undefined) cells.push({ label: "Runs", value: f.runs });
    if (f.average) cells.push({ label: "Avg", value: f.average.toFixed(2) });
    if (f.strikeRate) cells.push({ label: "SR", value: f.strikeRate.toFixed(1) });
    if (f.highest) cells.push({ label: "HS", value: f.highest });
  }
  return (
    <NameStrap
      testId="series"
      layout={p.layout}
      label={state.tournament_name ?? "This tournament"}
      name={who.name}
      cells={cells}
      stripe={sideColour(state, !who.bowler)}
      lead={<Portrait name={who.name} size={76} />}
    />
  );
}

export function PlayerOfTheMatch(p: P<"playerOfTheMatch">) {
  const potm = p.match?.player_of_the_match;
  if (!potm?.full_name) return null;
  const bat = p.innings
    .flatMap((i) => i.batting_performances ?? [])
    .filter((b) => b.user_id === potm.id && (b.balls_faced > 0 || b.is_out));
  const bowl = p.innings
    .flatMap((i) => i.bowling_performances ?? [])
    .filter((b) => b.user_id === potm.id && b.balls_bowled > 0);
  const lines: ReactNode[] = [
    ...bat.map((b) => `${b.runs_scored}${b.is_out ? "" : "*"} (${b.balls_faced})`),
    ...bowl.map((b) => `${b.wickets_taken}-${b.runs_conceded} (${oversText(b.balls_bowled)} ov)`),
  ];
  return (
    <NameStrap
      testId="potm"
      layout={p.layout}
      label="Player of the match"
      name={potm.full_name}
      sub={
        lines.length ? (
          <span className="flex items-center gap-4">
            {lines.map((l, i) => (
              <span key={i} className="flex items-center gap-4">
                {i > 0 && <span style={{ color: TC.ivoryLine }}>|</span>}
                <span className="font-semibold" style={FIGS}>
                  {l}
                </span>
              </span>
            ))}
          </span>
        ) : undefined
      }
      lead={<Medal name={potm.full_name} />}
      stripe={TC.gold}
    />
  );
}

/** A gold medallion: the player-of-the-match mark. */
function Medal({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        background: "radial-gradient(circle at 35% 30%, #f7e7b0 0%, #d6b462 40%, #9b7731 100%)",
        boxShadow: "inset 0 0 0 3px rgba(255,248,225,0.55), inset 0 0 0 6px rgba(138,106,40,0.6), 0 3px 8px rgba(0,0,0,0.4)",
      }}
    >
      <span
        className="text-[1.5rem] font-bold"
        style={{ fontFamily: SERIF, color: TC.ink }}
      >
        {initials}
      </span>
      <span className="tc-a-sheen absolute inset-y-0 left-0 w-1/2" style={{ background: "linear-gradient(90deg, transparent, rgba(255,250,235,0.7), transparent)", ...delay(700) }} />
    </span>
  );
}
