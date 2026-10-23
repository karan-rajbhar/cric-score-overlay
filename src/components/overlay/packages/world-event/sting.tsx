"use client";

/**
 * World event's stings: a full-width band in the event's colour for what
 * happened (mint for a four, the magenta accent for a six, red for a
 * wicket, gold for batting milestones), a night band sliding the other
 * way behind it, the figure in a white tile, the title in heavy caps and
 * one light sweep. The entrance runs about two seconds; the card then
 * holds until the producer's timer takes it off.
 */

import { cn } from "~/lib/utils";
import type { OverlayElementProps, StingKind } from "../types";
import { battingAndBowling, scoreText } from "./data";
import { Crest, delay, Root } from "./kit";
import { SAFE } from "../shared/layout";

interface StingLook {
  /** The band's material class. */
  tone: string;
  /** Colour of the figure in its white tile. */
  ink: string;
  figure: string | null;
  label: string;
}

export const STING_LOOK: Record<StingKind, StingLook> = {
  four: { tone: "we-mint", ink: "#0b8f74", figure: "4", label: "Four" },
  six: { tone: "we-accent", ink: "#c3006b", figure: "6", label: "Six" },
  wicket: { tone: "we-red", ink: "#c0121f", figure: "W", label: "Wicket" },
  fifty: { tone: "we-gold", ink: "#9a5a00", figure: "50", label: "Fifty" },
  hundred: { tone: "we-gold", ink: "#9a5a00", figure: "100", label: "Hundred" },
  three_for: { tone: "we-accent", ink: "#6a1fd0", figure: "3W", label: "Three wickets" },
  five_for: { tone: "we-accent", ink: "#6a1fd0", figure: "5W", label: "Five wickets" },
  hat_trick: { tone: "we-red", ink: "#c0121f", figure: "3", label: "Hat-trick" },
  free_hit: { tone: "we-gold", ink: "#9a5a00", figure: "FH", label: "Free hit" },
  milestone: { tone: "we-accent", ink: "#6a1fd0", figure: null, label: "Milestone" },
};

export function WorldEventSting(p: OverlayElementProps["sting"]) {
  const look = STING_LOOK[p.kind] ?? STING_LOOK.milestone;
  const s = p.sting;
  const dark = look.tone === "we-mint" || look.tone === "we-gold";
  const sides = p.state ? battingAndBowling(p.state) : null;
  const eyebrow = look.label.toLowerCase() !== s.title.trim().toLowerCase() ? look.label : null;
  return (
    <Root state={p.state} className="inset-0">
      <div role="status" aria-live="polite" data-sting-type={s.type} data-sting-kind={p.kind} className="absolute inset-x-0 top-[452px] h-[236px]">
        <div className="we-night we-a-slide-l absolute inset-x-0 -top-[22px] h-[236px]" style={{ transform: "skewY(-1.2deg)" }} />
        <div className={cn("we-a-band we-sheen absolute inset-0 overflow-hidden", look.tone)}>
          <span aria-hidden="true" className="we-a-flash absolute inset-0 bg-white" />
          <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[46%] bg-black/10 [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]" />
        </div>
        <div className="relative flex h-full items-center gap-12" style={{ padding: `0 ${SAFE.x}px` }}>
          {look.figure && (
            <span
              className="we-a-zoom we-fig flex h-[196px] min-w-[196px] shrink-0 items-center justify-center bg-white px-6 leading-none shadow-[0_18px_40px_rgba(6,3,30,0.35)]"
              style={{ color: look.ink, fontSize: look.figure.length > 2 ? 104 : 150, ...delay(160) }}
            >
              {look.figure}
            </span>
          )}
          <div className={cn("flex min-w-0 flex-1 flex-col", dark ? "text-[#120a3d]" : "text-white")}>
            {eyebrow && (
              <span className="we-label we-a-rise text-[24px] opacity-85" style={delay(240)}>
                {eyebrow}
              </span>
            )}
            <span className="we-x we-a-slide-r we-trunc text-[112px] leading-[0.95]" style={delay(220)}>
              {s.title}
            </span>
            {(s.subtitle || s.detail) && (
              <span className="we-a-rise mt-2 flex min-w-0 items-baseline gap-6" style={delay(420)}>
                {s.subtitle && <span className="we-name we-trunc text-[44px]">{s.subtitle}</span>}
                {s.detail && <span className="we-fig shrink-0 text-[44px] opacity-90">{s.detail}</span>}
              </span>
            )}
          </div>
          {sides && p.state && p.state.total_runs !== null && (
            <span className="we-night we-a-slide-l flex shrink-0 items-center gap-4 py-3 pl-3 pr-6" style={delay(560)}>
              <Crest n={sides.bat.n} logo={sides.bat.logo} code={sides.bat.code} name={sides.bat.name} size={64} />
              <span className="flex flex-col">
                <span className="we-x text-[24px]">{sides.bat.code}</span>
                <span className="we-fig text-[44px] leading-none">{scoreText(p.state.total_runs, p.state.total_wickets)}</span>
              </span>
            </span>
          )}
        </div>
      </div>
    </Root>
  );
}
