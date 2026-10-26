import Link from "next/link";
import { CalendarDays, Hand, Target, TrendingUp } from "lucide-react";
import { TeamCrest } from "~/components/ds/avatar";
import { Card, CardHeader } from "~/components/ds/card";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import { formatPlayerRole } from "~/lib/cricket";
import type { PlayerTeamMembership } from "./player-activity-tabs";

/** The player's teams as white pills: crest, name, shirt number, role. */
export function ProfileTeams({
  teams,
  tournamentId,
}: {
  teams: PlayerTeamMembership[];
  tournamentId?: string;
}) {
  if (teams.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {teams.map((tm) => (
        <li key={tm.id}>
          <Link
            href={`/teams/${tm.team.id}${tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : ""}`}
            className="inline-flex max-w-full items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 text-sm font-medium text-foreground shadow-soft ring-1 ring-border/40 transition-colors hover:bg-accent"
          >
            <TeamCrest
              name={tm.team.name}
              shortName={tm.team.short_name}
              logoUrl={tm.team.logo_url}
              size="xs"
            />
            <span className="truncate">{tm.team.name}</span>
            {tm.jersey_number != null && (
              <span className="font-score tabular-nums text-muted-foreground">
                #{tm.jersey_number}
              </span>
            )}
            {tm.role_in_team && (
              <span className="text-xs font-normal text-muted-foreground">
                {formatPlayerRole(tm.role_in_team)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The headline figures as stat tiles. */
export function ProfileHighlights({
  matches,
  runs,
  wickets,
  catches,
}: {
  matches: number;
  runs: number;
  wickets: number;
  /** Absent for a season: catches are kept for the whole career only. */
  catches?: number;
}) {
  return (
    <StatGrid className={catches === undefined ? "sm:grid-cols-3" : undefined}>
      <StatTile icon={CalendarDays} label="Matches" value={matches} />
      <StatTile icon={TrendingUp} label="Runs" value={runs} />
      <StatTile icon={Target} label="Wickets" value={wickets} />
      {catches !== undefined && (
        <StatTile icon={Hand} label="Catches" value={catches} />
      )}
    </StatGrid>
  );
}

export type Figure = [label: string, value: string | number];

/** One discipline's career figures: a card of small labelled figures. */
function FigureCard({ title, figures }: { title: string; figures: Figure[] }) {
  return (
    <Card>
      <CardHeader title={title} className="pb-3" />
      <dl className="grid grid-cols-3 gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-score text-xl font-semibold tabular-nums text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function CareerCards({
  batting,
  bowling,
  fielding,
}: {
  batting: Figure[];
  bowling: Figure[];
  /** Absent for a season: fielding is kept for the whole career only. */
  fielding?: Figure[];
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 ${fielding ? "md:grid-cols-3" : "md:grid-cols-2"}`}
    >
      <FigureCard title="Batting" figures={batting} />
      <FigureCard title="Bowling" figures={bowling} />
      {fielding && <FigureCard title="Fielding" figures={fielding} />}
    </div>
  );
}
