"use client";

import type * as React from "react";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { Card, CardHeader } from "~/components/ds/card";
import { ListCard } from "~/components/ds/list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Match, MatchTeam } from "~/lib/match-types";
import { formatPlayerRole } from "~/lib/cricket";
import { clubStatsFact } from "~/lib/club-side-text";
import { teamRef } from "./match-hero";

interface MatchInfoProps {
  match: Match;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type Fact = [label: string, value: React.ReactNode];

/** The facts that apply (a falsy entry is left out). */
const rows = (...entries: (Fact | false | null | undefined | "")[]) =>
  entries.filter((e): e is Fact => Boolean(e));

/** Label on the left, value on the right; the rows split by hairlines. */
function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="divide-y divide-border px-4 pb-2 sm:px-5">
      {facts.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-4 py-2.5"
        >
          <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-right text-sm font-medium text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A side's squad in batting order: picture, name, role, shirt number. */
function Squad({ team }: { team: MatchTeam }) {
  const players = [...(team.team_players ?? [])].sort(
    (a, b) => (a.batting_order || 99) - (b.batting_order || 99),
  );
  return (
    <section aria-label={`${team.name} squad`} className="space-y-2">
      <div className="flex items-center gap-2.5 px-1">
        <TeamCrest {...teamRef(team)} size="sm" />
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {team.name}
        </h3>
        {players.length > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {players.length} players
          </span>
        )}
      </div>
      {players.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Squad not announced yet
        </Card>
      ) : (
        <ListCard>
          {players.map((tp) => (
            <div
              key={tp.id}
              className="flex min-h-12 items-center gap-3 px-4 py-2"
            >
              <Avatar
                name={tp.user?.full_name ?? "Player"}
                src={tp.user?.avatar_url}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {tp.user?.full_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatPlayerRole(tp.role_in_team)}
                </span>
              </span>
              {tp.jersey_number != null && (
                <span className="shrink-0 font-score text-sm tabular-nums text-muted-foreground">
                  #{tp.jersey_number}
                </span>
              )}
            </div>
          ))}
        </ListCard>
      )}
    </section>
  );
}

/**
 * Whose stats count for the club (`club_side`), so anyone can see why a
 * player of an outside team is missing from the club's leaderboards.
 */
function ClubStatsFact({ match }: { match: MatchInfoProps["match"] }) {
  const { counts, outside } = clubStatsFact(
    match.club_side,
    match.team1.name,
    match.team2.name,
  );
  return (
    <>
      {counts}
      {outside && (
        <span className="block text-xs font-normal text-muted-foreground">
          {outside}: outside team
        </span>
      )}
    </>
  );
}

/** Info: the match's details and conditions, and both squads. */
export function MatchInfo({ match }: MatchInfoProps) {
  const tossWinner =
    match.toss_winner_team_id === match.team1_id
      ? match.team1.name
      : match.toss_winner_team_id === match.team2_id
        ? match.team2.name
        : null;

  const details = rows(
    ["Format", match.match_format],
    ["Overs", `${match.overs_per_innings} overs per innings`],
    match.dls_revision && [
      "Revised target (DLS)",
      `${match.dls_revision.target_runs} runs in ${match.dls_revision.overs} overs`,
    ],
    match.ball_type && [
      "Ball",
      <span key="b" className="capitalize">
        {match.ball_type}
      </span>,
    ],
    ["Venue", match.venue || "Not specified"],
    match.scheduled_at && [
      "Date and time",
      `${formatDate(match.scheduled_at)}, ${formatTime(match.scheduled_at)}`,
    ],
    match.actual_start_time && ["Started", formatTime(match.actual_start_time)],
    match.tournament && ["Tournament", match.tournament.name],
    match.club && ["Club", match.club.name],
    match.club && ["Club stats count", <ClubStatsFact key="cs" match={match} />],
  );
  const conditions = rows(
    [
      "Toss",
      tossWinner
        ? `${tossWinner} won the toss and elected to ${match.toss_decision === "bowl" ? "bowl" : "bat"}`
        : "Not done yet",
    ],
    match.weather_conditions && ["Weather", match.weather_conditions],
    match.pitch_conditions && ["Pitch", match.pitch_conditions],
    (match.umpire1_name || match.umpire2_name) && [
      "Umpires",
      [match.umpire1_name, match.umpire2_name].filter(Boolean).join(", "),
    ],
    [
      "Match ID",
      <span key="id" className="break-all font-mono text-xs">
        {match.id}
      </span>,
    ],
  );

  return (
    <Tabs defaultValue="match-info" className="w-full">
      <TabsList aria-label="Info sections" className="mb-4">
        <TabsTrigger value="match-info">Match info</TabsTrigger>
        <TabsTrigger value="squads">Squads</TabsTrigger>
      </TabsList>

      <TabsContent value="match-info">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Match details" className="pb-1" />
            <Facts facts={details} />
          </Card>
          <Card>
            <CardHeader title="Toss and conditions" className="pb-1" />
            <Facts facts={conditions} />
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="squads">
        <div className="grid gap-6 md:grid-cols-2">
          <Squad team={match.team1} />
          <Squad team={match.team2} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
