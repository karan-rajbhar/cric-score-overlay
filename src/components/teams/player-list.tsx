"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Avatar } from "~/components/ds/avatar";
import { ListCard } from "~/components/ds/list";
import { Button } from "~/components/ui/button";
import { MoreHorizontal, Trash2, UserCheck, Users } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { removePlayerFromTeam, updatePlayerRole } from "~/app/teams/actions";
import { roleMark, squadRoleLine } from "~/lib/cricket";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ClaimProfileDialog } from "~/components/teams/claim-profile-dialog";
import { MergePlayerDialog } from "~/components/teams/merge-player-dialog";
import type { PlayerClaim } from "~/lib/squad-claims";
import { possibleDuplicates, type DuplicatePair } from "~/lib/player-search";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

const ROLE_LABEL: Record<string, string> = {
  captain: "captain",
  vice_captain: "vice-captain",
  wicket_keeper: "wicket-keeper",
  player: "a regular player",
};

interface Player {
  id: string; // team_players id
  user_id: string;
  role_in_team?: string;
  jersey_number?: number;
  user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface PlayerListProps {
  teamId: string;
  teamName?: string;
  players: Player[];
  /**
   * Squad players without an account, for team admins only (others get
   * none): "Not on CricScore", or invited to claim the profile.
   */
  claims?: Record<string, PlayerClaim>;
  allowEdit?: boolean;
}

/** Captain, vice-captain and keeper head the list; the rest keep their order. */
const ROLE_RANK: Record<string, number> = {
  captain: 0,
  vice_captain: 1,
  wicket_keeper: 2,
};
const rankOf = (role?: string) => ROLE_RANK[role ?? ""] ?? 3;

/** The roles a squad row's menu offers, in this order. */
const SQUAD_ROLES = [
  ["captain", "Captain"],
  ["vice_captain", "Vice-captain"],
  ["wicket_keeper", "Wicket-keeper"],
  ["player", "Player"],
] as const;

export function PlayerList({
  teamId,
  teamName = "the team",
  players,
  claims = {},
  allowEdit = false,
}: PlayerListProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [merging, setMerging] = useState<{
    id: string;
    name: string;
    suggestion?: string;
  } | null>(
    null,
  );
  const [claiming, setClaiming] = useState<{ id: string; name: string } | null>(
    null,
  );

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdating(userId);
    try {
      const result = await updatePlayerRole(teamId, userId, role);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Now ${ROLE_LABEL[role] ?? "a regular player"}`);
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this player from the squad? Their past matches stay."))
      return;

    setUpdating(userId);
    try {
      const result = await removePlayerFromTeam(teamId, userId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Player removed from the squad");
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setUpdating(null);
    }
  };

  if (!players || players.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No players in this squad yet"
        description={
          allowEdit
            ? "Add players, then choose the captain, vice-captain and keeper."
            : "No players have been added to this squad yet."
        }
      />
    );
  }
  const claimOf = (userId: string) => claims[userId];
  // Array sort is stable: the rest keep the squad's own order.
  const ordered = [...players].sort(
    (a, b) => rankOf(a.role_in_team) - rankOf(b.role_in_team),
  );
  // Mark the fewer: when most of the squad has no account (a club's usual
  // squad), say so once and mark the ones who are on CricScore instead of
  // repeating "Not on CricScore" on nearly every row.
  const placeholders = players.filter(
    (p) => claimOf(p.user_id)?.state === "placeholder",
  ).length;
  const markAccounts = placeholders > 0 && placeholders * 2 > players.length;

  return (
    <>
    {allowEdit && (
      <PossibleDuplicates
        teamId={teamId}
        players={players.map((p) => ({
          id: p.user_id,
          name: p.user?.full_name ?? "Player",
        }))}
        isPlaceholder={(id) => claimOf(id)?.state === "placeholder"}
        onCheck={(pair) =>
          setMerging({
            id: pair.duplicate.id,
            name: pair.duplicate.name,
            suggestion: pair.keeper.name,
          })
        }
      />
    )}
    {markAccounts && (
      <p className="mb-2 px-1 text-xs text-muted-foreground">
        {placeholders} of {players.length} players are not on CricScore yet.
        Invite one to claim their profile from the ⋯ beside their name.
      </p>
    )}
    <ListCard aria-label="Squad">
      {ordered.map((player) => {
        const name = player.user?.full_name ?? "Player";
        const roleLine = squadRoleLine(player.role_in_team);
        return (
          <div
            key={player.id}
            className="flex min-h-14 items-center gap-3 px-4 py-2 [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto]"
          >
            {/* The avatar and the lines are the link, the whole row's
                width short of the menu: not the 20px name alone (P8). */}
            <Link
              href={`/players/${player.user_id}`}
              prefetch={false}
              className="-my-2 -ml-4 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pl-4 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
            <Avatar name={name} src={player.user?.avatar_url} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {name}
                {/* The role as one mark after the name, as on the match's
                    Squads (P7). */}
                {roleMark(player.role_in_team)}
              </span>
              {roleLine && (
                <span className="block truncate text-xs text-muted-foreground">
                  {roleLine}
                </span>
              )}
              {!markAccounts &&
                claimOf(player.user_id)?.state === "placeholder" && (
                  <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Not on CricScore
                  </span>
                )}
              {markAccounts && !claimOf(player.user_id) && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  On CricScore
                </span>
              )}
              {claimOf(player.user_id)?.state === "invited" && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Invite sent to{" "}
                  {(claimOf(player.user_id) as { maskedEmail: string }).maskedEmail}
                  , not signed in yet
                </span>
              )}
            </span>
            {player.jersey_number != null && (
              <span className="shrink-0 pr-1 font-score text-sm tabular-nums text-muted-foreground">
                <span className="sr-only">Shirt number </span>#
                {player.jersey_number}
              </span>
            )}
            </Link>
            {allowEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Player actions for ${name}`}
                    disabled={updating === player.user_id}
                  >
                    {updating === player.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* The role as a choice with the current one ticked, so
                      the keeper is not offered "Make wicket-keeper" (P8). */}
                  <DropdownMenuLabel>Role</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={player.role_in_team || "player"}
                    onValueChange={(role) => {
                      if (role !== (player.role_in_team || "player")) {
                        void handleRoleChange(player.user_id, role);
                      }
                    }}
                  >
                    {SQUAD_ROLES.map(([role, label]) => (
                      <DropdownMenuRadioItem key={role} value={role}>
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  {claimOf(player.user_id) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() =>
                          setClaiming({ id: player.user_id, name })
                        }
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        {claimOf(player.user_id)?.state === "invited"
                          ? "Change or remove invite"
                          : "Invite to claim profile"}
                      </DropdownMenuItem>
                    </>
                  )}
                  {claimOf(player.user_id)?.state === "placeholder" && (
                    <DropdownMenuItem
                      onSelect={() => setMerging({ id: player.user_id, name })}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Same person as someone else
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleRemove(player.user_id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remove from squad
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </ListCard>
    {merging && (
      <MergePlayerDialog
        open
        onOpenChange={(open) => {
          if (!open) setMerging(null);
        }}
        teamId={teamId}
        player={merging}
        suggestion={merging.suggestion}
      />
    )}
    {claiming && (
      <ClaimProfileDialog
        open
        onOpenChange={(open) => {
          if (!open) setClaiming(null);
        }}
        team={{ id: teamId, name: teamName }}
        player={claiming}
        invitedAs={(() => {
          const claim = claimOf(claiming.id);
          return claim?.state === "invited" ? claim.maskedEmail : null;
        })()}
      />
    )}
    </>
  );
}

const noSubscribe = () => () => {};

/** Pairs dismissed on this device ("Not the same"), per team. */
const dismissedKey = (teamId: string) => `cric_dup_dismissed_${teamId}`;
const pairKey = (pair: DuplicatePair) => `${pair.duplicate.id}:${pair.keeper.id}`;

function readDismissed(teamId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(dismissedKey(teamId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Squad players added by name who may be someone else in the squad
 * (`possibleDuplicates`): each pair with Check, which opens the merge on
 * it, and Not the same, remembered on this device. For team admins.
 */
function PossibleDuplicates({
  teamId,
  players,
  isPlaceholder,
  onCheck,
}: {
  teamId: string;
  players: { id: string; name: string }[];
  isPlaceholder: (id: string) => boolean;
  onCheck: (pair: DuplicatePair) => void;
}) {
  // localStorage is the browser's: nothing on the server render.
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [dismissedNow, setDismissed] = useState<Set<string> | null>(null);
  if (!mounted) return null;
  const dismissed = dismissedNow ?? readDismissed(teamId);
  const pairs = possibleDuplicates(players, isPlaceholder).filter(
    (p) => !dismissed.has(pairKey(p)),
  );
  if (pairs.length === 0) return null;
  const dismiss = (pair: DuplicatePair) => {
    const next = new Set(dismissed).add(pairKey(pair));
    setDismissed(next);
    try {
      window.localStorage.setItem(dismissedKey(teamId), JSON.stringify([...next]));
    } catch {
      // Storage blocked: dismissed for this visit only.
    }
  };
  return (
    <section
      aria-labelledby={`dups-${teamId}`}
      className="mb-3 space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3"
    >
      <h3 id={`dups-${teamId}`} className="text-sm font-semibold">
        Possible duplicates
      </h3>
      <p className="text-xs text-muted-foreground">
        Added by name, they may be someone already in the squad. The same
        person twice splits their records.
      </p>
      <ul className="space-y-1.5">
        {pairs.map((pair) => (
          <li
            key={pairKey(pair)}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="min-w-0 text-sm">
              {pair.duplicate.name} and {pair.keeper.name}
            </span>
            <span className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => onCheck(pair)}>
                Check
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss(pair)}>
                Not the same
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
