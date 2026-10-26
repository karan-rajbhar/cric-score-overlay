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
  batting: Figure[];
  bowling: Figure[];
  fielding: Figure[];
}

type Batting = SeasonBatting & MilestoneBatting;
type Bowling = SeasonBowling & MilestoneBowling;

const orDash = (n: number | null) => n ?? "–";

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

  return (
    <>
      {seasons.length > 0 && (
        <div className="flex items-center gap-3">
          <Label htmlFor={selectId} className="text-xs font-semibold">
            Season
          </Label>
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger id={selectId} className="h-9 w-40">
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
      {f ? (
        <CareerCards
          batting={[
            ["Matches", f.matches],
            ["Runs", f.runs],
            ["Average", orDash(f.average)],
            ["Strike rate", orDash(f.strikeRate)],
            ["50s", f.halfCenturies],
            ["100s", f.centuries],
          ]}
          bowling={[
            ["Wickets", f.wickets],
            ["Average", orDash(f.bowlingAverage)],
            ["Economy", orDash(f.economy)],
            ["5 wickets", f.fiveWickets],
          ]}
        />
      ) : (
        <CareerCards
          batting={allTime.batting}
          bowling={allTime.bowling}
          fielding={allTime.fielding}
        />
      )}
      <PlayerMilestones batting={bat} bowling={bowl} />
    </>
  );
}
