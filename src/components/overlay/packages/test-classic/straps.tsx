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
import { strapText, type StrapText } from "../../strap-views";
import type { ActiveLowerThirdStrap, LayoutMode, LiveMatchState } from "../../types";
import {
  BallTray,
  Crest,
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

/** Bottom edge of the score bug's tab (bottom layout): 54 + 152. */
const BUG_TOP = 206;

/** Where a lower third sits for the score bug's layout. */
export function strapPosition(layout: LayoutMode): CSSProperties {
  if (layout === "top") return { left: SAFE.x, bottom: SAFE.y + 18 };
  if (layout === "compact") return { left: SAFE.x, bottom: 376 };
  return { left: SAFE.x, bottom: BUG_TOP + 20 };
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

/** "Ravi Iyer" -> "RI" in a portrait well. */
export function Portrait({
  name,
  url,
  size = 84,
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
}) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
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
      <span
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ ...NAVY_DEEP, borderRadius: RADIUS - 1 }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="font-bold"
            style={{ fontFamily: SERIF, fontSize: size * 0.36, color: TC.goldText }}
          >
            {initials}
          </span>
        )}
      </span>
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

export type { StrapText };

/** "Crest" for a lower third: the side's crest at strap size. */
export function StrapCrest({
  logo,
  code,
  name,
  colour,
}: {
  logo?: string | null;
  code?: string | null;
  name?: string | null;
  colour?: string;
}) {
  return <Crest logoUrl={logo} code={code} name={name} size={64} colour={colour} />;
}

/** This over in a strap body, on ivory. */
export function OverRow({ tokens, slots }: { tokens: string[]; slots: number }) {
  return (
    <div className="tc-a-fade mt-1 flex items-center gap-5" style={delay(300)}>
      <Label style={{ color: TC.inkMuted }}>This over</Label>
      <BallTray tokens={tokens} slots={slots} size={36} light />
    </div>
  );
}
