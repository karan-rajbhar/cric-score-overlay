"use client";

import { Loader2 } from "lucide-react";
import { TeamCrest } from "~/components/ds/avatar";
import { Card, CardHeader } from "~/components/ds/card";
import { SectionHeader } from "~/components/ds/list";
import { FixtureCard, MatchCard } from "~/components/ds/match-card";
import { MatchNote } from "~/components/ds/score";
import {
  summarizeHeadToHead,
  type HeadToHeadSummary,
} from "~/lib/head-to-head";
import {
  useHeadToHeadQuery,
  type HistoricalMatchSummary as HistoricalMatch,
} from "~/lib/hooks/useMatchQueries";
import type { MatchTeam } from "~/lib/match-types";
import { formatDecimalOvers } from "~/lib/cricket";
import { matchCardLabel, matchStart } from "./match-card";
import { teamRef } from "./match-hero";

interface HeadToHeadProps {
  team1: MatchTeam;
  team2: MatchTeam;
  currentMatchId: string;
}

function Side({
  team,
  wins,
  align,
}: {
  team: MatchTeam;
  wins: number;
  align: "start" | "end";
}) {
  return (
    <div
      className={
        align === "start"
          ? "flex min-w-0 items-center gap-3"
          : "flex min-w-0 flex-row-reverse items-center gap-3 text-right"
      }
    >
      <TeamCrest {...teamRef(team)} size="md" />
      <span className="min-w-0">
        <span className="block font-score text-3xl font-semibold tabular-nums leading-none text-foreground">
          {wins}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {team.short_name || team.name}
        </span>
      </span>
    </div>
  );
}

/**
 * The two sides' record against each other (wins either side, ties and no
 * results in the middle) and their past meetings, the latest first.
 */
export function HeadToHead({ team1, team2, currentMatchId }: HeadToHeadProps) {
  const { data, isLoading: loading } = useHeadToHeadQuery(team1.id, team2.id);
  const matches = data ?? [];

  const summary = summarizeHeadToHead(
    matches,
    team1.id,
    team2.id,
    currentMatchId,
  );
  const { completed, open } = summary;
  const total = completed.length;

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Loading head-to-head records…
      </Card>
    );
  }

  const meetings = (title: string, list: HistoricalMatch[]) => (
    <div className="space-y-3">
      <SectionHeader title={title} as="h3" />
      {list.map((m) => (
        <MeetingCard
          key={m.id}
          match={m}
          team1={team1}
          team2={team2}
          current={m.id === currentMatchId}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <RecordCard team1={team1} team2={team2} summary={summary} />
      {open.length > 0 && meetings("Live and upcoming", open)}
      {total > 0 && meetings("Past meetings", completed)}
    </div>
  );
}

function RecordCard({
  team1,
  team2,
  summary,
}: {
  team1: MatchTeam;
  team2: MatchTeam;
  summary: HeadToHeadSummary<HistoricalMatch>;
}) {
  const { completed, team1Wins, team2Wins, others, streak } = summary;
  const total = completed.length;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const streakTeam = streak?.teamId === team1.id ? team1 : team2;
  return (
    <Card>
      <CardHeader
        title="Head-to-head record"
        description={
          total > 0
            ? `Every completed match between ${team1.name} and ${team2.name}.`
            : `No completed matches between ${team1.name} and ${team2.name} yet.`
        }
      />
      {total > 0 && (
        <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <Side team={team1} wins={team1Wins} align="start" />
            <div className="text-center">
              <span className="block font-score text-lg font-semibold tabular-nums text-muted-foreground">
                {total}
              </span>
              <span className="block text-xs text-muted-foreground">
                {total === 1 ? "match" : "matches"}
                {others > 0 && `, ${others} tied or no result`}
              </span>
            </div>
            <Side team={team2} wins={team2Wins} align="end" />
          </div>
          <div
            className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${team1.name} ${team1Wins} wins, ${team2.name} ${team2Wins} wins${others ? `, ${others} tied or no result` : ""}`}
          >
            <div
              className="bg-series-1"
              style={{ width: `${pct(team1Wins)}%` }}
            />
            <div
              className="bg-muted-foreground/25"
              style={{ width: `${pct(others)}%` }}
            />
            <div
              className="bg-series-2"
              style={{ width: `${pct(team2Wins)}%` }}
            />
          </div>
          {streak && (
            <p className="text-sm text-muted-foreground">
              {streakTeam.name} have won the last {streak.count} meetings.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/** Both sides with their innings, in batting order, the loser dimmed. */
function meetingSides(m: HistoricalMatch, team1: MatchTeam, team2: MatchTeam) {
  return [team1, team2]
    .map((team) => {
      const inn = m.innings?.find((i) => i.team_id === team.id);
      return {
        order: inn?.innings_number ?? 99,
        team: teamRef(team),
        innings: inn && {
          runs: inn.total_runs,
          wickets: inn.total_wickets,
          overs: formatDecimalOvers(inn.total_overs),
        },
        dim: !!m.winning_team_id && m.winning_team_id !== team.id,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** "Autumn Cup · 20 Jul 2024": where it was played, else the venue, and when. */
function meetingContext(m: HistoricalMatch) {
  const when = m.scheduled_at
    ? new Date(m.scheduled_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return [m.tournament_snapshot?.name ?? m.venue, when]
    .filter(Boolean)
    .join(" · ");
}

function UpcomingMeeting({
  match: m,
  team1,
  team2,
}: {
  match: HistoricalMatch;
  team1: MatchTeam;
  team2: MatchTeam;
}) {
  const start = matchStart(m.scheduled_at);
  // The match's own first team is home, as on every other card.
  const [home, away] =
    m.team1_id === team1.id ? [team1, team2] : [team2, team1];
  return (
    <FixtureCard
      href={`/matches/${m.id}`}
      date={start?.date ?? "Date to be confirmed"}
      time={start?.time ?? "TBC"}
      home={teamRef(home)}
      away={teamRef(away)}
      venue={m.tournament_snapshot?.name ?? m.venue}
    />
  );
}

/**
 * One meeting as the app shows a match anywhere else: a fixture before the
 * start, otherwise both sides' scores in batting order and the result.
 */
function MeetingCard({
  match: m,
  team1,
  team2,
  current,
}: {
  match: HistoricalMatch;
  team1: MatchTeam;
  team2: MatchTeam;
  current: boolean;
}) {
  const status = m.status ?? "completed";
  if (status === "scheduled") {
    return <UpcomingMeeting match={m} team1={team1} team2={team2} />;
  }
  const sides = meetingSides(m, team1, team2);
  const note =
    status === "completed" ? m.result_description || "Match completed" : null;
  const context = meetingContext(m);
  return (
    <MatchCard
      href={`/matches/${m.id}`}
      label={matchCardLabel({
        status,
        sides: sides.map((s) => ({ name: s.team.name, innings: s.innings })),
        note: [current && "This match", note].filter(Boolean).join(". "),
      })}
      competition={
        current ? (
          <>
            <span className="font-medium text-foreground">This match</span>
            {context && ` · ${context}`}
          </>
        ) : (
          context
        )
      }
      status={status}
      first={sides[0]!}
      second={sides[1]!}
      note={note && <MatchNote tone="result">{note}</MatchNote>}
    />
  );
}
