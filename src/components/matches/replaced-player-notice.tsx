"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "~/components/ds/button";
import { removeReplacedPlayer } from "~/app/matches/mutations";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

export interface ReplacedPlayerInfo {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  /** Matches they still have; none, and they can simply go. */
  otherMatches: number;
}

/**
 * After Replace, if the player replaced never signed in they may be a
 * duplicate, and left alone they stay in the squad and in searches. With no
 * other match they can go at once; with some, a merge moves those (team
 * admins, from the squad on the team page).
 */
export function ReplacedPlayerNotice({
  matchId,
  player,
  onClose,
}: {
  matchId: string;
  player: ReplacedPlayerInfo;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { id, name, teamId, teamName, otherMatches } = player;

  const remove = () => {
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof removeReplacedPlayer>>;
      try {
        res = await removeReplacedPlayer(matchId, teamId, id);
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (!res.success) {
        setError(res.error ?? "The player could not be removed");
        return;
      }
      toast.success(`${name} removed from ${teamName}.`);
      onClose();
      router.refresh();
    });
  };

  return (
    <div
      role="status"
      className="space-y-3 rounded-xl bg-primary-soft p-4 text-sm text-primary-soft-foreground"
    >
      {otherMatches === 0 ? (
        <p>
          {name} has no other matches and has never signed in. Remove them from
          {" "}
          {teamName} so they stop turning up in searches?
        </p>
      ) : (
        <p>
          {name} has {otherMatches}{" "}
          {otherMatches === 1 ? "other match" : "other matches"} and has never
          signed in. If they are the same person, a team admin can merge them
          from the squad.
        </p>
      )}
      {error && (
        <p role="alert" className="font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {otherMatches === 0 ? (
          <Button size="sm" onClick={remove} loading={pending}>
            Remove from squad
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href={`/teams/${teamId}?tab=squad`}>Open the squad</Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
          Keep them
        </Button>
      </div>
    </div>
  );
}
