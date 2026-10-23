"use client";

/**
 * Summer bash lower thirds: player straps (a photo slot with initials,
 * the name on a slanted plate, the figure on a neon plate), the chase,
 * the over, the stand, estimates, stoppages (the powerplay strap among
 * them) and the producer's messages. Text comes from `strapText` (the
 * producer's words, else the live score's); nothing is made up.
 */

import type { CSSProperties, ReactNode } from "react";
import { formatDismissalType } from "~/lib/cricket";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import {
  economyText,
  overTokens,
  oversText,
  strikeRateText,
  teamCode,
} from "../../overlay-kit";
import { inningsStats, playerInSlot } from "../../profile-card";
import { strapText, type StrapText } from "../../strap-views";
import type {
  ActiveLowerThirdStrap,
  LayoutMode,
  LiveMatchState,
} from "../../types";
import { avatarOf } from "../shared";
import type { BreakKind, OverlayElementProps } from "../types";
import {
  BallChips,
  BUG_ROW,
  delay,
  Frame,
  lowerThirdPlace,
  nameSize,
  neonStyle,
  Num,
  Photo,
  s,
  SAFE_X,
  SAFE_Y,
  sideOfName,
  sideStyle,
  StatTile,
  Tag,
  type NeonKey,
  type SideKey,
} from "./kit";

// ---- placement and shells ----------------------------------------------------

/** A lower third's place for the score bug's layout. */
export function Lower({
  state,
  layout,
  type,
  children,
}: {
  state: LiveMatchState;
  layout: LayoutMode;
  type?: string;
  children: ReactNode;
}) {
  const at = lowerThirdPlace(layout);
  return (
    <Frame
      state={state}
      data-strap-type={type}
      className="fixed z-30 flex items-end"
      style={{ bottom: at.bottom, left: at.left, right: SAFE_X }}
    >
      {children}
    </Frame>
  );
}

/** The batting / bowling side's key. */
export function batKey(state: LiveMatchState): SideKey {
  return sideOfName(state, state.batting_team_name) ?? "bat";
}

export function bowlKey(state: LiveMatchState): SideKey {
  return sideOfName(state, state.bowling_team_name) ?? "bowl";
}

interface Tile {
  label: string;
  value: ReactNode;
}

/**
 * A player strap: photo slot, tag, name plate, figure plate and a detail
 * strip (or stat tiles).
 */
export function PlayerStrap({
  side,
  tag,
  tagNeon = "magenta",
  name,
  photo,
  figure,
  note,
  details,
  tiles,
  figureNeon = "yellow",
}: {
  side: SideKey;
  tag: ReactNode;
  tagNeon?: NeonKey;
  name: string;
  photo?: string | null;
  figure?: ReactNode;
  note?: ReactNode;
  details?: ReactNode[];
  tiles?: Tile[];
  figureNeon?: NeonKey;
}) {
  const shown = (details ?? []).filter(Boolean);
  return (
    <div className="flex max-w-full items-end">
      <Photo
        url={photo}
        name={name}
        side={side}
        size={tiles ? 196 : 158}
        className={cn(s.pop, "z-10")}
      />
      <div className="-ml-7 flex min-w-0 flex-col items-start">
        <Tag neon={tagNeon} className={cn(s.inLeft, "ml-9")} style={delay(120)}>
          {tag}
        </Tag>
        <div
          className={cn(s.lift, "mt-2 flex max-w-full items-stretch")}
          style={{ ...sideStyle(side), height: 88 }}
        >
          <div
            style={{ "--k": "26px", ...delay(60) } as CSSProperties}
            className={cn(
              s.glass,
              s.slantEnd,
              s.edgeBottom,
              s.inLeft,
              "relative flex min-w-[22rem] max-w-[46rem] items-center overflow-hidden pl-12 pr-12",
            )}
          >
            <span className={s.streak} style={delay(560)} />
            <span
              className={cn(s.display, "relative z-10 truncate uppercase leading-none")}
              style={{ fontSize: nameSize(name) }}
            >
              {name}
            </span>
          </div>
          {figure !== undefined && figure !== null && (
            <div
              style={{
                ...neonStyle(figureNeon),
                "--k": "26px",
                marginLeft: -18,
                ...delay(200),
              } as CSSProperties}
              className={cn(
                s.neon,
                s.slant,
                s.inLeft,
                "flex shrink-0 items-center gap-3 pl-12 pr-11",
              )}
            >
              <span
                className={cn(s.figures, "relative z-10 leading-none")}
                style={{ fontSize: 50, fontWeight: 800 }}
              >
                {figure}
              </span>
              {note && (
                <span
                  className={cn(s.figures, "relative z-10 text-[1.5rem] leading-none")}
                  style={{ fontWeight: 600 }}
                >
                  {note}
                </span>
              )}
            </div>
          )}
        </div>
        {tiles && tiles.length > 0 ? (
          <div className={cn(s.rise, "ml-7 mt-2 flex gap-2")} style={delay(320)}>
            {tiles.map((t, i) => (
              <StatTile
                key={t.label}
                label={t.label}
                value={t.value}
                className={cn(s.rise, "min-w-[7.5rem]")}
                style={delay(340 + i * 60)}
              />
            ))}
          </div>
        ) : shown.length > 0 ? (
          <div
            style={{ "--k": "18px", ...delay(320) } as CSSProperties}
            className={cn(
              s.well,
              s.slant,
              s.rise,
              s.semi,
              "ml-5 mt-1.5 flex h-11 max-w-full items-center gap-4 overflow-hidden pl-9 pr-10 text-[1.3125rem] font-bold tabular-nums",
            )}
          >
            <Dots items={shown} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Items split by small neon slashes. */
export function Dots({ items }: { items: ReactNode[] }) {
  return (
    <>
      {items.map((c, i) => (
        <span key={i} className="flex min-w-0 shrink-0 items-center gap-4">
          {i > 0 && (
            <span
              aria-hidden="true"
              className="h-4 w-[3px] -skew-x-[20deg] bg-[color:var(--edge)]"
            />
          )}
          <span className="truncate">{c}</span>
        </span>
      ))}
    </>
  );
}

/** A wide strap: tag, headline plate, optional side plate and strip. */
export function BannerStrap({
  tag,
  tagNeon = "magenta",
  tagSide,
  title,
  titleSize = 44,
  aside,
  asideNeon = "yellow",
  strip,
  edge,
  icon,
}: {
  tag?: ReactNode;
  tagNeon?: NeonKey;
  tagSide?: SideKey;
  title: ReactNode;
  titleSize?: number;
  aside?: ReactNode;
  asideNeon?: NeonKey;
  strip?: ReactNode;
  edge?: SideKey | NeonKey;
  icon?: ReactNode;
}) {
  const edgeStyle = edge
    ? edge === "t1" || edge === "t2" || edge === "bat" || edge === "bowl"
      ? sideStyle(edge)
      : neonStyle(edge)
    : neonStyle(tagNeon);
  return (
    <div className="flex min-w-0 max-w-full flex-col items-start">
      {tag && (
        <Tag
          neon={tagNeon}
          side={tagSide}
          className={cn(s.inLeft, "mb-2 ml-6")}
          style={delay(120)}
        >
          {tag}
        </Tag>
      )}
      <div
        className={cn(s.lift, "flex max-w-full items-stretch")}
        style={{ ...edgeStyle, height: 92 }}
      >
        {icon && (
          <div
            style={{ "--k": "26px", ...delay(0) } as CSSProperties}
            className={cn(
              s.neon,
              s.slantStart,
              s.pop,
              "flex w-[7.5rem] shrink-0 items-center justify-center pr-4",
            )}
          >
            <span className="relative z-10">{icon}</span>
          </div>
        )}
        <div
          style={{
            "--k": "26px",
            marginLeft: icon ? -18 : 0,
            ...delay(60),
          } as CSSProperties}
          className={cn(
            s.glass,
            icon ? s.slant : s.slantEnd,
            s.edgeBottom,
            s.inLeft,
            "relative flex min-w-[24rem] max-w-[60rem] items-center overflow-hidden pl-12 pr-12",
          )}
        >
          <span className={s.streak} style={delay(560)} />
          <span
            className={cn(s.display, "relative z-10 truncate uppercase leading-none")}
            style={{ fontSize: titleSize }}
          >
            {title}
          </span>
        </div>
        {aside !== undefined && aside !== null && (
          <div
            style={{
              ...neonStyle(asideNeon),
              "--k": "26px",
              marginLeft: -18,
              ...delay(200),
            } as CSSProperties}
            className={cn(
              s.neon,
              s.slant,
              s.inLeft,
              "flex shrink-0 items-center gap-3 pl-12 pr-11",
            )}
          >
            <span className="relative z-10 flex items-baseline gap-3">{aside}</span>
          </div>
        )}
      </div>
      {strip && (
        <div
          style={{ "--k": "18px", ...edgeStyle, ...delay(320) } as CSSProperties}
          className={cn(
            s.well,
            s.slant,
            s.rise,
            s.semi,
            "ml-4 mt-1.5 flex h-11 max-w-full items-center gap-4 overflow-hidden pl-9 pr-10 text-[1.3125rem] font-bold tabular-nums",
          )}
        >
          {strip}
        </div>
      )}
    </div>
  );
}

const big = (v: ReactNode) => (
  <span className={cn(s.figures, "leading-none")} style={{ fontSize: 50, fontWeight: 800 }}>
    {v}
  </span>
);

const small = (v: ReactNode) => (
  <span className={cn(s.figures, "text-[1.5rem] leading-none")} style={{ fontWeight: 600 }}>
    {v}
  </span>
);

// ---- batters and bowlers -----------------------------------------------------

function textOf(strap: ActiveLowerThirdStrap, state: LiveMatchState): StrapText | null {
  const text = strapText(strap, state);
  return text && text.title ? text : null;
}

export function BatterLowerThird(p: OverlayElementProps["batterLowerThird"]) {
  const { state, layout } = p;
  if (p.variant === "figures") {
    const who = playerInSlot(state, p.slot);
    const figures = inningsStats(state, p.slot);
    if (!who.name || !figures) return null;
    const tag =
      p.slot === "last_out" ? "Out" : p.slot === "striker" ? "On strike" : "Batting";
    const [runs, balls] = figures.headline.split(" ");
    return (
      <Lower state={state} layout={layout} type="figures">
        <PlayerStrap
          side={batKey(state)}
          tag={tag}
          tagNeon={p.slot === "last_out" ? "red" : "magenta"}
          name={who.name}
          photo={avatarOf(p.match, who.id)}
          figure={<Num value={runs} />}
          note={balls}
          tiles={figures.stats.map((st) => ({ label: st.label, value: st.value }))}
        />
      </Lower>
    );
  }
  const strap: ActiveLowerThirdStrap = p.strap ?? {
    id: "sb-batter",
    type: p.slot === "last_out" ? "last_wicket" : "batsman",
    title: "",
  };
  const text = textOf(strap, state);
  if (!text) return null;
  const lastOut = strap.type === "last_wicket";
  const w = state.last_wicket;
  const own = !lastOut && text.title === state.striker_name;
  const ownOut = lastOut && !!w && text.title === w.name;
  const details = own
    ? [
        state.striker_fours != null && `4s ${state.striker_fours}`,
        state.striker_sixes != null && `6s ${state.striker_sixes}`,
        strikeRateText(state.striker_runs, state.striker_balls) &&
          `SR ${strikeRateText(state.striker_runs, state.striker_balls)}`,
      ]
    : ownOut && w
      ? [
          w.dismissal_type && formatDismissalType(w.dismissal_type),
          w.bowler_name && `b ${w.bowler_name}`,
          `Fell at ${w.score}/${w.wicket_number}`,
        ]
      : [text.subtitle, text.detail];
  return (
    <Lower state={state} layout={layout} type={strap.type}>
      <PlayerStrap
        side={batKey(state)}
        tag={text.badge || (lastOut ? "Last wicket" : "Batting")}
        tagNeon={lastOut ? "red" : "magenta"}
        name={text.title}
        photo={avatarOf(p.match, own ? state.striker_id : ownOut ? w?.player_id : null)}
        figure={
          own ? (
            <Num value={state.striker_runs ?? 0} />
          ) : ownOut && w ? (
            w.runs
          ) : undefined
        }
        note={own ? `(${state.striker_balls ?? 0})` : ownOut && w ? `(${w.balls})` : undefined}
        details={details.filter(Boolean) as ReactNode[]}
      />
    </Lower>
  );
}

export function BowlerLowerThird(p: OverlayElementProps["bowlerLowerThird"]) {
  const { state, layout } = p;
  if (p.variant === "figures") {
    const who = playerInSlot(state, "bowler");
    const figures = inningsStats(state, "bowler");
    if (!who.name || !figures) return null;
    return (
      <Lower state={state} layout={layout} type="figures">
        <PlayerStrap
          side={bowlKey(state)}
          tag="Bowling"
          tagNeon="cyan"
          name={who.name}
          photo={avatarOf(p.match, who.id)}
          figure={<Num value={figures.headline} />}
          figureNeon="cyan"
          tiles={figures.stats.map((st) => ({ label: st.label, value: st.value }))}
        />
      </Lower>
    );
  }
  const text = textOf(p.strap ?? { id: "sb-bowler", type: "bowler", title: "" }, state);
  if (!text) return null;
  const own = text.title === state.current_bowler_name;
  const econ = economyText(state.bowler_runs, state.bowler_balls);
  return (
    <Lower state={state} layout={layout} type="bowler">
      <PlayerStrap
        side={bowlKey(state)}
        tag={text.badge || "Bowling"}
        tagNeon="cyan"
        name={text.title}
        photo={avatarOf(p.match, own ? state.bowler_id : null)}
        figure={own ? <Num value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} /> : undefined}
        figureNeon="cyan"
        details={
          own
            ? [
                `${oversText(state.bowler_balls)} overs`,
                state.bowler_maidens != null && `Maidens ${state.bowler_maidens}`,
                econ && `Econ ${econ}`,
              ].filter(Boolean)
            : [text.subtitle, text.detail].filter(Boolean)
        }
      />
    </Lower>
  );
}

export function NewBatter(p: OverlayElementProps["newBatter"]) {
  const text = textOf(p.strap, p.state);
  if (!text) return null;
  return (
    <Lower state={p.state} layout={p.layout} type="new_batter">
      <PlayerStrap
        side={batKey(p.state)}
        tag={text.badge || "New batter"}
        tagNeon="lime"
        name={text.title}
        photo={avatarOf(p.match, text.title === p.state.striker_name ? p.state.striker_id : null)}
        details={[text.subtitle, text.detail].filter(Boolean)}
      />
    </Lower>
  );
}

export function NewBowler(p: OverlayElementProps["newBowler"]) {
  const text = textOf(p.strap, p.state);
  if (!text) return null;
  return (
    <Lower state={p.state} layout={p.layout} type="new_bowler">
      <PlayerStrap
        side={bowlKey(p.state)}
        tag={text.badge || "Into the attack"}
        tagNeon="cyan"
        name={text.title}
        photo={avatarOf(
          p.match,
          text.title === p.state.current_bowler_name ? p.state.bowler_id : null,
        )}
        details={[text.subtitle, text.detail].filter(Boolean)}
      />
    </Lower>
  );
}

// ---- the stand, the chase, the over --------------------------------------------

export function PartnershipStrap({
  state,
  layout,
  strap,
}: {
  state: LiveMatchState;
  layout: LayoutMode;
  strap: ActiveLowerThirdStrap | null;
}) {
  const text = textOf(strap ?? { id: "sb-stand", type: "partnership", title: "" }, state);
  if (!text) return null;
  const own =
    !strap?.title && state.partnership_runs !== null && !!state.striker_name;
  return (
    <Lower state={state} layout={layout} type="partnership">
      <BannerStrap
        tag={text.badge || "Partnership"}
        tagNeon="lime"
        edge="lime"
        title={own ? `${state.striker_name} & ${state.non_striker_name}` : text.title}
        titleSize={own ? 34 : 40}
        aside={
          own ? (
            <>
              {big(<Num value={state.partnership_runs ?? 0} />)}
              {small(<>off <Num value={state.partnership_balls ?? 0} /></>)}
            </>
          ) : undefined
        }
        asideNeon="lime"
        strip={
          own ? undefined : <Dots items={[text.subtitle, text.detail].filter(Boolean)} />
        }
      />
    </Lower>
  );
}

export function ChaseStrap(p: OverlayElementProps["chase"]) {
  const { state } = p;
  const text = textOf(p.strap ?? { id: "sb-chase", type: "target", title: "" }, state);
  if (!text) return null;
  const own = !p.strap?.title && state.runs_needed !== null;
  return (
    <Lower state={state} layout={p.layout} type="target">
      <BannerStrap
        tag={text.badge || "Chase"}
        tagNeon="yellow"
        tagSide={undefined}
        edge="yellow"
        title={
          own ? (
            <>
              Need <Num value={state.runs_needed} /> off{" "}
              <Num value={state.balls_remaining ?? 0} />
            </>
          ) : (
            text.title
          )
        }
        aside={
          state.target_runs !== null ? (
            <>
              {small("Target")}
              {big(state.target_runs)}
            </>
          ) : undefined
        }
        strip={
          <Dots
            items={[
              state.required_run_rate !== null && `Required ${state.required_run_rate.toFixed(2)}`,
              state.current_run_rate !== null && `Current ${state.current_run_rate.toFixed(2)}`,
              !own && text.subtitle,
            ].filter(Boolean)}
          />
        }
      />
    </Lower>
  );
}

export function ThisOverStrap({
  state,
  layout,
  strap,
}: {
  state: LiveMatchState;
  layout: LayoutMode;
  strap: ActiveLowerThirdStrap | null;
}) {
  const text = textOf(
    strap ?? {
      id: "sb-over",
      type: "over_end",
      badge: `Over ${(state.current_over ?? 0) + 1}`,
      title: `${state.this_over_runs ?? 0} runs`,
    },
    state,
  );
  if (!text) return null;
  const tokens = overTokens(state);
  return (
    <Lower state={state} layout={layout} type="over_end">
      <BannerStrap
        tag={text.badge || "This over"}
        tagNeon="cyan"
        edge="cyan"
        title={text.title}
        aside={
          tokens.length ? (
            <BallChips tokens={tokens} slots={Math.max(6, tokens.length)} size={44} />
          ) : undefined
        }
        asideNeon="cyan"
        strip={
          text.subtitle || text.detail ? (
            <Dots items={[text.subtitle, text.detail].filter(Boolean)} />
          ) : undefined
        }
      />
    </Lower>
  );
}

// ---- estimates -------------------------------------------------------------------

/** A tug-of-war bar in the two sides' colours. */
export function TugBar({
  left,
  right,
  leftSide,
  rightSide,
  height = 18,
}: {
  left: number;
  right: number;
  leftSide: SideKey;
  rightSide: SideKey;
  height?: number;
}) {
  return (
    <div
      role="img"
      aria-label={`${left} percent to ${right} percent`}
      className="relative flex w-full overflow-hidden rounded-[3px]"
      style={{ height, background: "rgba(255,255,255,0.08)" }}
    >
      <span
        className={s.growX}
        style={{
          width: `${left}%`,
          background: `var(--sb-${leftSide}-glow)`,
          boxShadow: `0 0 16px var(--sb-${leftSide}-haze)`,
          ...delay(300),
        }}
      />
      <span
        className={s.growXEnd}
        style={{
          width: `${right}%`,
          background: `var(--sb-${rightSide}-glow)`,
          boxShadow: `0 0 16px var(--sb-${rightSide}-haze)`,
          ...delay(300),
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-y-[-4px] w-[6px] -skew-x-[18deg] bg-white"
        style={{ left: `calc(${left}% - 3px)`, boxShadow: "0 0 10px #fff" }}
      />
    </div>
  );
}

export function WinPredictorStrap({
  state,
  layout,
  strap,
}: {
  state: LiveMatchState;
  layout: LayoutMode;
  strap: ActiveLowerThirdStrap | null;
}) {
  const est = winPredictorFromLive(state);
  const text = textOf(strap ?? { id: "sb-win", type: "win_predictor", title: "" }, state);
  if (!est || !text) return null;
  if (est.kind === "projection") {
    return (
      <Lower state={state} layout={layout} type="win_predictor">
        <BannerStrap
          tag="Projected score"
          tagNeon="cyan"
          edge="cyan"
          title={`${est.low} to ${est.high}`}
          aside={
            <>
              {small("Likely")}
              {big(est.mid)}
            </>
          }
          asideNeon="cyan"
          strip={<Dots items={[text.subtitle, "Estimate"]} />}
        />
      </Lower>
    );
  }
  const bat = batKey(state);
  const bowl = bowlKey(state);
  const batCode = teamCode(state.batting_team_short_name, state.batting_team_name);
  const bowlCode = teamCode(state.bowling_team_short_name, state.bowling_team_name);
  return (
    <Lower state={state} layout={layout} type="win_predictor">
      <div className="flex flex-col items-start">
        <Tag neon="magenta" className={cn(s.inLeft, "ml-6")} style={delay(120)}>
          Win predictor
        </Tag>
        <div
          className={cn(s.glass, s.lift, s.rise, "mt-2 w-[52rem] rounded-[4px] px-8 py-4")}
          style={delay(60)}
        >
          <div className="flex items-end justify-between">
            <span className="flex items-baseline gap-3">
              <span className={cn(s.display, "text-[1.75rem] uppercase")} style={{ color: `var(--sb-${bat}-glow)` }}>
                {batCode}
              </span>
              <span className={s.figures} style={{ fontSize: 48, fontWeight: 800 }}>
                <Num value={est.battingPct} />%
              </span>
            </span>
            <span className={cn(s.label, "pb-2 text-[1rem] text-[color:var(--sb-mist)]")}>
              Need {est.runsNeeded} from {est.ballsLeft} · Estimate
            </span>
            <span className="flex items-baseline gap-3">
              <span className={s.figures} style={{ fontSize: 48, fontWeight: 800 }}>
                <Num value={est.bowlingPct} />%
              </span>
              <span className={cn(s.display, "text-[1.75rem] uppercase")} style={{ color: `var(--sb-${bowl}-glow)` }}>
                {bowlCode}
              </span>
            </span>
          </div>
          <div className="mt-3">
            <TugBar left={est.battingPct} right={est.bowlingPct} leftSide={bat} rightSide={bowl} />
          </div>
        </div>
      </div>
    </Lower>
  );
}

// ---- breaks ------------------------------------------------------------------------

const BREAK_NEON: Record<BreakKind, NeonKey> = {
  drinks: "cyan",
  rain_delay: "cyan",
  timeout: "orange",
  innings_break: "magenta",
  powerplay: "lime",
};

/** Simple original glyphs for the stoppages. */
export function BreakIcon({ kind, size = 56 }: { kind: BreakKind; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "#0b0620",
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "drinks":
      return (
        <svg {...common}>
          <path d="M13 10h22l-3 30H16z" />
          <path d="M14.5 22h19" />
          <path d="M28 4l-3 6" />
        </svg>
      );
    case "rain_delay":
      return (
        <svg {...common}>
          <path d="M14 28a8 8 0 0 1 1-16 11 11 0 0 1 20 3 7 7 0 0 1-1 13z" />
          <path d="M17 34l-2 6M25 34l-2 6M33 34l-2 6" />
        </svg>
      );
    case "timeout":
      return (
        <svg {...common}>
          <circle cx="24" cy="26" r="16" />
          <path d="M24 17v9l6 4M20 6h8" />
        </svg>
      );
    case "innings_break":
      return (
        <svg {...common}>
          <path d="M12 40V12M20 40V12M28 40V12" />
          <path d="M10 12h20" />
          <path d="M36 18l4 4-4 4" />
        </svg>
      );
    case "powerplay":
      return (
        <svg {...common} fill="#0b0620" stroke="none">
          <path d="M27 3L9 27h12l-4 18 22-27H26z" />
        </svg>
      );
  }
}

/** Chevrons that chase each other (the powerplay's motion). */
function Chevrons({ count = 4 }: { count?: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(s.chev, "h-7 w-4 -skew-x-[24deg]")}
          style={{ background: "var(--sb-lime)", boxShadow: "0 0 10px var(--sb-lime)", ...delay(i * 140) }}
        />
      ))}
    </span>
  );
}

export function BreakStrap(p: OverlayElementProps["breakStrap"]) {
  const { state, kind, layout } = p;
  const text = textOf(p.strap ?? { id: `sb-${kind}`, type: kind, title: "" }, state);
  if (!text) return null;
  const neon = BREAK_NEON[kind];
  const tag = breakTag(text, state);
  const score =
    state.total_runs !== null && state.innings_number != null
      ? `${teamCode(state.batting_team_short_name, state.batting_team_name)} ${state.total_runs}/${state.total_wickets ?? 0}`
      : null;
  if (p.variant === "card") {
    return (
      <Lower state={state} layout={layout} type={kind}>
        <BreakCard kind={kind} text={text} score={score} state={state} />
      </Lower>
    );
  }
  return (
    <Lower state={state} layout={layout} type={kind}>
      <BannerStrap
        tag={tag}
        tagNeon={neon}
        edge={neon}
        icon={<BreakIcon kind={kind} size={52} />}
        title={
          kind === "powerplay" ? (
            <span className="flex items-center gap-6">
              {text.title}
              <Chevrons />
            </span>
          ) : (
            text.title
          )
        }
        titleSize={40}
        aside={
          kind === "powerplay" && state.powerplay ? (
            <>
              {small("Overs")}
              {big(`1-${state.powerplay.end_over}`)}
            </>
          ) : score && kind !== "innings_break" ? (
            big(score)
          ) : undefined
        }
        asideNeon={neon}
        strip={
          (kind === "powerplay" ? null : text.subtitle) || text.detail ? (
            <Dots
              items={[kind === "powerplay" ? null : text.subtitle, text.detail].filter(Boolean)}
            />
          ) : undefined
        }
      />
    </Lower>
  );
}

/** A stoppage's tag: its badge when that says more than the title, else the competition. */
export function breakTag(text: StrapText, state: LiveMatchState): string | null {
  if (text.badge && text.badge.toLowerCase() !== text.title.toLowerCase()) {
    return text.badge;
  }
  return state.tournament_name ?? null;
}

/** The stoppage card: a bigger plate with the glyph, the words and the score. */
function BreakCard({
  kind,
  text,
  score,
  state,
}: {
  kind: BreakKind;
  text: StrapText;
  score: string | null;
  state: LiveMatchState;
}) {
  const neon = BREAK_NEON[kind];
  const hazard = kind === "powerplay" || kind === "timeout";
  return (
    <div
      className={cn(s.card, s.rise, "flex w-[64rem] max-w-full overflow-hidden")}
      style={neonStyle(neon)}
    >
      <div
        className={cn(hazard ? s.hazard : s.neon, "relative flex w-[13rem] shrink-0 items-center justify-center")}
        style={
          hazard
            ? ({ "--c1": `var(--sb-${neon})`, "--c2": "#0b0620" } as CSSProperties)
            : neonStyle(neon)
        }
      >
        <span
          className={cn(s.pop, "relative z-10 flex h-28 w-28 items-center justify-center rounded-full")}
          style={{ background: `var(--sb-${neon})`, boxShadow: `0 0 0 6px #0b0620, 0 0 30px var(--sb-${neon})` }}
        >
          <BreakIcon kind={kind} size={64} />
        </span>
      </div>
      <div className="min-w-0 flex-1 px-10 py-7">
        {breakTag(text, state) && (
          <span className={cn(s.label, "block text-[1.125rem]")} style={{ color: `var(--sb-${neon})` }}>
            {breakTag(text, state)}
          </span>
        )}
        <span className={cn(s.display, "mt-2 block truncate text-[3rem] uppercase leading-none")}>
          {text.title}
        </span>
        {(text.subtitle || text.detail) && (
          <span className={cn(s.semi, "mt-3 block truncate text-[1.5rem] font-bold text-[color:var(--sb-mist)]")}>
            {[text.subtitle, text.detail].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      {score && kind !== "innings_break" && kind !== "powerplay" && (
        <div className={cn(s.well, "flex shrink-0 flex-col items-center justify-center px-10")}>
          <span className={cn(s.label, "text-[1rem] text-[color:var(--sb-mist)]")}>Score</span>
          <span className={s.figures} style={{ fontSize: 44, fontWeight: 800 }}>
            {score}
          </span>
        </div>
      )}
      {kind === "powerplay" && state.powerplay && (
        <div className={cn(s.well, "flex shrink-0 flex-col items-center justify-center px-10")}>
          <span className={cn(s.label, "text-[1rem] text-[color:var(--sb-mist)]")}>Overs</span>
          <span className={s.figures} style={{ fontSize: 44, fontWeight: 800 }}>
            1-{state.powerplay.end_over}
          </span>
        </div>
      )}
    </div>
  );
}

// ---- messages ----------------------------------------------------------------------

export function Message(p: OverlayElementProps["message"]) {
  const { state, strap } = p;
  const text = textOf(strap, state);
  if (!text) return null;
  const form = strap.type === "message" ? (strap.form ?? "double") : null;
  if (form === "single") {
    return (
      <Frame
        state={state}
        data-strap-type={strap.type}
        className="fixed z-30"
        style={{ bottom: SAFE_Y, left: SAFE_X, right: SAFE_X }}
      >
        <div className={cn(s.lift, "flex items-stretch")} style={{ height: BUG_ROW }}>
          {text.badge && (
            <div
              style={{ ...neonStyle("magenta"), "--k": "24px" } as CSSProperties}
              className={cn(s.neon, s.slantStart, s.inLeft, s.label, "flex shrink-0 items-center px-10 pr-14 text-[1.5rem]")}
            >
              <span className="relative z-10">{text.badge}</span>
            </div>
          )}
          <div
            style={{ "--k": "24px", marginLeft: text.badge ? -16 : 0, ...delay(80) } as CSSProperties}
            className={cn(s.glass, text.badge ? s.slantEnd : "", s.inLeft, s.edgeBottom, "relative flex min-w-0 flex-1 items-center overflow-hidden px-12")}
          >
            <span className={s.streak} style={delay(500)} />
            <span className={cn(s.display, "relative z-10 truncate text-[2.5rem] uppercase")}>
              {text.title}
            </span>
          </div>
        </div>
      </Frame>
    );
  }
  if (form === "baseline") {
    return (
      <Frame
        state={state}
        data-strap-type={strap.type}
        className="fixed z-30"
        style={{ bottom: 10, left: SAFE_X + 36, right: SAFE_X + 36 }}
      >
        <div
          className={cn(s.glass, s.rise, s.edgeTop, s.semi, "flex h-[2.375rem] items-center gap-4 overflow-hidden rounded-[3px] px-6 text-[1.25rem] font-bold")}
          style={neonStyle("magenta")}
        >
          {text.badge && (
            <span className={cn(s.label, "shrink-0 text-[color:var(--sb-magenta)]")}>
              {text.badge}
            </span>
          )}
          <span className="truncate">{text.title}</span>
        </div>
      </Frame>
    );
  }
  if (form === "double") {
    return (
      <Lower state={state} layout={p.layout} type={strap.type}>
        <div className="flex max-w-[64rem] flex-col items-start">
          {text.badge && (
            <Tag neon="magenta" className={cn(s.inLeft, "ml-6")} style={delay(120)}>
              {text.badge}
            </Tag>
          )}
          <div className={cn(s.card, s.rise, "mt-2 overflow-hidden")} style={{ ...neonStyle("magenta"), ...delay(40) }}>
            <div className="relative overflow-hidden px-9 py-5">
              <span className={s.streak} style={delay(560)} />
              <h3 className={cn(s.display, "relative z-10 text-balance text-[2.25rem] uppercase leading-tight")}>
                {text.title}
              </h3>
            </div>
            {text.subtitle && (
              <p className={cn(s.well, s.semi, "px-9 py-4 text-[1.5rem] font-semibold leading-snug text-[color:var(--sb-mist)]")}>
                {text.subtitle}
              </p>
            )}
          </div>
        </div>
      </Lower>
    );
  }
  // A custom strap or commentary: a banner.
  return (
    <Lower state={state} layout={p.layout} type={strap.type}>
      <BannerStrap
        tag={text.badge || (strap.type === "commentary" ? "Commentary" : "Update")}
        tagNeon="magenta"
        title={text.title}
        titleSize={text.title.length > 40 ? 28 : 36}
        strip={
          text.subtitle || text.detail ? (
            <Dots items={[text.subtitle, text.detail].filter(Boolean)} />
          ) : undefined
        }
      />
    </Lower>
  );
}
