"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { Avatar } from "~/components/ds/avatar";
import { Card } from "~/components/ds/card";
import { ListCard } from "~/components/ds/list";
import { Segmented } from "~/components/ds/tabs";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  calculateSuperstars,
  formatDecimalOvers,
  type SuperstarPlayer,
  type SuperstarRole,
} from "~/lib/cricket";
import type { Match } from "~/lib/match-types";

interface MatchSuperstarsProps {
  match: Match;
}

const ROLE: Record<SuperstarRole, string> = {
  WK: "Keeper",
  BAT: "Batter",
  AR: "All-rounder",
  BOWL: "Bowler",
};

/** Impact rating: the points over ten, as "12.6". */
const ratingOf = (p: SuperstarPlayer) => (p.totalPoints / 10).toFixed(1);

/** "52* (34) · 1/23 (2.0) · 1 ct": what they did in this match. */
function figuresOf(p: SuperstarPlayer): string {
  const s = p.stats;
  const parts: string[] = [];
  if (s.runs > 0 || s.balls > 0) {
    parts.push(`${s.runs}${s.isOut ? "" : "*"} (${s.balls})`);
  }
  if (s.wickets > 0 || s.overs > 0) {
    parts.push(
      `${s.wickets}/${s.runsConceded} (${formatDecimalOvers(s.overs)})`,
    );
  }
  if (s.catches > 0) parts.push(`${s.catches} ct`);
  if (s.stumpings > 0) parts.push(`${s.stumpings} st`);
  if (s.runOuts > 0)
    parts.push(`${s.runOuts} run out${s.runOuts > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

/** The leader: their picture, figures and rating on the lavender panel. */
function LeaderCard({
  player,
  onOpen,
}: {
  player: SuperstarPlayer;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-primary-soft/70 p-4 text-left ring-1 ring-primary/10 transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar name={player.playerName} src={player.avatarUrl} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-primary">
          Most impact
        </span>
        <span className="block truncate text-lg font-semibold leading-snug text-foreground">
          {player.playerName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {player.teamName} · {ROLE[player.role]}
        </span>
        <span className="mt-1 block text-pretty font-score text-sm tabular-nums text-foreground">
          {figuresOf(player)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-score text-3xl font-semibold tabular-nums leading-none text-foreground">
          {ratingOf(player)}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">rating</span>
      </span>
    </button>
  );
}

function PlayerRow({
  player,
  onOpen,
}: {
  player: SuperstarPlayer;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <span className="w-5 shrink-0 text-right font-score text-sm tabular-nums text-muted-foreground">
        {player.rank}
      </span>
      <Avatar name={player.playerName} src={player.avatarUrl} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {player.playerName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {player.teamName} · {figuresOf(player) || ROLE[player.role]}
        </span>
      </span>
      <span className="shrink-0 font-score text-lg font-semibold tabular-nums text-foreground">
        {ratingOf(player)}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  );
}

function BreakdownRow({
  label,
  detail,
  points,
}: {
  label: string;
  detail?: string;
  points: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-2.5 first:border-t-0">
      <dt className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        {detail && (
          <span className="block font-score text-xs tabular-nums text-muted-foreground">
            {detail}
          </span>
        )}
      </dt>
      <dd className="shrink-0 font-score text-sm font-semibold tabular-nums text-foreground">
        {points > 0 ? `+${points}` : points}
      </dd>
    </div>
  );
}

/** One player's points, part by part. */
function PointsDialog({
  player,
  onOpenChange,
}: {
  player: SuperstarPlayer | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!player) return null;
  const s = player.stats;
  const fielding = [
    s.catches ? `${s.catches} ct` : null,
    s.stumpings ? `${s.stumpings} st` : null,
    s.runOuts ? `${s.runOuts} run out${s.runOuts > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={player.playerName} src={player.avatarUrl} size="md" />
            <div className="min-w-0 text-left">
              <DialogTitle className="truncate">
                {player.playerName}
              </DialogTitle>
              <DialogDescription>
                {player.teamName} · {ROLE[player.role]} · ranked {player.rank}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex items-end justify-between rounded-2xl bg-muted p-4">
          <span>
            <span className="block text-xs text-muted-foreground">
              Impact rating
            </span>
            <span className="font-score text-3xl font-semibold tabular-nums text-foreground">
              {ratingOf(player)}
            </span>
          </span>
          <span className="font-score text-sm tabular-nums text-muted-foreground">
            {player.totalPoints} points
          </span>
        </div>
        <dl>
          <BreakdownRow
            label="Batting"
            detail={
              s.balls > 0 || s.runs > 0
                ? `${s.runs}${s.isOut ? "" : "*"} (${s.balls}) · ${s.fours} fours · ${s.sixes} sixes`
                : "Did not bat"
            }
            points={player.breakdown.batting}
          />
          <BreakdownRow
            label="Bowling"
            detail={
              s.overs > 0
                ? `${s.wickets}/${s.runsConceded} (${formatDecimalOvers(s.overs)} ov)`
                : "Did not bowl"
            }
            points={player.breakdown.bowling}
          />
          <BreakdownRow
            label="Fielding"
            detail={fielding.length ? fielding.join(" · ") : undefined}
            points={player.breakdown.fielding}
          />
          {player.breakdown.winBonus > 0 && (
            <BreakdownRow
              label="Winning side"
              detail="15% of the above, plus 5"
              points={player.breakdown.winBonus}
            />
          )}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

const RULES: [title: string, rules: string[]][] = [
  [
    "Batting",
    [
      "1 point a run, plus 1 a four and 2 a six",
      "30 runs: +5, 50: +15, 100: +30",
      "Strike rate over 10 balls or more: 150 or more +6, 200 or more +12, under 80 −6",
      "Not out with 20 or more: +5",
    ],
  ],
  [
    "Bowling",
    [
      "25 points a wicket, 12 a maiden",
      "3 wickets: +15, 5 wickets: +30",
      "Economy over 2 overs or more: under 5 +15, under 6.5 +8, over 10 −8",
    ],
  ],
  ["Fielding", ["Catch 10, stumping 15, run out 15"]],
  ["Winning side", ["15% of the player's points, plus 5"]],
];

function RulesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How points work</DialogTitle>
          <DialogDescription>
            Each player's points come from this match's scorecard; the rating is
            the points over ten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {RULES.map(([title, rules]) => (
            <section key={title}>
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Filter = "all" | "team1" | "team2";

/**
 * Top performers: the match's eleven most influential players by impact
 * points (batting, bowling, fielding, winning side), the leader on top, the
 * rest ranked; a player opens their points breakdown.
 */
export function MatchSuperstars({ match }: MatchSuperstarsProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<SuperstarPlayer | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const { superstars } = useMemo(() => calculateSuperstars(match), [match]);

  const shown = useMemo(
    () =>
      filter === "all"
        ? superstars
        : superstars.filter(
            (p) =>
              p.teamId ===
              (filter === "team1" ? match.team1_id : match.team2_id),
          ),
    [superstars, filter, match.team1_id, match.team2_id],
  );

  if (superstars.length === 0) {
    return (
      <Card className="px-4 py-12 text-center">
        <h3 className="text-base font-semibold text-foreground">
          Top performers
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          The match's most influential players appear here once runs, wickets
          and catches are recorded.
        </p>
      </Card>
    );
  }

  const [leader, ...rest] = shown;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Team"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All players" },
            {
              value: "team1",
              label: match.team1.short_name || match.team1.name,
            },
            {
              value: "team2",
              label: match.team2.short_name || match.team2.name,
            },
          ]}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRulesOpen(true)}
          className="text-muted-foreground"
        >
          <Info aria-hidden="true" />
          How points work
        </Button>
      </div>

      {leader ? (
        <LeaderCard player={leader} onOpen={() => setSelected(leader)} />
      ) : (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          No one from this side is in the top eleven.
        </p>
      )}

      {rest.length > 0 && (
        <ListCard aria-label="Ranking">
          {rest.map((p) => (
            <PlayerRow
              key={p.playerId}
              player={p}
              onOpen={() => setSelected(p)}
            />
          ))}
        </ListCard>
      )}

      <PointsDialog
        player={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
}
