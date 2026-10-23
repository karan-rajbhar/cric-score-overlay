"use client";

/**
 * Summer bash player cards: a player's career (read when shown, as the
 * Standard card does) or their tournament figures (the control room's
 * snapshot), and the player of the match. A big photo slot (their
 * picture, else initials), the name on a slanted plate and stat tiles.
 */

import type { PlayerCareerStatsRow } from "~/lib/firebase/types";
import { oversText } from "../../overlay-kit";
import { usePlayerProfile } from "../../overlay-data";
import { playerInSlot } from "../../profile-card";
import type { SeriesFigures } from "../../types";
import { avatarOf, playerTeamOf } from "../shared";
import type { OverlayElementProps } from "../types";
import { sideOfName, type SideKey } from "./kit";
import { batKey, bowlKey, Lower, PlayerStrap } from "./straps";

interface Tile {
  label: string;
  value: string | number;
}

export function careerTiles(c: PlayerCareerStatsRow, bowler: boolean): Tile[] {
  if (bowler) {
    return [
      { label: "Matches", value: c.total_matches ?? 0 },
      { label: "Wickets", value: c.total_wickets ?? 0 },
      ...(c.bowling_average ? [{ label: "Avg", value: c.bowling_average.toFixed(1) }] : []),
      ...(c.economy_rate ? [{ label: "Econ", value: c.economy_rate.toFixed(2) }] : []),
      ...(c.best_bowling_figures ? [{ label: "Best", value: c.best_bowling_figures }] : []),
    ];
  }
  return [
    { label: "Matches", value: c.total_matches ?? 0 },
    { label: "Runs", value: c.total_runs ?? 0 },
    ...(c.batting_average ? [{ label: "Avg", value: c.batting_average.toFixed(1) }] : []),
    ...(c.strike_rate ? [{ label: "SR", value: c.strike_rate.toFixed(1) }] : []),
    ...(c.highest_score ? [{ label: "Best", value: c.highest_score }] : []),
    { label: "50s / 100s", value: `${c.half_centuries ?? 0} / ${c.centuries ?? 0}` },
  ];
}

export function seriesTiles(f: SeriesFigures, bowler: boolean): Tile[] {
  const out: Tile[] = [{ label: "Matches", value: f.matches }];
  if (bowler) {
    if (f.wickets != null) out.push({ label: "Wickets", value: f.wickets });
    if (f.economy) out.push({ label: "Econ", value: f.economy.toFixed(2) });
    if (f.best) out.push({ label: "Best", value: f.best });
  } else {
    if (f.runs != null) out.push({ label: "Runs", value: f.runs });
    if (f.average) out.push({ label: "Avg", value: f.average.toFixed(1) });
    if (f.strikeRate) out.push({ label: "SR", value: f.strikeRate.toFixed(1) });
    if (f.highest) out.push({ label: "Best", value: f.highest });
  }
  return out;
}

function CareerProfile(p: OverlayElementProps["playerProfile"]) {
  const { state, slot, layout, profile: given } = p;
  const who = playerInSlot(state, slot);
  const read = usePlayerProfile(state, given === undefined ? who.id : null, true);
  const profile = given ?? read.profile;
  const loaded = given !== undefined || read.loaded;
  if (!who.name || !loaded || !profile?.career) return null;
  return (
    <Lower state={state} layout={layout} type="career">
      <PlayerStrap
        side={who.bowler ? bowlKey(state) : batKey(state)}
        tag="Career"
        tagNeon={who.bowler ? "cyan" : "magenta"}
        name={who.name}
        photo={profile.avatarUrl ?? avatarOf(p.match, who.id)}
        tiles={careerTiles(profile.career, who.bowler)}
      />
    </Lower>
  );
}

function SeriesProfile(p: OverlayElementProps["playerProfile"]) {
  const { state, slot, layout } = p;
  const who = playerInSlot(state, slot);
  const f = who.id ? p.snapshots?.series?.[who.id] : null;
  if (!who.name || !f) return null;
  return (
    <Lower state={state} layout={layout} type="series">
      <PlayerStrap
        side={who.bowler ? bowlKey(state) : batKey(state)}
        tag={state.tournament_name ?? "This tournament"}
        tagNeon="lime"
        name={who.name}
        tiles={seriesTiles(f, who.bowler)}
      />
    </Lower>
  );
}

export function PlayerProfile(p: OverlayElementProps["playerProfile"]) {
  return p.mode === "career" ? <CareerProfile {...p} /> : <SeriesProfile {...p} />;
}


export function PlayerOfTheMatch(p: OverlayElementProps["playerOfTheMatch"]) {
  const { state, match, innings, layout } = p;
  const potm = match?.player_of_the_match;
  if (!potm?.full_name) return null;
  const team = playerTeamOf(match, potm.id);
  const potmSide: SideKey =
    team === 2 ? "t2" : team === 1 ? "t1" : (sideOfName(state, state.winning_team_name) ?? "t1");
  const bat = innings
    .flatMap((i) => i.batting_performances ?? [])
    .find((b) => b.user_id === potm.id && b.balls_faced > 0);
  const bowl = innings
    .flatMap((i) => i.bowling_performances ?? [])
    .find((b) => b.user_id === potm.id && b.balls_bowled > 0);
  const tiles: Tile[] = [];
  if (bat) {
    tiles.push({ label: "Batting", value: `${bat.runs_scored}${bat.is_out ? "" : "*"} (${bat.balls_faced})` });
  }
  if (bowl) {
    tiles.push({
      label: "Bowling",
      value: `${bowl.wickets_taken}-${bowl.runs_conceded} (${oversText(bowl.balls_bowled)})`,
    });
  }
  return (
    <Lower state={state} layout={layout} type="potm">
      <PlayerStrap
        side={potmSide}
        tag="Player of the match"
        tagNeon="yellow"
        name={potm.full_name}
        photo={potm.avatar_url ?? avatarOf(match, potm.id)}
        tiles={tiles.length ? tiles : undefined}
        details={tiles.length ? undefined : [state.result_description]}
      />
    </Lower>
  );
}
