"use client";

import { createContext, useContext, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  foundPlayerHint,
  whyNotAddable,
  type FoundPlayer,
} from "~/lib/player-search";
import { recentPlayers } from "~/lib/recent-players";
import { cn } from "~/lib/utils";

/**
 * Says where a player stands in this box's match (their squads, who they
 * played for). The scoring screen and Replace provide it.
 */
export const PlayerDescribeContext = createContext<
  (player: FoundPlayer) => FoundPlayer
>((player) => player);

const SHOWN = 3;

/**
 * Before anything is typed: the players this device added lately, so a
 * regular is one tap away. Mounted only once someone is about to add a
 * player, so reading storage here is safe.
 */
export function RecentPlayers({
  teamName,
  exclude,
  disabled = false,
  onPick,
}: {
  teamName: string;
  /** Already listed in this box. */
  exclude?: ReadonlySet<string>;
  disabled?: boolean;
  onPick: (player: FoundPlayer) => void;
}) {
  const [stored] = useState(recentPlayers);
  const describe = useContext(PlayerDescribeContext);
  const players = stored.filter((p) => !exclude?.has(p.id)).slice(0, SHOWN);
  if (players.length === 0) return null;
  return (
    <div role="group" aria-label="Recently added" className="space-y-1">
      <p className="px-1 text-xs text-muted-foreground">Recently added</p>
      {players.map((recent) => {
        const player = describe(recent);
        const blocked = whyNotAddable(player, teamName);
        return (
          <Button
            key={player.id}
            type="button"
            variant="outline"
            className="h-auto min-h-11 w-full justify-start gap-2 py-1.5"
            disabled={disabled || blocked !== null}
            onClick={() => onPick(player)}
          >
            <UserPlus
              className={cn("h-4 w-4", blocked && "invisible")}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate">
                {blocked ? player.name : `Add ${player.name} to ${teamName}`}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {blocked ?? foundPlayerHint(player)}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
