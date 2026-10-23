"use client";

/**
 * Test classic lower thirds: the name strap (a navy head with the name in
 * the serif and the headline figure, a gold rule, an ivory row of
 * figures), set left on the title-safe line above the score bug. The
 * batter, bowler, new batter / bowler, partnership, chase, end of over,
 * estimates, stoppages, messages, profiles and the player of the match
 * all use it.
 */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { ActiveLowerThirdStrap, LayoutMode, LiveMatchState } from "../../types";
import { AvatarSlot, lowerThirdAnchor, strapText, type OverBall } from "../shared";
import {
  BallTray,
  delay,
  DROP_FILTER,
  Fig,
  FIGS,
  GoldRule,
  IVORY,
  Label,
  NAVY,
  NAVY_DEEP,
  RADIUS,
  SAFE,
  SERIF,
  Stripe,
  TC,
  TcRoot,
} from "./kit";

/** The bottom score bug's height: tab 38, bar 76, strip 40. */
export const BUG_HEIGHT = 154;

/** The compact bug's height (a corner card). */
const COMPACT_HEIGHT = 302;

/**
 * Where a lower third sits for the score bug's layout: above the bug at
 * the bottom or in the corner; at the foot of the screen when the bug is
 * at the top.
 */
export function strapPosition(layout: LayoutMode): CSSProperties {
  if (layout === "top") return { left: SAFE.x, bottom: SAFE.y + 18 };
  if (layout === "compact") return lowerThirdAnchor(COMPACT_HEIGHT, 20);
  return lowerThirdAnchor(BUG_HEIGHT, 20);
}

export interface Cell {
  label: string;
  value: ReactNode;
}

/** A row of figures on ivory: tracked label, figure, hairline between. */
export function Cells({ cells, d = 360 }: { cells: Cell[]; d?: number }) {
  return (
    <dl className="flex min-w-0 items-stretch">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className="tc-a-rise flex min-w-0 items-baseline gap-3 px-6 first:pl-0"
          style={{
            borderLeft: i > 0 ? `1px solid ${TC.ivoryLine}` : undefined,
            ...delay(d + i * 70),
          }}
        >
          <dt>
            <Label style={{ color: TC.inkMuted }}>{c.label}</Label>
          </dt>
          <dd
            className="truncate text-[1.625rem] font-semibold leading-none"
            style={{ ...FIGS, color: TC.ink }}
          >
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The name strap. `side` colours the stripe (1 / 2: the team's colour;
 * "claret" for a wicket); `lead` is a crest or a portrait.
 */
export function NameStrap({
  label,
  name,
  headline,
  headlineNote,
  cells,
  sub,
  stripe,
  lead,
  layout,
  width = 1040,
  testId,
  children,
}: {
  label: ReactNode;
  name: ReactNode;
  headline?: ReactNode;
  headlineNote?: ReactNode;
  cells?: Cell[];
  sub?: ReactNode;
  stripe?: string;
  lead?: ReactNode;
  layout: LayoutMode;
  width?: number;
  testId?: string;
  children?: ReactNode;
}) {
  const hasBody = (cells && cells.length > 0) || sub || children;
  return (
    <TcRoot
      data-strap-type={testId}
      className="fixed z-30"
      style={{ ...strapPosition(layout), width, filter: DROP_FILTER }}
    >
      <div className="overflow-hidden" style={{ borderRadius: RADIUS }}>
        <div className="tc-a-wipe flex items-stretch" style={NAVY}>
          {stripe && <Stripe colour={stripe} />}
          <div className="flex min-w-0 flex-1 items-center gap-5 px-7 py-4">
            {lead}
            <div className="min-w-0 flex-1">
              <Label
                className="tc-a-fade block truncate"
                style={{ color: TC.goldText, ...delay(180) }}
              >
                {label}
              </Label>
              <div
                className="tc-a-rise mt-2.5 truncate text-[2.5rem] font-bold leading-[1.1]"
                style={{ fontFamily: SERIF, ...delay(120) }}
              >
                {name}
              </div>
            </div>
            {headline !== undefined && headline !== null && (
              <div className="tc-a-fade flex shrink-0 flex-col items-end gap-1.5" style={delay(260)}>
                <Fig className="text-[2.75rem]" style={{ color: TC.ivoryHi }}>
                  {headline}
                </Fig>
                {headlineNote && (
                  <span
                    className="text-[1.125rem] font-medium leading-none"
                    style={{ color: "rgba(243,236,218,0.75)", ...FIGS }}
                  >
                    {headlineNote}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <GoldRule d={140} sheen />
        {hasBody && (
          <div className="tc-a-wipe px-7 py-3.5" style={{ ...IVORY, ...delay(220) }}>
            {cells && cells.length > 0 && <Cells cells={cells} />}
            {sub && (
              <p
                className={cn(
                  "tc-a-fade truncate text-[1.375rem] font-medium leading-snug",
                  cells?.length ? "mt-2" : "",
                )}
                style={{ color: TC.ink, ...FIGS, ...delay(380) }}
              >
                {sub}
              </p>
            )}
            {children}
          </div>
        )}
      </div>
    </TcRoot>
  );
}

/** The batting side's stripe colour (1 / 2), the other for the bowler. */
export function sideColour(state: LiveMatchState, batting: boolean): string {
  const bat = state.batting_team_name;
  const side =
    bat && bat === state.team2_name && bat !== state.team1_name ? 2 : 1;
  const which = batting ? side : side === 1 ? 2 : 1;
  return which === 2 ? "var(--tc-team2)" : "var(--tc-team1)";
}

/** A player's photo in a gilt frame, their initials when the match has none. */
export function Portrait({
  name,
  url,
  size = 84,
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 p-[2px]"
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS,
        background:
          "linear-gradient(135deg, #8a6a28, #f2dea0 40%, #b48d3c 70%, #e6cb84)",
      }}
    >
      <AvatarSlot
        url={url}
        name={name}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ ...NAVY_DEEP, borderRadius: RADIUS - 1 }}
        imgClassName="h-full w-full object-cover"
        textClassName="font-bold"
        textStyle={{ fontFamily: SERIF, fontSize: size * 0.36, color: TC.goldText }}
      />
    </span>
  );
}

/**
 * A producer's strap in the package's shape: its badge, title and line
 * from `strapText` (the type's wording from the score when it has none).
 */
export function TextStrap({
  strap,
  state,
  layout,
  headline,
  cells,
  stripe,
  children,
}: {
  strap: ActiveLowerThirdStrap;
  state: LiveMatchState;
  layout: LayoutMode;
  headline?: ReactNode;
  cells?: Cell[];
  stripe?: string;
  children?: ReactNode;
}) {
  const text = strapText(strap, state);
  if (!text || !text.title) return null;
  return (
    <NameStrap
      testId={strap.type}
      layout={layout}
      label={text.badge || " "}
      name={text.title}
      headline={headline}
      cells={cells}
      sub={[text.subtitle, text.detail].filter(Boolean).join(" · ") || undefined}
      stripe={stripe}
    >
      {children}
    </NameStrap>
  );
}

/** This over in a strap body, on ivory. */
export function OverRow({ balls, ballsPerOver }: { balls: OverBall[]; ballsPerOver: number }) {
  return (
    <div className="tc-a-fade mt-1 flex items-center gap-5" style={delay(300)}>
      <Label style={{ color: TC.inkMuted }}>This over</Label>
      <BallTray balls={balls} ballsPerOver={ballsPerOver} size={36} light />
    </div>
  );
}
