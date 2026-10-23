"use client";

/**
 * Hundred-ball player profile (career or this tournament), the corner
 * sponsors and the ticker.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "~/lib/utils";
import { usePlayerProfile } from "../../overlay-data";
import { playerInSlot } from "../../profile-card";
import type { OverlayElementProps } from "../types";
import { Caption, SideBlock, sidesWithTones } from "./common";
import {
  Block,
  deepOf,
  Fig,
  HERO_H,
  Label,
  lowerAnchor,
  Name,
  Reveal,
  Root,
  SAFE,
  Slab,
  styles,
  Tab,
  Text,
} from "./kit";

interface Stat {
  label: string;
  value: string | number;
}

const fixed = (n: number | null | undefined, digits: number) =>
  n !== null && n !== undefined && n > 0 ? n.toFixed(digits) : null;

export function HundredPlayerProfile(p: OverlayElementProps["playerProfile"]) {
  const { state, slot, mode, profile: given, snapshots } = p;
  const who = playerInSlot(state, slot);
  const read = usePlayerProfile(
    state,
    mode === "career" && given === undefined ? who.id : null,
    mode === "career",
  );
  if (!who.name) return null;
  const sides = sidesWithTones(state);
  const side = who.bowler ? sides.bowling : sides.batting;
  let stats: Stat[] = [];
  let sub: string;
  if (mode === "career") {
    const profile = given ?? read.profile;
    const loaded = given !== undefined || read.loaded;
    const c = profile?.career;
    if (!loaded || !c) return null;
    sub = `${c.total_matches ?? 0} ${c.total_matches === 1 ? "match" : "matches"} · career`;
    stats = who.bowler
      ? [
          { label: "Wickets", value: c.total_wickets ?? 0 },
          ...(fixed(c.economy_rate, 2) ? [{ label: "Economy", value: fixed(c.economy_rate, 2)! }] : []),
          ...(c.best_bowling_figures ? [{ label: "Best", value: c.best_bowling_figures }] : []),
        ]
      : [
          { label: "Runs", value: c.total_runs ?? 0 },
          ...(fixed(c.strike_rate, 1) ? [{ label: "Strike rate", value: fixed(c.strike_rate, 1)! }] : []),
          ...(c.highest_score ? [{ label: "Best", value: c.highest_score }] : []),
        ];
  } else {
    const f = who.id ? snapshots?.series?.[who.id] : null;
    if (!f) return null;
    sub = `${f.matches} ${f.matches === 1 ? "match" : "matches"} · ${state.tournament_name ?? "this tournament"}`;
    stats = who.bowler
      ? [
          ...(f.wickets !== null && f.wickets !== undefined ? [{ label: "Wickets", value: f.wickets }] : []),
          ...(fixed(f.economy, 2) ? [{ label: "Economy", value: fixed(f.economy, 2)! }] : []),
          ...(f.best ? [{ label: "Best", value: f.best }] : []),
        ]
      : [
          ...(f.runs !== null && f.runs !== undefined ? [{ label: "Runs", value: f.runs }] : []),
          ...(fixed(f.strikeRate, 1) ? [{ label: "Strike rate", value: fixed(f.strikeRate, 1)! }] : []),
          ...(f.highest ? [{ label: "Best", value: f.highest }] : []),
        ];
  }
  const anchor = lowerAnchor(p.layout);
  const fromRight = anchor.from === "right";
  const enter = fromRight ? "wipeLeft" : anchor.from === "left" ? "wipeRight" : "wipeUp";
  return (
    <Root
      data-testid="hb-profile"
      data-mode={mode}
      style={anchor.style}
      className={cn("flex flex-col gap-2", fromRight ? "items-end" : "items-start")}
    >
      <Tab tone="volt" cut={fromRight ? "left" : "right"} enter={enter} delay={220}>
        <Label size={22}>{mode === "career" ? "Career" : "This tournament"}</Label>
      </Tab>
      <Slab deep={deepOf(side.tone)} column cut={fromRight ? "left" : "right"} enter={enter} style={{ width: 800 }}>
        <div className="flex" style={{ gap: 6 }}>
          <SideBlock tone={side.tone} logo={side.logo} code={side.code} width={112} delay={120} />
          <Block tone="paper" className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-7" style={{ height: HERO_H }}>
            <Reveal delay={160}>
              <Name size={44}>{who.name}</Name>
            </Reveal>
            <Reveal delay={220}>
              <Caption color="var(--hb-paper-muted)" size={24}>
                {sub}
              </Caption>
            </Reveal>
          </Block>
        </div>
        {stats.length > 0 && (
          <div className="flex" style={{ gap: 6 }}>
            {stats.map((s, i) => (
              <Block key={s.label} tone={i === 0 ? "ink" : "ink2"} className="flex min-w-0 flex-1 flex-col justify-between px-7 py-4" style={{ height: 116 }}>
                <Label color="var(--hb-volt)">{s.label}</Label>
                <Reveal delay={280 + i * 70}>
                  <Fig value={s.value} size={56} roll={false} />
                </Reveal>
              </Block>
            ))}
          </div>
        )}
      </Slab>
    </Root>
  );
}

/** One sponsor at a time, every `intervalSecs` (at least 5). */
function useRotation(count: number, intervalSecs = 20) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), Math.max(intervalSecs, 5) * 1000);
    return () => clearInterval(t);
  }, [count, intervalSecs]);
  return count ? index % count : 0;
}

export function HundredSponsors(p: OverlayElementProps["sponsors"]) {
  const { sponsors, title } = p;
  const index = useRotation(sponsors.length);
  if (!title && !sponsors.length) return null;
  const sponsor = sponsors.length ? sponsors[index]! : null;
  return (
    <Root data-testid="hb-sponsors" className="flex flex-col items-end gap-1.5" style={{ right: SAFE.x, top: SAFE.y }}>
      {title && (
        <Slab deep="#000000" cut="left" enter="wipeLeft" style={{ maxWidth: 520 }}>
          <Block tone="ink" className="flex h-12 min-w-0 items-center gap-3 px-5">
            <span aria-hidden="true" className="h-4 w-4 shrink-0" style={{ background: "var(--hb-volt)" }} />
            <Label size={20}>{title}</Label>
          </Block>
        </Slab>
      )}
      {sponsor && (
        <Slab key={sponsor.id} deep="#000000" cut="left" enter="wipeLeft" delay={160} style={{ maxWidth: 440 }}>
          <Block tone="paper" className="flex min-h-16 min-w-0 items-center gap-4 px-5 py-2.5">
            {sponsor.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sponsor.logoUrl} alt={sponsor.name} className="h-11 max-w-[8rem] object-contain" />
            )}
            <span className="min-w-0 text-right">
              <Name size={24} style={{ fontWeight: 800 }}>
                {sponsor.name}
              </Name>
              {sponsor.tagline && (
                <Caption color="var(--hb-paper-muted)" size={18}>
                  {sponsor.tagline}
                </Caption>
              )}
            </span>
          </Block>
        </Slab>
      )}
    </Root>
  );
}

export function HundredTicker(p: OverlayElementProps["ticker"]) {
  const text = p.text.trim();
  if (!text) return null;
  // Slower for longer text: about 90px a second.
  const seconds = Math.max(18, Math.round((text.length * 13 * 2) / 90));
  return (
    <Root data-testid="hb-ticker" className="inset-x-0 bottom-0 flex h-12" style={{ gap: 0 }}>
      <Block tone="volt" enter="wipeRight" className="flex h-full shrink-0 items-center px-6" style={{ paddingLeft: SAFE.x }}>
        <Label size={20}>Latest</Label>
      </Block>
      <Block tone="ink" enter="wipeRight" delay={120} className="relative flex h-full min-w-0 flex-1 items-center overflow-hidden">
        <div className={styles.crawl} style={{ "--t": `${seconds}s` } as CSSProperties}>
          {[0, 1].map((k) => (
            <span key={k} aria-hidden={k === 1} className="flex items-center gap-10 pr-10">
              <Text size={24} className="whitespace-nowrap" style={{ color: "#ffffff" }}>
                {text}
              </Text>
              <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: "var(--hb-volt)" }} />
            </span>
          ))}
        </div>
      </Block>
    </Root>
  );
}
