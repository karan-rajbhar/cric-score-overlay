"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import {
  CareerCards,
  ProfileHighlights,
  type Figure,
} from "~/components/players/player-profile";
import { PlayerMilestones } from "~/components/players/player-milestones";
import {
  inSeason,
  seasonFigures,
  seasonsOf,
  type SeasonBatting,
  type SeasonFigures,
  type SeasonBowling,
} from "~/lib/season-stats";
import type {
  MilestoneBatting,
  MilestoneBowling,
} from "~/lib/milestones";

const ALL = "all";

interface AllTime {
  matches: number;
  runs: number;
  wickets: number;
  catches: number;
  /** Career fielding (from the career stats: the records do not hold it). */
  fielding: Figure[];
}

type Batting = SeasonBatting & MilestoneBatting;
type Bowling = SeasonBowling & MilestoneBowling;

const orDash = (n: number | null) => n ?? "–";

/**
 * The batting and bowling cards from the player's own records, the same for
 * a season and all time: each figure once (runs and wickets are in the
 * tiles above, P4), and 50s, 100s and hauls only when there is one (most
 * matches here are 8 or 10 overs).
 */
function cardsOf(f: SeasonFigures, batted: boolean, bowled: boolean) {
  const batting: Figure[] = [
    ["Innings", f.innings],
    ["Not outs", f.notOuts],
    ["Highest", f.highest ?? "–"],
    ["Average", orDash(f.average)],
    ["Strike rate", orDash(f.strikeRate)],
    ["Balls", f.balls],
    ["4s", f.fours],
    ["6s", f.sixes],
  ];
  if (f.halfCenturies > 0) batting.push(["50s", f.halfCenturies]);
  if (f.centuries > 0) batting.push(["100s", f.centuries]);
  const bowling: Figure[] = [
    ["Overs", f.overs],
    ["Best", f.best ?? "–"],
    ["Average", orDash(f.bowlingAverage)],
    ["Economy", orDash(f.economy)],
  ];
  if (f.threeWickets > 0) bowling.push(["3 wickets", f.threeWickets]);
  if (f.fiveWickets > 0) bowling.push(["5 wickets", f.fiveWickets]);
  return { batting: batted ? batting : null, bowling: bowled ? bowling : null };
}

/**
 * The statistics tab: career figures, or one season's from the same records.
 * `between` (live figures, recent form) sits under the headline tiles.
 */
export function SeasonStatistics({
  batting,
  bowling,
  allTime,
  between,
}: {
  batting: readonly Batting[];
  bowling: readonly Bowling[];
  allTime: AllTime;
  between?: ReactNode;
}) {
  const [season, setSeason] = useState(ALL);
  const selectId = useId();
  const seasons = seasonsOf(batting, bowling);

  const year = season === ALL ? null : Number(season);
  const bat = year === null ? batting : inSeason(batting, year);
  const bowl = year === null ? bowling : inSeason(bowling, year);
  const f = year === null ? null : seasonFigures(bat, bowl);
  const cards = cardsOf(
    f ?? seasonFigures(batting, bowling),
    bat.length > 0,
    bowl.some((b) => b.balls_bowled > 0),
  );

  return (
    <>
      {seasons.length > 0 && (
        <div className="flex items-center gap-3">
          <Label htmlFor={selectId} className="text-xs font-semibold">
            Season
          </Label>
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger id={selectId} className="h-11 w-40 md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All time</SelectItem>
              {seasons.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {f ? (
        <ProfileHighlights matches={f.matches} runs={f.runs} wickets={f.wickets} />
      ) : (
        <ProfileHighlights
          matches={allTime.matches}
          runs={allTime.runs}
          wickets={allTime.wickets}
          catches={allTime.catches}
        />
      )}
      {between}
      {/* Each figure once: matches, runs and wickets are in the tiles
          above (P4); fielding is career-only. */}
      <CareerCards
        batting={cards.batting}
        bowling={cards.bowling}
        fielding={
          !f && allTime.fielding.some(([, v]) => Number(v) > 0)
            ? allTime.fielding
            : null
        }
      />
      <PlayerMilestones batting={bat} bowling={bowl} />
    </>
  );
}
