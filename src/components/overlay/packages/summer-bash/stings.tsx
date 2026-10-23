"use client";

/**
 * Summer bash stings: a full-frame burst for each event. A flash, light
 * rays that burst out and keep turning, shock rings, speed streaks and
 * sparks behind a giant word that slams in from the camera, then a plate
 * with who and what. Wickets light three stumps that flash red and catch
 * fire; milestones rain confetti round a numeral badge; a free hit runs
 * hazard stripes. About two and a half seconds of action, then it holds
 * until the stage takes it off. Words come from the sting itself.
 */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "~/lib/utils";
import { teamCode } from "../../overlay-kit";
import type { LiveMatchState } from "../../types";
import type { OverlayElementProps, StingKind } from "../types";
import { delay, Frame, neonStyle, s, sideOfName, sideStyle, type NeonKey, type SideKey } from "./kit";

interface Look {
  a: NeonKey;
  b: NeonKey;
  rings: number;
  sparks: number;
  confetti: boolean;
  /** Base word size in px (shrunk for long words). */
  size: number;
}

const LOOK: Record<StingKind, Look> = {
  four: { a: "cyan", b: "lime", rings: 1, sparks: 14, confetti: false, size: 250 },
  six: { a: "magenta", b: "yellow", rings: 3, sparks: 20, confetti: false, size: 330 },
  wicket: { a: "red", b: "orange", rings: 2, sparks: 12, confetti: false, size: 220 },
  fifty: { a: "yellow", b: "magenta", rings: 2, sparks: 16, confetti: true, size: 220 },
  hundred: { a: "yellow", b: "magenta", rings: 3, sparks: 20, confetti: true, size: 220 },
  three_for: { a: "yellow", b: "cyan", rings: 2, sparks: 16, confetti: true, size: 200 },
  five_for: { a: "yellow", b: "cyan", rings: 3, sparks: 20, confetti: true, size: 200 },
  hat_trick: { a: "yellow", b: "red", rings: 3, sparks: 20, confetti: true, size: 200 },
  free_hit: { a: "orange", b: "yellow", rings: 1, sparks: 10, confetti: false, size: 220 },
  milestone: { a: "yellow", b: "magenta", rings: 2, sparks: 14, confetti: true, size: 200 },
};

/** The numeral on a milestone's badge (what the kind itself means). */
const BADGE: Partial<Record<StingKind, string>> = {
  fifty: "50",
  hundred: "100",
  three_for: "3W",
  five_for: "5W",
  hat_trick: "3 in 3",
};

/** The word's size: long words step down to fit the frame. */
export function wordSize(word: string, base: number): number {
  const fit = Math.floor(1600 / (Math.max(1, word.length) * 0.92));
  return Math.max(96, Math.min(base, fit));
}

const hex = (n: NeonKey) => `var(--sb-${n})`;

/** The side the event belongs to: the batting side, or the bowling side for wickets. */
function sideFor(state: LiveMatchState | null, kind: StingKind): SideKey {
  if (!state) return kind === "wicket" ? "bowl" : "bat";
  const bowling =
    kind === "wicket" ||
    kind === "three_for" ||
    kind === "five_for" ||
    kind === "hat_trick";
  const name = bowling ? state.bowling_team_name : state.batting_team_name;
  return sideOfName(state, name) ?? (bowling ? "bowl" : "bat");
}

function codeFor(state: LiveMatchState | null, side: SideKey): string | null {
  if (!state) return null;
  if (side === "t1") return teamCode(state.team1_short_name, state.team1_name);
  if (side === "t2") return teamCode(state.team2_short_name, state.team2_name);
  return null;
}

function Sparks({ count, look }: { count: number; look: Look }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i * 360) / count + ((i * 37) % 13);
        const reach = 420 + ((i * 53) % 260);
        return (
          <span
            key={i}
            className={s.spark}
            style={
              {
                "--a": `${angle}deg`,
                "--r": `${reach}px`,
                "--w": `${26 + ((i * 17) % 30)}px`,
                "--c": hex(i % 2 ? look.a : look.b),
                ...delay(140 + (i % 5) * 40),
              } as CSSProperties
            }
          />
        );
      })}
    </>
  );
}

function Confetti({ look }: { look: Look }) {
  const colours: NeonKey[] = [look.a, look.b, "cyan", "lime", "magenta"];
  return (
    <>
      {Array.from({ length: 44 }, (_, i) => (
        <span
          key={i}
          className={s.confetti}
          style={
            {
              "--x": `${(i * 211) % 100}%`,
              "--dx": `${((i * 97) % 240) - 120}px`,
              "--rot": `${360 + ((i * 131) % 540)}deg`,
              "--t": `${2200 + ((i * 173) % 1400)}ms`,
              "--c": hex(colours[i % colours.length]!),
              width: 10 + (i % 3) * 5,
              height: 18 + (i % 4) * 5,
              ...delay(200 + ((i * 89) % 900)),
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

function Streaks({ look }: { look: Look }) {
  const rows = [
    { top: "38%", h: 10, d: 120, c: look.a },
    { top: "46%", h: 4, d: 220, c: "white" as const },
    { top: "58%", h: 14, d: 60, c: look.b },
    { top: "66%", h: 5, d: 300, c: look.a },
  ];
  return (
    <>
      {rows.map((r, i) => (
        <span
          key={i}
          className={s.speed}
          style={
            {
              top: r.top,
              "--h": `${r.h}px`,
              "--c": r.c === "white" ? "#ffffff" : hex(r.c),
              ...delay(r.d),
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/** Three stumps that flash red, lose their bails and burn. */
function Stumps() {
  const centres = [19, 61, 103];
  return (
    <div
      aria-hidden="true"
      className={cn(s.pop, "relative mb-6 flex h-[10.5rem] items-end gap-5 px-2")}
      style={delay(80)}
    >
      {centres.map((c, i) => (
        <span key={`f${i}`} className={s.flame} style={{ left: c - 32, ...delay(650 + i * 90) }} />
      ))}
      {centres.map((c) => (
        <span key={c} className={cn(s.stump, "relative z-10 h-full")} />
      ))}
      <span className={s.bail} style={{ left: 4, "--bx": "-90px", "--br": "-70deg" } as CSSProperties} />
      <span className={s.bail} style={{ left: 60, "--bx": "100px", "--br": "80deg" } as CSSProperties} />
    </div>
  );
}

/** A starburst badge with the milestone's numeral. */
function Badge({ text, look }: { text: string; look: Look }) {
  const points = Array.from({ length: 32 }, (_, i) => {
    const r = i % 2 ? 40 : 50;
    const a = (i * Math.PI) / 16;
    return `${50 + r * Math.cos(a)}% ${50 + r * Math.sin(a)}%`;
  }).join(", ");
  return (
    <div className={cn(s.pop, "relative mb-2 h-[13rem] w-[13rem]")} style={delay(60)}>
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          clipPath: `polygon(${points})`,
          background: `radial-gradient(circle at 40% 35%, #fff7b8, ${hex(look.a)} 55%, #e0a800)`,
          filter: `drop-shadow(0 0 30px ${hex(look.a)})`,
        }}
      />
      <span
        className={cn(s.figures, "absolute inset-0 flex items-center justify-center text-[color:var(--sb-ink)]")}
        style={{ fontSize: text.length > 3 ? 46 : text.length > 2 ? 64 : 82, fontWeight: 900 }}
      >
        {text}
      </span>
    </div>
  );
}

function Hazard({ top }: { top: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(s.hazard, s.rise, "absolute inset-x-0 h-9")}
      style={
        {
          [top ? "top" : "bottom"]: 0,
          "--c1": "var(--sb-orange)",
          "--c2": "#0b0620",
          boxShadow: "0 0 24px var(--sb-orange-haze)",
          ...delay(top ? 0 : 80),
        } as CSSProperties
      }
    />
  );
}

/** The plate under the word: who, and the figure. */
function Plate({
  side,
  code,
  title,
  detail,
  neon,
}: {
  side: SideKey;
  code: string | null;
  title?: ReactNode;
  detail?: ReactNode;
  neon: NeonKey;
}) {
  if (!title && !detail) return null;
  return (
    <div className={cn(s.lift, s.rise, "mt-6 flex items-stretch")} style={{ ...sideStyle(side), height: 84, ...delay(620) }}>
      {code && (
        <span
          style={{ "--k": "24px" } as CSSProperties}
          className={cn(s.team, s.slant, "flex items-center px-10")}
        >
          <span className={cn(s.display, "relative z-10 text-[2.25rem]")}>{code}</span>
        </span>
      )}
      {title && (
        <span
          style={{ "--k": "24px", marginLeft: code ? -16 : 0 } as CSSProperties}
          className={cn(s.glass, s.slant, "flex max-w-[56rem] items-center overflow-hidden px-12")}
        >
          <span className={s.streak} style={delay(1300)} />
          <span className={cn(s.display, "relative z-10 truncate text-[2.5rem] uppercase")}>{title}</span>
        </span>
      )}
      {detail && (
        <span
          style={{ ...neonStyle(neon), "--k": "24px", marginLeft: -16 } as CSSProperties}
          className={cn(s.neon, s.slant, "flex items-center px-11")}
        >
          <span className={cn(s.figures, "relative z-10 whitespace-nowrap text-[2.125rem]")} style={{ fontWeight: 800 }}>
            {detail}
          </span>
        </span>
      )}
    </div>
  );
}

export function SummerBashSting(p: OverlayElementProps["sting"]) {
  const { sting, kind, state } = p;
  const look = LOOK[kind] ?? LOOK.four;
  const side = sideFor(state, kind);
  const code = codeFor(state, side);
  const word = sting.title.toUpperCase();
  const size = wordSize(word, look.size);
  const badge = BADGE[kind];
  const free = kind === "free_hit";
  const freeDetail =
    free && !sting.detail ? "No dismissals except run out" : sting.detail;
  return (
    <Frame
      state={state}
      className="fixed inset-0 z-50 overflow-hidden"
      style={
        {
          "--burst-a": hex(look.a),
          "--burst-b": hex(look.b),
        } as CSSProperties
      }
    >
      <div
        role="status"
        aria-live="polite"
        data-sting-type={sting.type}
        data-sting-kind={kind}
        className="absolute inset-0"
      >
        {/* A night vignette so the burst reads over a bright ground. */}
        <span
          aria-hidden="true"
          className={cn(s.rise, "absolute inset-0")}
          style={{
            background:
              "radial-gradient(ellipse 62% 56% at 50% 50%, rgba(11,6,32,0.78) 0%, rgba(11,6,32,0.5) 45%, rgba(11,6,32,0) 78%)",
          }}
        />
        <span aria-hidden="true" className={s.flash} />
        <div aria-hidden="true" className="absolute inset-0" style={{ top: -60 }}>
          <span className={s.burst}>
            <span className={s.rays} />
            <span className={cn(s.rays, s.raysAlt)} />
          </span>
          {Array.from({ length: look.rings }, (_, i) => (
            <span key={i} className={s.ring} style={{ ...delay(i * 240), borderColor: hex(i % 2 ? look.b : look.a) }} />
          ))}
          <Sparks count={look.sparks} look={look} />
        </div>
        <div aria-hidden="true" className="absolute inset-0">
          <Streaks look={look} />
          {look.confetti && <Confetti look={look} />}
        </div>
        {free && (
          <>
            <Hazard top />
            <Hazard top={false} />
          </>
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center pb-[6rem]">
          {kind === "wicket" && <Stumps />}
          {badge && <Badge text={badge} look={look} />}
          <h2
            className={cn(s.display, s.slam, "relative whitespace-nowrap leading-[0.92]")}
            style={{
              fontSize: size,
              fontWeight: 900,
              color: "#fff",
              textShadow: `0 ${Math.round(size * 0.035)}px 0 #0b0620, ${-Math.round(size * 0.04)}px 0 0 ${hex(look.b)}, ${Math.round(size * 0.04)}px 0 0 ${hex(look.a)}, 0 0 ${Math.round(size * 0.3)}px ${hex(look.a)}`,
            }}
          >
            <span className="inline-block -skew-x-[8deg]">{word}</span>
          </h2>
          <Plate
            side={side}
            code={free ? null : code}
            title={free ? sting.subtitle : sting.subtitle}
            detail={freeDetail}
            neon={look.a}
          />
        </div>
      </div>
    </Frame>
  );
}
