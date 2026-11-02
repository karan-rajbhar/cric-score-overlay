"use client";

import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { Card } from "~/components/ds/card";
import { ListCard } from "~/components/ds/list";
import { formatPlayerRole } from "~/lib/cricket";
import type { Match, MatchTeam } from "~/lib/match-types";
import { teamRef } from "./match-hero";

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

/** Both squads, side by side from tablets up. */
export function MatchSquads({ match }: { match: Match }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Squad team={match.team1} />
      <Squad team={match.team2} />
    </div>
  );
}
