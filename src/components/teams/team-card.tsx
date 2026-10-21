import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TeamCrest } from "~/components/ds/avatar";
import { cardSurface } from "~/components/ds/card";
import { formatTeamType } from "~/lib/cricket";
import { cn } from "~/lib/utils";

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    short_name?: string;
    logo_url?: string | null;
    description?: string;
    player_count?: number;
    team_type?: string;
  };
}

/** A team in a list: crest, name, squad size and type; the card is the link. */
export function TeamCard({ team }: TeamCardProps) {
  const players = team.player_count ?? 0;
  return (
    <Link
      href={`/teams/${team.id}`}
      className={cn(
        cardSurface,
        "flex h-full items-center gap-3 p-4 transition-colors hover:bg-accent/40",
      )}
    >
      <TeamCrest
        name={team.name}
        shortName={team.short_name}
        logoUrl={team.logo_url}
        size="lg"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-foreground">
          {team.name}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {players} {players === 1 ? "player" : "players"} ·{" "}
          {formatTeamType(team.team_type)}
        </span>
        {team.description && (
          <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
            {team.description}
          </span>
        )}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}
