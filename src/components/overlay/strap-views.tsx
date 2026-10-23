"use client";

/**
 * Lower thirds' text and visuals (the Standard package's strap elements):
 * each type's wording from the live score, and the strap, single-line,
 * title-and-text and baseline shapes. Pure: `lower-third-straps.tsx`
 * decides what is on air and for how long.
 */

import { formatDismissalType } from "~/lib/cricket";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import {
  economyText,
  OV,
  OverlayFrame,
  oversText,
  strikeRateText,
  type OverlayThemeProps,
} from "./overlay-kit";
import type {
  ActiveLowerThirdStrap,
  LayoutMode,
  LiveMatchState,
  LowerThirdStrapType,
} from "./types";

export interface StrapText {
  badge: string;
  title: string;
  subtitle: string;
  detail: string;
}

const join = (...parts: (string | null | undefined | false)[]) =>
  parts.filter(Boolean).join(" · ");

/** Each strap type's text from the live score; null when it has no data. */
const STRAP_DEFAULTS: Partial<
  Record<LowerThirdStrapType, (state: LiveMatchState) => StrapText | null>
> = {
  batsman: (s) =>
    s.striker_name
      ? {
          badge: "Batting",
          title: s.striker_name,
          subtitle: `${s.striker_runs ?? 0} off ${s.striker_balls ?? 0} balls`,
          detail: join(
            s.striker_fours !== undefined &&
              s.striker_fours !== null &&
              `4s ${s.striker_fours}`,
            s.striker_sixes !== undefined &&
              s.striker_sixes !== null &&
              `6s ${s.striker_sixes}`,
            strikeRateText(s.striker_runs, s.striker_balls) &&
              `SR ${strikeRateText(s.striker_runs, s.striker_balls)}`,
          ),
        }
      : null,
  bowler: (s) =>
    s.current_bowler_name
      ? {
          badge: "Bowling",
          title: s.current_bowler_name,
          subtitle: `${s.bowler_wickets ?? 0}-${s.bowler_runs ?? 0} off ${oversText(s.bowler_balls)} overs`,
          detail: join(
            s.bowler_maidens !== undefined &&
              s.bowler_maidens !== null &&
              `Maidens ${s.bowler_maidens}`,
            economyText(s.bowler_runs, s.bowler_balls) &&
              `Econ ${economyText(s.bowler_runs, s.bowler_balls)}`,
          ),
        }
      : null,
  partnership: (s) =>
    s.partnership_runs !== null && s.striker_name && s.non_striker_name
      ? {
          badge: "Partnership",
          title: `${s.partnership_runs} off ${s.partnership_balls ?? 0} balls`,
          subtitle: `${s.striker_name} and ${s.non_striker_name}`,
          detail: "",
        }
      : null,
  target: (s) =>
    s.target_runs !== null && s.runs_needed !== null
      ? {
          badge: "Chase",
          title: `Need ${s.runs_needed} from ${s.balls_remaining ?? 0} balls`,
          subtitle: `Target ${s.target_runs}`,
          detail: join(
            s.required_run_rate !== null &&
              `RRR ${s.required_run_rate.toFixed(2)}`,
            s.current_run_rate !== null &&
              `CRR ${s.current_run_rate.toFixed(2)}`,
          ),
        }
      : null,
  powerplay: (s) =>
    s.powerplay
      ? {
          badge: "Powerplay",
          title: "Fielding restrictions",
          subtitle: `Overs 1 to ${s.powerplay.end_over}`,
          detail: "",
        }
      : null,
  last_wicket: (s) => {
    const w = s.last_wicket;
    if (!w?.name) return null;
    return {
      badge: "Last wicket",
      title: w.name,
      subtitle: `${w.runs} off ${w.balls} balls`,
      detail: join(
        w.dismissal_type && formatDismissalType(w.dismissal_type),
        w.bowler_name && `b ${w.bowler_name}`,
        `${w.score}/${w.wicket_number}`,
      ),
    };
  },
  win_predictor: (s) => {
    const est = winPredictorFromLive(s);
    if (!est) return null;
    if (est.kind === "projection") {
      return {
        badge: "Projected score",
        title: `${est.low} to ${est.high}`,
        subtitle: `${s.batting_team_name ?? "Batting side"} at this rate and wickets`,
        detail: "Estimate",
      };
    }
    return {
      badge: "Win predictor",
      title: `${s.batting_team_short_name ?? s.batting_team_name ?? "Batting"} ${est.battingPct}% · ${s.bowling_team_short_name ?? s.bowling_team_name ?? "Bowling"} ${est.bowlingPct}%`,
      subtitle: `Need ${est.runsNeeded} from ${est.ballsLeft} balls`,
      detail: "Estimate",
    };
  },
  commentary: (s) =>
    s.last_ball_commentary
      ? {
          badge: "Commentary",
          title: s.last_ball_commentary,
          subtitle: "",
          detail: "",
        }
      : null,
  drinks: (s) => ({
    badge: "Drinks",
    title: "Drinks break",
    subtitle:
      s.total_runs !== null
        ? `${s.batting_team_short_name ?? s.batting_team_name ?? ""} ${s.total_runs}/${s.total_wickets ?? 0}`.trim()
        : "",
    detail: "",
  }),
  timeout: () => ({
    badge: "Timeout",
    title: "Strategic timeout",
    subtitle: "Play resumes shortly",
    detail: "",
  }),
  rain_delay: () => ({
    badge: "Weather",
    title: "Rain stopped play",
    subtitle: "Play resumes when it is fit",
    detail: "",
  }),
  innings_break: (s) => ({
    badge: "Innings break",
    title: "Innings break",
    subtitle:
      s.target_runs !== null
        ? `Target ${s.target_runs}`
        : s.innings_completed && s.total_runs !== null
          ? `Target ${s.total_runs + 1}`
          : "",
    detail: "",
  }),
};

/** Whether a strap type has what it needs to show (custom text always does). */
export function strapAvailable(
  type: LowerThirdStrapType,
  state: LiveMatchState,
): boolean {
  if (type === "none") return false;
  const make = STRAP_DEFAULTS[type];
  return make ? make(state) !== null : true;
}

/** The strap's text: what the producer set, else its type's default. */
export function strapText(
  strap: ActiveLowerThirdStrap,
  state: LiveMatchState,
): StrapText | null {
  if (strap.type === "custom" || strap.type === "message") {
    return {
      badge: strap.badge ?? "",
      title: strap.title || strap.customText || "",
      subtitle: strap.subtitle || (strap.title ? (strap.customText ?? "") : ""),
      detail: strap.detail ?? "",
    };
  }
  const defaults = STRAP_DEFAULTS[strap.type]?.(state) ?? null;
  if (!defaults && !strap.title) return null;
  return {
    badge: strap.badge ?? defaults?.badge ?? "",
    title: strap.title || defaults?.title || "",
    subtitle: strap.subtitle || defaults?.subtitle || "",
    detail: strap.detail || defaults?.detail || "",
  };
}

const POSITION_CLASS: Partial<Record<LayoutMode, string>> = {
  top: "top-[7rem] left-1/2 -translate-x-1/2",
  compact: "bottom-[19rem] left-12",
};

export function Strap({ text }: { text: StrapText }) {
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-lg",
        OV.bar,
        OV.shadow,
      )}
    >
      {text.badge && (
        <div
          className={cn(
            "flex max-w-[16rem] shrink-0 items-center px-5 text-lg font-semibold",
            OV.accent,
          )}
        >
          <span className="truncate">{text.badge}</span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center px-6 py-3">
        <h3 className="truncate text-[1.75rem] font-semibold leading-tight">
          {text.title}
        </h3>
        {text.subtitle && (
          <p
            className={cn(
              "truncate text-lg tabular-nums leading-tight",
              OV.barMuted,
            )}
          >
            {text.subtitle}
          </p>
        )}
      </div>
      {text.detail && (
        <div
          className={cn(
            "flex max-w-[20rem] shrink-0 items-center px-6 text-lg tabular-nums",
            OV.panel,
          )}
        >
          <span className="truncate">{text.detail}</span>
        </div>
      )}
    </div>
  );
}

/** A "single" message: one line where the score bar sits. */
export function SingleLine({ text }: { text: StrapText }) {
  return (
    <div
      className={cn(
        "flex h-[5.5rem] items-center gap-6 overflow-hidden rounded-lg px-8",
        OV.bar,
        OV.shadow,
      )}
    >
      {text.badge && (
        <span
          className={cn(
            "shrink-0 rounded px-3 py-1 text-lg font-semibold",
            OV.accent,
          )}
        >
          {text.badge}
        </span>
      )}
      <span className="truncate text-[2rem] font-semibold">{text.title}</span>
    </div>
  );
}

/** A "double" message: a title and body card. */
export function DoubleCard({ text }: { text: StrapText }) {
  return (
    <div className={cn("overflow-hidden rounded-lg", OV.shadow)}>
      <div className={cn("px-7 py-4", OV.bar)}>
        {text.badge && (
          <p className={cn("text-base font-medium", OV.barMuted)}>
            {text.badge}
          </p>
        )}
        <h3 className="text-balance text-[2rem] font-semibold leading-tight">
          {text.title}
        </h3>
      </div>
      {text.subtitle && (
        <p className={cn("px-7 py-4 text-[1.375rem] leading-snug", OV.card)}>
          {text.subtitle}
        </p>
      )}
    </div>
  );
}

/** A "baseline" message: a thin line along the bottom, the score stays. */
export function Baseline({ text }: { text: StrapText }) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-4 rounded-md px-5 text-lg",
        OV.panel,
        OV.shadow,
      )}
    >
      {text.badge && <span className="font-semibold">{text.badge}</span>}
      <span className="truncate">{text.title}</span>
    </div>
  );
}


/** A lower third as the Standard package draws it, placed for the layout. */
export function StrapView({
  strap,
  state,
  layout,
  theme,
  customColors,
}: OverlayThemeProps & {
  strap: ActiveLowerThirdStrap;
  state: LiveMatchState;
  layout: LayoutMode;
}) {
  const text = strapText(strap, state);
  if (!text || !text.title) return null;

  const form = strap.type === "message" ? (strap.form ?? "double") : null;
  const position =
    form === "single"
      ? "bottom-[40px] left-1/2 w-[calc(100%-6rem)] max-w-[110rem] -translate-x-1/2"
      : form === "baseline"
        ? "bottom-2 left-1/2 w-[calc(100%-6rem)] max-w-[110rem] -translate-x-1/2"
        : cn(
            "w-full max-w-[64rem] px-12",
            POSITION_CLASS[layout] ??
              "bottom-[11.5rem] left-1/2 -translate-x-1/2",
          );

  return (
    <OverlayFrame
      state={state}
      theme={theme}
      customColors={customColors}
      data-strap-type={strap.type}
      className={cn(
        "pointer-events-none fixed z-30 duration-300 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none",
        position,
      )}
    >
      {form === "single" ? (
        <SingleLine text={text} />
      ) : form === "baseline" ? (
        <Baseline text={text} />
      ) : form === "double" ? (
        <DoubleCard text={text} />
      ) : (
        <Strap text={text} />
      )}
    </OverlayFrame>
  );
}
