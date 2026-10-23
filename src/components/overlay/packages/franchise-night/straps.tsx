"use client";

/**
 * Franchise night's lower thirds: player bands with a photo slot (batter,
 * bowler, new batter, new bowler, last wicket, career and tournament
 * figures, player of the match), and the straps built from the score
 * (partnership, chase, this over, win predictor, projected score, breaks,
 * messages). Each sits left inside title safe, clear of the score bug.
 */

import type { CSSProperties, ReactNode } from "react";
import { formatDismissalType } from "~/lib/cricket";
import type { PlayerCareerStatsRow } from "~/lib/firebase/types";
import { cn } from "~/lib/utils";
import { winPredictorFromLive } from "~/lib/win-predictor";
import { usePlayerProfile } from "../../overlay-data";
import {
  economyText,
  oversText,
  overTokens,
  strikeRateText,
  teamCode,
} from "../../overlay-kit";
import { playerInSlot, type PlayerSlot as Slot } from "../../profile-card";
import { ballsPerOverOf, sidesOf } from "../../score-bug";
import { strapText, type StrapText } from "../../strap-views";
import type { ActiveLowerThirdStrap, LiveMatchState } from "../../types";
import { AnimatedNumber } from "../motion";
import type { BreakKind, OverlayElementProps } from "../types";
import {
  CUT,
  Crest,
  DISPLAY,
  FIGURE,
  FnRoot,
  GoldRule,
  Kicker,
  LIFT,
  LowerFrame,
  OverTray,
  PlayerSlot,
  SAFE,
  SAFE_WIDTH,
  Sheen,
  Stat,
  TEXT,
  chamfer,
  deepGlass,
  delay,
  glass,
  goldFill,
  wedge,
} from "./kit";
import { avatarOf, playerTeamOf, projectedTotals } from "../shared/derive";
import { RateMeterBar } from "./score-bug";
import { FN, matchTones, type TeamTone } from "./theme";

// ---- the player band --------------------------------------------------------

const BAND_PHOTO = { width: 156, height: 184 };

/**
 * A player lower third: photo slot, kicker, the name on a team-colour
 * wedge with a figure beside it, then a glass row of figures.
 */
export function PlayerBand({
  kicker,
  kickerTone = "gold",
  tone,
  photo,
  name,
  team,
  headline,
  children,
  width = 1080,
  label,
}: {
  kicker: ReactNode;
  kickerTone?: "gold" | "wicket";
  tone: TeamTone;
  /** The photo slot (null: no slot, e.g. a team strap). */
  photo: { url: string | null; name: string | null } | null;
  name: ReactNode;
  /** A team code chip after the kicker. */
  team?: string | null;
  /** A big figure at the right of the name. */
  headline?: ReactNode;
  children?: ReactNode;
  width?: number;
  label?: string;
}) {
  return (
    <LowerFrame width={width} label={label}>
      <div className="mb-2 flex items-center gap-2 fn-a-slide" style={delay(60)}>
        <Kicker tone={kickerTone}>{kicker}</Kicker>
        {team && (
          <Kicker tone="team" team={tone} size="md">
            {team}
          </Kicker>
        )}
      </div>
      <div className="relative flex items-stretch" style={{ clipPath: chamfer(CUT) }}>
        {photo && (
          <PlayerSlot
            url={photo.url}
            name={photo.name}
            tone={tone}
            width={BAND_PHOTO.width}
            height={BAND_PHOTO.height}
            className="fn-a-rise"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="fn-a-wipe relative flex h-[96px] items-center gap-6 overflow-hidden px-8"
            style={{ ...wedge(tone), ...delay(80) }}
          >
            <span
              className={cn(DISPLAY, "min-w-0 flex-1 truncate")}
              style={{ fontSize: "3.375rem", color: tone.text }}
            >
              {name}
            </span>
            {headline && (
              <span className={cn(FIGURE, "shrink-0 whitespace-nowrap")} style={{ fontSize: "3.25rem", color: tone.text }}>
                {headline}
              </span>
            )}
            <Sheen at={520} />
          </div>
          <GoldRule />
          <div
            className="fn-a-wipe flex min-h-[85px] flex-1 items-center gap-10 px-8"
            style={{ ...glass({ tone, strength: 0.22 }), ...delay(200) }}
          >
            {children}
          </div>
        </div>
      </div>
    </LowerFrame>
  );
}

/** A line of running text in a band's figures row. */
function BandText({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(TEXT, "min-w-0 truncate font-semibold")}
      style={{ fontSize: "1.625rem", color: muted ? FN.muted : FN.white }}
    >
      {children}
    </span>
  );
}

const custom = (strap: ActiveLowerThirdStrap | null) => !!strap?.title;

// ---- batters and bowlers ------------------------------------------------------

function batterSide(state: LiveMatchState) {
  const tones = matchTones(state);
  const { batting } = sidesOf(state);
  return { tone: tones.bat, code: teamCode(batting.short, batting.name) || null };
}

function bowlerSide(state: LiveMatchState) {
  const tones = matchTones(state);
  const { bowling } = sidesOf(state);
  return { tone: tones.bowl, code: teamCode(bowling.short, bowling.name) || null };
}

/** A strap the producer worded: their title, subtitle and detail. */
function WordedBand({
  text,
  tone,
  code,
  photo,
}: {
  text: StrapText;
  tone: TeamTone;
  code: string | null;
  photo: { url: string | null; name: string | null } | null;
}) {
  return (
    <PlayerBand kicker={text.badge || "Player"} tone={tone} team={code} photo={photo} name={text.title}>
      {text.subtitle && <BandText>{text.subtitle}</BandText>}
      {text.detail && <BandText muted>{text.detail}</BandText>}
    </PlayerBand>
  );
}

function BatterFigures({
  state,
  slot,
  photoUrl,
}: {
  state: LiveMatchState;
  slot: Exclude<Slot, "bowler">;
  photoUrl: string | null;
}) {
  const { tone, code } = batterSide(state);
  if (slot === "last_out") {
    const w = state.last_wicket;
    if (!w?.name) return null;
    const how = [
      w.dismissal_type && formatDismissalType(w.dismissal_type),
      w.bowler_name && `b ${w.bowler_name}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <PlayerBand
        kicker="Wicket"
        kickerTone="wicket"
        tone={tone}
        team={code}
        photo={{ url: photoUrl, name: w.name }}
        name={w.name}
        headline={
          <>
            {w.runs}
            <span style={{ fontSize: "1.75rem", opacity: 0.85 }}> ({w.balls})</span>
          </>
        }
        label="Last wicket"
      >
        {how && <BandText>{how}</BandText>}
        <Stat label="Fell at" value={`${w.score}/${w.wicket_number}`} size="sm" />
        <Stat label="Overs" value={String(w.overs)} size="sm" />
        <Stat label="SR" value={strikeRateText(w.runs, w.balls) ?? "-"} size="sm" />
      </PlayerBand>
    );
  }
  const striker = slot === "striker";
  const name = striker ? state.striker_name : state.non_striker_name;
  if (!name) return null;
  const runs = striker ? state.striker_runs : state.non_striker_runs;
  const balls = striker ? state.striker_balls : state.non_striker_balls;
  const fours = striker ? state.striker_fours : state.non_striker_fours;
  const sixes = striker ? state.striker_sixes : state.non_striker_sixes;
  return (
    <PlayerBand
      kicker={striker ? "On strike" : "Batting"}
      tone={tone}
      team={code}
      photo={{ url: photoUrl, name }}
      name={name}
      headline={
        <>
          <AnimatedNumber value={runs ?? 0} />
          <span style={{ fontSize: "1.75rem", opacity: 0.85 }}> ({balls ?? 0})</span>
        </>
      }
      label={striker ? "Striker" : "Non-striker"}
    >
      {fours !== null && fours !== undefined && <Stat label="Fours" value={fours} />}
      {sixes !== null && sixes !== undefined && <Stat label="Sixes" value={sixes} />}
      <Stat label="Strike rate" value={strikeRateText(runs, balls) ?? "-"} />
      {(state.partnership_runs ?? 0) > 0 && (
        <Stat
          label="Partnership"
          value={`${state.partnership_runs} (${state.partnership_balls ?? 0})`}
          accent
        />
      )}
    </PlayerBand>
  );
}

export function FranchiseBatterLowerThird(p: OverlayElementProps["batterLowerThird"]) {
  const who = playerInSlot(p.state, p.slot);
  const photo = avatarOf(p.match, who.id);
  if (p.variant === "strap" && custom(p.strap)) {
    const text = strapText(p.strap!, p.state);
    if (!text?.title) return null;
    const side = batterSide(p.state);
    return <WordedBand text={text} tone={side.tone} code={side.code} photo={{ url: photo, name: text.title }} />;
  }
  return <BatterFigures state={p.state} slot={p.slot} photoUrl={photo} />;
}

function BowlerFigures({ state, photoUrl, bpo }: { state: LiveMatchState; photoUrl: string | null; bpo: number }) {
  const name = state.current_bowler_name;
  if (!name) return null;
  const { tone, code } = bowlerSide(state);
  const tokens = overTokens(state);
  return (
    <PlayerBand
      kicker="Bowling"
      tone={tone}
      team={code}
      photo={{ url: photoUrl, name }}
      name={name}
      headline={<AnimatedNumber value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} />}
      label="Bowler"
    >
      <Stat label="Overs" value={oversText(state.bowler_balls, bpo)} />
      {state.bowler_maidens !== null && state.bowler_maidens !== undefined && (
        <Stat label="Maidens" value={state.bowler_maidens} />
      )}
      <Stat label="Economy" value={economyText(state.bowler_runs, state.bowler_balls) ?? "-"} />
      {tokens.length > 0 && (
        <span className="ml-auto flex items-center gap-4">
          <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1rem", letterSpacing: "0.08em", color: FN.muted }}>
            This over
          </span>
          <OverTray tokens={tokens} slots={0} size={36} gap={6} />
        </span>
      )}
    </PlayerBand>
  );
}

export function FranchiseBowlerLowerThird(p: OverlayElementProps["bowlerLowerThird"]) {
  const photo = avatarOf(p.match, p.state.bowler_id);
  if (p.variant === "strap" && custom(p.strap)) {
    const text = strapText(p.strap!, p.state);
    if (!text?.title) return null;
    const side = bowlerSide(p.state);
    return <WordedBand text={text} tone={side.tone} code={side.code} photo={{ url: photo, name: text.title }} />;
  }
  return <BowlerFigures state={p.state} photoUrl={photo} bpo={ballsPerOverOf(p.match)} />;
}

export function FranchiseNewBatter(p: OverlayElementProps["newBatter"]) {
  const text = strapText(p.strap, p.state);
  if (!text?.title) return null;
  const { tone, code } = batterSide(p.state);
  const id = text.title === p.state.striker_name ? p.state.striker_id : text.title === p.state.non_striker_name ? p.state.non_striker_id : null;
  return (
    <PlayerBand
      kicker={text.badge || "New batter"}
      tone={tone}
      team={code}
      photo={{ url: avatarOf(p.match, id), name: text.title }}
      name={text.title}
      label="New batter"
    >
      {text.subtitle && <BandText>{text.subtitle}</BandText>}
      {text.detail && <BandText muted>{text.detail}</BandText>}
      {!text.subtitle && !text.detail && <BandText muted>Walks out to bat</BandText>}
    </PlayerBand>
  );
}

export function FranchiseNewBowler(p: OverlayElementProps["newBowler"]) {
  const text = strapText(p.strap, p.state);
  if (!text?.title) return null;
  const { tone, code } = bowlerSide(p.state);
  const s = p.state;
  const current = text.title === s.current_bowler_name;
  const bpo = ballsPerOverOf(p.match);
  return (
    <PlayerBand
      kicker={text.badge || "New bowler"}
      tone={tone}
      team={code}
      photo={{ url: avatarOf(p.match, current ? s.bowler_id : null), name: text.title }}
      name={text.title}
      headline={current && (s.bowler_balls ?? 0) > 0 ? `${s.bowler_wickets ?? 0}-${s.bowler_runs ?? 0}` : undefined}
      label="New bowler"
    >
      {text.subtitle && <BandText>{text.subtitle}</BandText>}
      {current && (s.bowler_balls ?? 0) > 0 && (
        <>
          <Stat label="Overs" value={oversText(s.bowler_balls, bpo)} size="sm" />
          <Stat label="Economy" value={economyText(s.bowler_runs, s.bowler_balls) ?? "-"} size="sm" />
        </>
      )}
      {text.detail && <BandText muted>{text.detail}</BandText>}
    </PlayerBand>
  );
}

// ---- career and tournament figures --------------------------------------------

interface Fig {
  label: string;
  value: ReactNode;
}

function careerFigures(c: PlayerCareerStatsRow, bowler: boolean): Fig[] {
  if (bowler) {
    return [
      { label: "Matches", value: c.total_matches ?? 0 },
      { label: "Wickets", value: c.total_wickets ?? 0 },
      ...(c.bowling_average ? [{ label: "Average", value: c.bowling_average.toFixed(1) }] : []),
      ...(c.economy_rate ? [{ label: "Economy", value: c.economy_rate.toFixed(2) }] : []),
      ...(c.best_bowling_figures ? [{ label: "Best", value: c.best_bowling_figures }] : []),
    ];
  }
  return [
    { label: "Matches", value: c.total_matches ?? 0 },
    { label: "Runs", value: c.total_runs ?? 0 },
    ...(c.batting_average ? [{ label: "Average", value: c.batting_average.toFixed(1) }] : []),
    ...(c.strike_rate ? [{ label: "Strike rate", value: c.strike_rate.toFixed(1) }] : []),
    ...(c.highest_score ? [{ label: "Best", value: c.highest_score }] : []),
    { label: "50s / 100s", value: `${c.half_centuries ?? 0} / ${c.centuries ?? 0}` },
  ];
}

function CareerBand({ p }: { p: OverlayElementProps["playerProfile"] }) {
  const who = playerInSlot(p.state, p.slot);
  const read = usePlayerProfile(p.state, p.profile === undefined ? who.id : null, true);
  const profile = p.profile ?? read.profile;
  const loaded = p.profile !== undefined || read.loaded;
  if (!who.name || !loaded || !profile?.career) return null;
  const side = who.bowler ? bowlerSide(p.state) : batterSide(p.state);
  const figs = careerFigures(profile.career, who.bowler);
  return (
    <PlayerBand
      kicker="Career"
      tone={side.tone}
      team={side.code}
      photo={{ url: profile.avatarUrl ?? avatarOf(p.match, who.id), name: who.name }}
      name={who.name}
      label="Career figures"
      width={1280}
    >
      {figs.map((f, i) => (
        <Stat key={f.label} label={f.label} value={f.value} accent={i === 1} />
      ))}
    </PlayerBand>
  );
}

function SeriesBand({ p }: { p: OverlayElementProps["playerProfile"] }) {
  const who = playerInSlot(p.state, p.slot);
  const f = who.id ? p.snapshots?.series?.[who.id] : null;
  if (!who.name || !f) return null;
  const side = who.bowler ? bowlerSide(p.state) : batterSide(p.state);
  const figs: Fig[] = [{ label: "Matches", value: f.matches }];
  if (who.bowler) {
    if (f.wickets !== null && f.wickets !== undefined) figs.push({ label: "Wickets", value: f.wickets });
    if (f.economy) figs.push({ label: "Economy", value: f.economy.toFixed(2) });
    if (f.best) figs.push({ label: "Best", value: f.best });
  } else {
    if (f.runs !== null && f.runs !== undefined) figs.push({ label: "Runs", value: f.runs });
    if (f.average) figs.push({ label: "Average", value: f.average.toFixed(1) });
    if (f.strikeRate) figs.push({ label: "Strike rate", value: f.strikeRate.toFixed(1) });
    if (f.highest) figs.push({ label: "Best", value: f.highest });
  }
  return (
    <PlayerBand
      kicker={p.state.tournament_name ?? "This tournament"}
      tone={side.tone}
      team={side.code}
      photo={{ url: avatarOf(p.match, who.id), name: who.name }}
      name={who.name}
      label="Tournament figures"
    >
      {figs.map((x, i) => (
        <Stat key={x.label} label={x.label} value={x.value} accent={i === 1} />
      ))}
    </PlayerBand>
  );
}

export function FranchisePlayerProfile(p: OverlayElementProps["playerProfile"]) {
  return p.mode === "career" ? <CareerBand p={p} /> : <SeriesBand p={p} />;
}

// ---- player of the match ------------------------------------------------------

export function FranchisePlayerOfTheMatch(p: OverlayElementProps["playerOfTheMatch"]) {
  const potm = p.match?.player_of_the_match;
  if (!potm?.full_name) return null;
  const bat = p.innings.flatMap((i) => i.batting_performances ?? []).find((b) => b.user_id === potm.id);
  const bowl = p.innings.flatMap((i) => i.bowling_performances ?? []).find((b) => b.user_id === potm.id);
  const side = playerTeamOf(p.match, potm.id);
  const tones = matchTones(p.state);
  const tone = side === 2 ? tones.team2 : tones.team1;
  const code =
    side === 2
      ? teamCode(p.state.team2_short_name, p.state.team2_name)
      : side === 1
        ? teamCode(p.state.team1_short_name, p.state.team1_name)
        : null;
  return (
    <PlayerBand
      kicker="Player of the match"
      tone={tone}
      team={code}
      photo={{ url: potm.avatar_url ?? avatarOf(p.match, potm.id), name: potm.full_name }}
      name={potm.full_name}
      label="Player of the match"
    >
      {bat && bat.balls_faced > 0 && (
        <Stat
          label="Batting"
          value={
            <>
              {bat.runs_scored}
              {bat.is_out ? "" : "*"}
              <span style={{ fontSize: "1.25rem", color: FN.muted }}> ({bat.balls_faced})</span>
            </>
          }
        />
      )}
      {bowl && bowl.balls_bowled > 0 && (
        <Stat
          label="Bowling"
          value={
            <>
              {bowl.wickets_taken}-{bowl.runs_conceded}
              <span style={{ fontSize: "1.25rem", color: FN.muted }}> ({oversText(bowl.balls_bowled)})</span>
            </>
          }
          accent
        />
      )}
      {p.state.result_description && <BandText muted>{p.state.result_description}</BandText>}
    </PlayerBand>
  );
}

// ---- team straps (no photo) ----------------------------------------------------

/**
 * A team strap: the batting side's crest wedge on the left, a kicker over
 * a headline, then a glass row of figures.
 */
export function TeamStrap({
  state,
  kicker,
  kickerTone = "gold",
  headline,
  children,
  width = 1240,
  label,
  side = "bat",
}: {
  state: LiveMatchState;
  kicker: ReactNode;
  kickerTone?: "gold" | "wicket";
  headline: ReactNode;
  children?: ReactNode;
  width?: number;
  label?: string;
  side?: "bat" | "bowl";
}) {
  const tones = matchTones(state);
  const { batting, bowling } = sidesOf(state);
  const team = side === "bowl" ? bowling : batting;
  const tone = side === "bowl" ? tones.bowl : tones.bat;
  const code = teamCode(team.short, team.name);
  return (
    <LowerFrame width={width} label={label}>
      <div className="mb-2 fn-a-slide" style={delay(60)}>
        <Kicker tone={kickerTone}>{kicker}</Kicker>
      </div>
      <div className="relative flex items-stretch" style={{ clipPath: chamfer(CUT) }}>
        {code && (
          <div
            className="fn-a-rise relative flex w-[150px] shrink-0 flex-col items-center justify-center gap-2 overflow-hidden"
            style={wedge(tone, 120)}
          >
            <Crest logo={team.logo} code={code} name={team.name} tone={tone} size={78} />
            <span className={DISPLAY} style={{ fontSize: "1.5rem", color: tone.text }}>
              {code}
            </span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="fn-a-wipe relative flex min-h-[96px] items-center gap-6 overflow-hidden px-8"
            style={{ ...glass({ tone, strength: 0.42 }), ...delay(80) }}
          >
            {headline}
            <Sheen at={520} />
          </div>
          <GoldRule />
          {children && (
            <div
              className="fn-a-wipe flex min-h-[78px] flex-1 items-center gap-10 px-8"
              style={{ ...deepGlass(), ...delay(200) }}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </LowerFrame>
  );
}

/** Big words of a strap's headline. */
function Headline({ children, size = "3.25rem", style }: { children: ReactNode; size?: string; style?: CSSProperties }) {
  return (
    <span className={cn(DISPLAY, "min-w-0 truncate")} style={{ fontSize: size, ...style }}>
      {children}
    </span>
  );
}

export function FranchisePartnershipStrap({ state, strap }: { state: LiveMatchState; strap: ActiveLowerThirdStrap | null }) {
  if (custom(strap)) {
    const text = strapText(strap!, state);
    if (!text?.title) return null;
    return (
      <TeamStrap state={state} kicker={text.badge || "Partnership"} headline={<Headline>{text.title}</Headline>} label="Partnership">
        {text.subtitle && <BandText>{text.subtitle}</BandText>}
      </TeamStrap>
    );
  }
  if (state.partnership_runs === null || !state.striker_name || !state.non_striker_name) return null;
  const runs = state.partnership_runs ?? 0;
  const balls = state.partnership_balls ?? 0;
  return (
    <TeamStrap
      state={state}
      kicker="Partnership"
      label="Partnership"
      headline={
        <>
          <span className={cn(FIGURE, "shrink-0")} style={{ fontSize: "3.75rem" }}>
            <AnimatedNumber value={runs} />
            <span style={{ fontSize: "1.75rem", color: FN.muted }}> ({balls})</span>
          </span>
          <Headline size="2.25rem" style={{ color: "rgba(255,255,255,0.92)" }}>
            {state.striker_name} <span style={{ color: FN.gold }}>&amp;</span> {state.non_striker_name}
          </Headline>
        </>
      }
    >
      <Stat label="Runs" value={runs} size="sm" />
      <Stat label="Balls" value={balls} size="sm" />
      <Stat label="Run rate" value={balls > 0 ? ((runs * 6) / balls).toFixed(2) : "-"} size="sm" accent />
      {state.last_wicket && (
        <BandText muted>
          Since {state.last_wicket.score}/{state.last_wicket.wicket_number}
        </BandText>
      )}
    </TeamStrap>
  );
}

export function FranchiseChase(p: OverlayElementProps["chase"]) {
  const s = p.state;
  if (custom(p.strap)) {
    const text = strapText(p.strap!, s);
    if (!text?.title) return null;
    return (
      <TeamStrap state={s} kicker={text.badge || "Chase"} headline={<Headline>{text.title}</Headline>} label="Chase">
        {text.subtitle && <BandText>{text.subtitle}</BandText>}
        {text.detail && <BandText muted>{text.detail}</BandText>}
      </TeamStrap>
    );
  }
  if (s.target_runs === null || s.runs_needed === null) return null;
  const won = (s.runs_needed ?? 0) <= 0;
  return (
    <TeamStrap
      state={s}
      kicker="The chase"
      label="Chase"
      headline={
        won ? (
          <Headline>Target {s.target_runs} reached</Headline>
        ) : (
          <span className="flex items-baseline gap-4 whitespace-nowrap">
            <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1.375rem", letterSpacing: "0.08em", color: FN.gold }}>
              Need
            </span>
            <span className={FIGURE} style={{ fontSize: "4.25rem" }}>
              <AnimatedNumber value={s.runs_needed ?? 0} />
            </span>
            <span className={DISPLAY} style={{ fontSize: "2rem", color: FN.muted }}>
              from
            </span>
            <span className={FIGURE} style={{ fontSize: "4.25rem" }}>
              <AnimatedNumber value={s.balls_remaining ?? 0} />
            </span>
            <span className={DISPLAY} style={{ fontSize: "2rem", color: FN.muted }}>
              {s.balls_remaining === 1 ? "ball" : "balls"}
            </span>
          </span>
        )
      }
    >
      <Stat label="Target" value={s.target_runs} size="sm" />
      {s.required_run_rate !== null && <Stat label="Required rate" value={s.required_run_rate.toFixed(2)} size="sm" accent />}
      {s.current_run_rate !== null && <Stat label="Current rate" value={s.current_run_rate.toFixed(2)} size="sm" />}
      <span className="ml-auto">
        <RateMeterBar state={s} height={20} segment={18} />
      </span>
    </TeamStrap>
  );
}

export function FranchiseThisOverStrap({ state, strap, bpo }: { state: LiveMatchState; strap: ActiveLowerThirdStrap | null; bpo: number }) {
  const text = strap ? strapText(strap, state) : null;
  const tokens = overTokens(state);
  if (!tokens.length && !text?.title) return null;
  const runs = state.this_over_runs ?? 0;
  return (
    <TeamStrap
      state={state}
      side="bowl"
      kicker={text?.badge || `Over ${(state.current_over ?? 0) + 1}`}
      label="This over"
      headline={
        <>
          <Headline size="3rem">{text?.title || `${runs} ${runs === 1 ? "run" : "runs"}`}</Headline>
          <span className="ml-auto">
            <OverTray tokens={tokens} slots={bpo} size={50} gap={10} />
          </span>
        </>
      }
    >
      {state.current_bowler_name && (
        <>
          <span className={cn(DISPLAY, "min-w-0 truncate")} style={{ fontSize: "1.75rem" }}>{state.current_bowler_name}</span>
          <Stat label="Figures" value={`${state.bowler_wickets ?? 0}-${state.bowler_runs ?? 0}`} size="sm" />
          <Stat label="Overs" value={oversText(state.bowler_balls, bpo)} size="sm" />
        </>
      )}
      <span className="ml-auto">
        <Stat
          label={teamCode(state.batting_team_short_name, state.batting_team_name) || "Score"}
          value={`${state.total_runs ?? 0}/${state.total_wickets ?? 0}`}
          size="sm"
          accent
        />
      </span>
    </TeamStrap>
  );
}

// ---- win predictor and projection ------------------------------------------------

export function PredictorStrap({ state }: { state: LiveMatchState }) {
  const est = winPredictorFromLive(state);
  if (!est || est.kind !== "chase") return null;
  const tones = matchTones(state);
  const { batting, bowling } = sidesOf(state);
  const bat = teamCode(batting.short, batting.name);
  const bowl = teamCode(bowling.short, bowling.name);
  const bowlColour = tones.bowl === tones.team2 ? tones.team2Contrast : tones.bowl.light;
  return (
    <LowerFrame width={1240} label="Win predictor">
      <div className="mb-2 fn-a-slide" style={delay(60)}>
        <Kicker>Win predictor · Estimate</Kicker>
      </div>
      <div className="relative" style={{ ...glass(), clipPath: chamfer(CUT) }}>
        <div className="flex h-[104px] items-center gap-6 px-6">
          <Crest logo={batting.logo} code={bat} name={batting.name} tone={tones.bat} size={72} />
          <span className={FIGURE} style={{ fontSize: "3.5rem" }}>
            {est.battingPct}%
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex justify-between">
              <span className={DISPLAY} style={{ fontSize: "1.5rem" }}>{bat}</span>
              <span className={DISPLAY} style={{ fontSize: "1.5rem" }}>{bowl}</span>
            </div>
            <div
              role="img"
              aria-label={`${bat} ${est.battingPct} percent, ${bowl} ${est.bowlingPct} percent`}
              className="flex h-5 overflow-hidden"
              style={{ clipPath: chamfer(6) }}
            >
              <span className="fn-a-grow-x block h-full" style={{ width: `${est.battingPct}%`, background: `linear-gradient(180deg, ${tones.bat.light}, ${tones.bat.base})` }} />
              <span className="block h-full flex-1" style={{ background: `linear-gradient(180deg, ${bowlColour}, ${tones.bowl.deep})` }} />
            </div>
          </div>
          <span className={FIGURE} style={{ fontSize: "3.5rem" }}>
            {est.bowlingPct}%
          </span>
          <Crest logo={bowling.logo} code={bowl} name={bowling.name} tone={tones.bowl} size={72} />
        </div>
        <GoldRule />
        <div className="flex h-12 items-center gap-8 px-8" style={deepGlass()}>
          <span className={cn(TEXT, "font-semibold")} style={{ fontSize: "1.25rem" }}>
            Need {est.runsNeeded} from {est.ballsLeft} balls
          </span>
          <span className={cn(TEXT, "font-semibold")} style={{ fontSize: "1.125rem", color: FN.muted }}>
            From the runs, balls and wickets left
          </span>
        </div>
      </div>
    </LowerFrame>
  );
}

/** The projection range and totals at fixed rates (first innings). */
export function ProjectionStrap({ state, bpo }: { state: LiveMatchState; bpo: number }) {
  const est = winPredictorFromLive(state);
  const range = est?.kind === "projection" ? est : null;
  const rates = projectedTotals(state, bpo);
  if (!range && !rates.length) return null;
  return (
    <TeamStrap
      state={state}
      kicker="Projected score · Estimate"
      label="Projected score"
      headline={
        range ? (
          <span className="flex items-baseline gap-4 whitespace-nowrap">
            <span className={FIGURE} style={{ fontSize: "4rem" }}>
              {range.low}
            </span>
            <span className={DISPLAY} style={{ fontSize: "2rem", color: FN.muted }}>
              to
            </span>
            <span className={FIGURE} style={{ fontSize: "4rem" }}>
              {range.high}
            </span>
          </span>
        ) : (
          <Headline>At these scoring rates</Headline>
        )
      }
    >
      {rates.map((r) => (
        <Stat
          key={r.label}
          label={r.current ? `At ${r.rate.toFixed(2)} (now)` : `At ${r.label} an over`}
          value={r.total}
          size="sm"
          accent={r.current}
        />
      ))}
    </TeamStrap>
  );
}

// ---- breaks -------------------------------------------------------------------

export const BREAK_COPY: Record<BreakKind, { kicker: string; title: string }> = {
  drinks: { kicker: "Drinks", title: "Drinks break" },
  timeout: { kicker: "Timeout", title: "Strategic timeout" },
  rain_delay: { kicker: "Weather", title: "Rain stopped play" },
  innings_break: { kicker: "Innings break", title: "Innings break" },
  powerplay: { kicker: "Powerplay", title: "Powerplay" },
};

export function BreakBandStrap({ state, kind, strap }: { state: LiveMatchState; kind: BreakKind; strap: ActiveLowerThirdStrap | null }) {
  const text = strapText(strap ?? { id: "fn-break", type: kind, title: "" }, state);
  if (kind === "powerplay" && !state.powerplay && !custom(strap)) return null;
  const copy = BREAK_COPY[kind];
  const worded = custom(strap);
  const title = worded ? text?.title : copy.title;
  const scored = state.total_runs !== null && (state.total_balls ?? 0) > 0;
  // The innings break's figure is the target (the chase has not begun).
  const target =
    kind === "innings_break"
      ? (state.target_runs ??
        (state.innings_completed && state.total_runs !== null ? state.total_runs + 1 : null))
      : null;
  // Defaults that repeat what the strap already shows (drinks: the
  // score; the innings break: the target) are left out.
  const subtitle =
    worded || (kind !== "drinks" && kind !== "innings_break") ? text?.subtitle : null;
  return (
    <TeamStrap
      state={state}
      kicker={text?.badge || copy.kicker}
      label={copy.title}
      headline={
        <>
          <Headline>{title}</Headline>
          {target !== null ? (
            <span className="ml-auto flex shrink-0 items-baseline gap-3">
              <span className={cn(TEXT, "font-semibold uppercase")} style={{ fontSize: "1.125rem", letterSpacing: "0.08em", color: FN.gold }}>
                Target
              </span>
              <span className={FIGURE} style={{ fontSize: "3rem" }}>
                {target}
              </span>
            </span>
          ) : (
            scored && (
              <span className={cn(FIGURE, "ml-auto shrink-0")} style={{ fontSize: "3rem" }}>
                {state.total_runs}/{state.total_wickets ?? 0}
                <span style={{ fontSize: "1.375rem", color: FN.muted }}> ({oversText(state.total_balls)})</span>
              </span>
            )
          )}
        </>
      }
    >
      {kind === "powerplay" && state.powerplay ? (
        <BandText>Fielding restrictions, overs 1 to {state.powerplay.end_over}</BandText>
      ) : (
        subtitle && <BandText>{subtitle}</BandText>
      )}
      {target !== null && state.balls_remaining !== null && (
        <BandText>
          {teamCode(state.batting_team_short_name, state.batting_team_name)} need {target} from{" "}
          {state.balls_remaining} balls
        </BandText>
      )}
      {target !== null && state.required_run_rate !== null && (
        <Stat label="Required rate" value={state.required_run_rate.toFixed(2)} size="sm" accent />
      )}
      {kind !== "innings_break" && state.current_run_rate !== null && scored && (
        <Stat label="Run rate" value={state.current_run_rate.toFixed(2)} size="sm" />
      )}
      {state.target_runs !== null && kind !== "innings_break" && (state.runs_needed ?? 0) > 0 && (
        <Stat label="Need" value={`${state.runs_needed} from ${state.balls_remaining}`} size="sm" accent />
      )}
    </TeamStrap>
  );
}

// ---- messages -------------------------------------------------------------------

export function FranchiseMessage(p: OverlayElementProps["message"]) {
  const text = strapText(p.strap, p.state);
  if (!text?.title) return null;
  const form = p.strap.type === "message" ? (p.strap.form ?? "double") : null;
  if (form === "single") {
    return (
      <FnRoot className="fixed z-30" style={{ left: SAFE.x, bottom: SAFE.y, width: SAFE_WIDTH }} aria-label="Message">
        <div style={LIFT}>
          <div className="fn-a-wipe-c relative flex h-[92px] items-center gap-8 overflow-hidden px-8" style={{ ...glass(), clipPath: chamfer(CUT) }}>
            {text.badge && <Kicker size="lg">{text.badge}</Kicker>}
            <span className={cn(DISPLAY, "min-w-0 truncate")} style={{ fontSize: "2.75rem" }}>
              {text.title}
            </span>
            <Sheen at={400} />
          </div>
        </div>
      </FnRoot>
    );
  }
  if (form === "baseline") {
    return (
      <FnRoot className="fixed z-30" style={{ left: SAFE.x, bottom: 10, width: SAFE_WIDTH }} aria-label="Message">
        <div className="fn-a-wipe flex h-10 items-center gap-5 overflow-hidden px-6" style={{ ...deepGlass(), clipPath: chamfer(8) }}>
          {text.badge && (
            <span className={cn(DISPLAY, "shrink-0")} style={{ ...goldFill(), padding: "2px 12px", fontSize: "1.125rem", letterSpacing: "0.06em", clipPath: chamfer(5) }}>
              {text.badge}
            </span>
          )}
          <span className={cn(TEXT, "truncate font-semibold")} style={{ fontSize: "1.25rem" }}>
            {text.title}
          </span>
        </div>
      </FnRoot>
    );
  }
  if (form === "double") {
    return (
      <LowerFrame width={1240} label="Message">
        <div className="mb-2 fn-a-slide" style={delay(60)}>
          <Kicker>{text.badge || "Notice"}</Kicker>
        </div>
        <div className="relative" style={{ clipPath: chamfer(CUT) }}>
          <div className="fn-a-wipe relative overflow-hidden px-8 py-5" style={glass({ tone: matchTones(p.state).bat, strength: 0.3 })}>
            <h3 className={cn(DISPLAY, "truncate")} style={{ fontSize: "3rem" }}>
              {text.title}
            </h3>
            <Sheen at={420} />
          </div>
          {text.subtitle && (
            <>
              <GoldRule />
              <p className={cn(TEXT, "fn-a-wipe px-8 py-4 font-medium")} style={{ ...deepGlass(), ...delay(160), fontSize: "1.625rem", lineHeight: 1.3 }}>
                {text.subtitle}
              </p>
            </>
          )}
        </div>
      </LowerFrame>
    );
  }
  // A worded strap (custom, commentary): the team strap with its text.
  return (
    <TeamStrap
      state={p.state}
      kicker={text.badge || (p.strap.type === "commentary" ? "Commentary" : "Update")}
      label="Message"
      headline={<Headline size="2.5rem">{text.title}</Headline>}
    >
      {text.subtitle && <BandText>{text.subtitle}</BandText>}
      {text.detail && <BandText muted>{text.detail}</BandText>}
    </TeamStrap>
  );
}
