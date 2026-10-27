"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ds/button";
import { ChoiceGroup } from "~/components/ds/field";
import { ClubSideChoice } from "./club-side-choice";
import { setMatchClub } from "~/app/matches/club";
import { guessClubSide, type MyClub } from "~/app/matches/club-data";
import type { ClubSide } from "~/lib/firebase/types";
import { useClubRecordsQuery } from "~/lib/hooks/useMatchQueries";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

interface ClubDialogTeam {
  id: string;
  name: string;
  team_players?: { user_id: string }[];
}

export interface MatchClubDialogMatch {
  id: string;
  club_id?: string | null;
  club_side?: ClubSide | null;
  team1: ClubDialogTeam;
  team2: ClubDialogTeam;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_CLUB = "none";
const playerIds = (team: ClubDialogTeam) =>
  (team.team_players ?? []).map((p) => p.user_id);

/**
 * "Add to club": puts a match that was started without one into a club
 * (or moves it, or takes it out), and asks whose stats count for the club,
 * so an outside team's players stay out of its statistics. The answer
 * starts from who has played for the club before (`guessClubSide`).
 */
export function MatchClubDialog({
  open,
  onOpenChange,
  match,
  clubs,
  loading = false,
  initialClubId,
  onSaved,
}: DialogProps & {
  match: MatchClubDialogMatch;
  /** The clubs the user may choose (`clubsForMatch`). */
  clubs: readonly MyClub[];
  /** The clubs are still being read. */
  loading?: boolean;
  /** The club to start with for a match in none (a suggestion). */
  initialClubId?: string;
  onSaved?: () => void;
}) {
  if (!clubs.length && !match.club_id) {
    return loading ? (
      <LoadingClubs open={open} onOpenChange={onOpenChange} />
    ) : (
      <NoClubNotice open={open} onOpenChange={onOpenChange} />
    );
  }
  return (
    <ClubForm
      open={open}
      onOpenChange={onOpenChange}
      match={match}
      clubs={clubs}
      initialClubId={initialClubId}
      onSaved={onSaved}
    />
  );
}

/** While the user's clubs are read (a moment, after the menu opened). */
function LoadingClubs({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-panel shadow-float sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a club</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading your clubs
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

/** A scorer who belongs to no club: say how, instead of hiding the action. */
function NoClubNotice({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-panel shadow-float sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a club</DialogTitle>
          <DialogDescription>
            Only members of a club can add matches to it. Join the club from
            its page, or ask one of its admins to add this match.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <Link href="/clubs">Find your club</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClubForm({
  open,
  onOpenChange,
  match,
  clubs,
  initialClubId,
  onSaved,
}: DialogProps & {
  match: MatchClubDialogMatch;
  clubs: readonly MyClub[];
  initialClubId?: string;
  onSaved?: () => void;
}) {
  const current = match.club_id ?? null;
  const firstClub =
    current ?? initialClubId ?? (clubs.length === 1 ? clubs[0]!.id : "");
  const [clubId, setClubId] = useState<string>(firstClub);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Each opening starts from the match as it is now.
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setClubId(firstClub);
      setError(null);
    }
  }

  const chosen = clubId && clubId !== NO_CLUB ? clubId : null;
  const { side, choose } = useClubSide(match, chosen, open);
  const nameOf = (id: string | null) =>
    clubs.find((c) => c.id === id)?.name ?? "the club";
  const unchanged =
    chosen === current && (!chosen || side === (match.club_side ?? "both"));
  const ready = (chosen ? side !== null : current !== null) && !unchanged;

  const save = () => {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof setMatchClub>>;
      try {
        res = await setMatchClub(match.id, chosen, side ?? "both");
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(
        chosen
          ? `Added to ${nameOf(chosen)}. Its stats are up to date.`
          : `Removed from ${nameOf(current)}.`,
      );
      onOpenChange(false);
      onSaved?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-panel shadow-float sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {current
              ? "Club"
              : clubs.length === 1
                ? `Add to ${clubs[0]!.name}`
                : "Add to a club"}
          </DialogTitle>
          <DialogDescription>
            A club match counts in the club&apos;s leaderboards and stats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* With one club and none yet, there is nothing to choose. */}
          {(current || clubs.length > 1) && (
            <ChoiceGroup
              legend="Which club is this match for?"
              name="match-club"
              value={clubId || null}
              onChange={setClubId}
              options={clubOptions(clubs, current && nameOf(current))}
              layout={current ? "cards" : "pills"}
            />
          )}
          {chosen && (
            <ClubSideChoice
              name="match-club-side"
              clubName={nameOf(chosen)}
              team1Name={match.team1.name}
              team2Name={match.team2.name}
              value={side}
              onChange={choose}
            />
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={save} loading={pending} disabled={!ready}>
            {saveLabel(chosen, current, nameOf)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Whose stats count for the chosen club: the user's own answer for that
 * club, else the match's own (the club it is in) or the guess from who has
 * played for the club before (null while that loads).
 */
function useClubSide(
  match: MatchClubDialogMatch,
  chosen: string | null,
  open: boolean,
) {
  const [choice, setChoice] = useState<{ club: string; side: ClubSide } | null>(
    null,
  );
  const inClub = chosen === (match.club_id ?? null);
  const guessFor = open && chosen && !inClub ? chosen : "";
  const ids1 = playerIds(match.team1);
  const ids2 = playerIds(match.team2);
  const known1 = useClubRecordsQuery(guessFor, ids1).data;
  const known2 = useClubRecordsQuery(guessFor, ids2).data;
  const starting = inClub
    ? (match.club_side ?? "both")
    : guessClubSide(ids1.length ? known1 : false, ids2.length ? known2 : false);
  return {
    side: choice && choice.club === chosen ? choice.side : starting,
    choose: (side: ClubSide) => chosen && setChoice({ club: chosen, side }),
  };
}

function clubOptions(clubs: readonly MyClub[], currentName: string | null) {
  const options: { value: string; label: string; description?: string }[] =
    clubs.map((c) => ({ value: c.id, label: c.name }));
  if (currentName) {
    options.push({
      value: NO_CLUB,
      label: "No club",
      description: `The match leaves ${currentName}'s stats.`,
    });
  }
  return options;
}

function saveLabel(
  chosen: string | null,
  current: string | null,
  nameOf: (id: string | null) => string,
): string {
  if (chosen) return chosen === current ? "Save" : `Add to ${nameOf(chosen)}`;
  return current ? `Remove from ${nameOf(current)}` : "Add to club";
}
