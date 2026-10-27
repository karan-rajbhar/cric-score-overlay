"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ds/button";
import {
  PlayerPicker,
  PlayerSearchContext,
} from "~/app/matches/[id]/score/components/PlayerPicker";
import { replacePlayerInMatch } from "~/app/matches/mutations";
import {
  addExistingPlayerQuick,
  createPlayerQuick,
  searchUsers,
} from "~/app/teams/actions";
import { partInWords, type MatchPart } from "~/lib/match-players";
import type { MatchTeam } from "~/lib/match-types";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";
import type { FoundPlayer } from "~/lib/player-search";

/**
 * Opened under a player's row on the Players page: who really played
 * instead of them (their team's squad players with no part in the match,
 * or one found / added by name), what moves across, and Replace
 * (`replacePlayerInMatch`).
 */
export function ReplacePlayerPanel({
  id,
  matchId,
  part,
  team,
  inMatch,
  onDone,
  onCancel,
}: {
  id?: string;
  matchId: string;
  /** The player recorded by mistake. */
  part: MatchPart;
  /** The team they played for, with its squad. */
  team: MatchTeam;
  /** Everyone with a part in the match (never offered: figures would merge). */
  inMatch: ReadonlySet<string>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [toId, setToId] = useState<string | null>(null);
  // Players added to the squad from here, listed at once.
  const [added, setAdded] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const candidates = useMemo(() => {
    const squad = (team.team_players ?? [])
      .filter((tp) => !inMatch.has(tp.user_id))
      .map((tp) => ({ id: tp.user_id, name: tp.user?.full_name ?? "Player" }));
    return [...squad, ...added.filter((a) => !squad.some((s) => s.id === a.id))];
  }, [team, inMatch, added]);
  const to = candidates.find((c) => c.id === toId) ?? null;

  // Existing players for "Add", leaving out everyone already listed.
  const findPlayers = useCallback(
    async (query: string): Promise<FoundPlayer[]> => {
      const { data } = await searchUsers(query);
      return (
        (data ?? []) as {
          id: string;
          full_name: string | null;
          username?: string | null;
          matches?: number;
        }[]
      )
        .filter((u) => !inMatch.has(u.id) && !candidates.some((c) => c.id === u.id))
        .map((u) => ({
          id: u.id,
          name: u.full_name ?? "Player",
          username: u.username,
          matches: u.matches,
        }));
    },
    [inMatch, candidates],
  );

  const addToSquad = async (name: string, existingId?: string) => {
    setError(null);
    try {
      const res = existingId
        ? await addExistingPlayerQuick(team.id, existingId, matchId)
        : await createPlayerQuick(team.id, name, matchId);
      if (res.error || !res.data) {
        setError(res.error ?? "The player could not be added");
        return null;
      }
      const player = { id: res.data.user_id, name: res.data.full_name };
      setAdded((prev) => [...prev, player]);
      return player.id;
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      return null;
    }
  };

  const replace = () => {
    if (!to) return;
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof replacePlayerInMatch>>;
      try {
        res = await replacePlayerInMatch(matchId, part.id, to.id);
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (!res.success) {
        setError(res.error ?? "The player could not be replaced");
        return;
      }
      toast.success(`${part.name} replaced with ${to.name}.`);
      onDone();
    });
  };

  const question = `Who really played instead of ${part.name}?`;
  return (
    <div id={id} className="space-y-3 bg-muted/40 px-4 py-3.5">
      <p className="text-sm font-medium text-foreground">{question}</p>
      <PlayerSearchContext.Provider value={findPlayers}>
        <PlayerPicker
          label={question}
          rows={candidates}
          selectedId={toId}
          onSelect={setToId}
          addPlayer={{ teamName: team.name, onAdd: addToSquad }}
          emptyMessage={`Everyone in ${team.name}'s squad has a part in this match. Type a name to add the player who played.`}
        />
      </PlayerSearchContext.Provider>
      {to && (
        <p className="rounded-lg bg-primary-soft px-3.5 py-3 text-sm text-primary-soft-foreground">
          {part.name}&apos;s {partInWords(part)} in this match move to{" "}
          {to.name}. The score stays the same, and {part.name} stays in the
          squad.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={replace} loading={pending} disabled={!to}>
          Replace
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
