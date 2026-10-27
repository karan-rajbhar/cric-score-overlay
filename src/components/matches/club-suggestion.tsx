"use client";

import { useState } from "react";
import { Button } from "~/components/ds/button";
import { Card, CardHeader } from "~/components/ds/card";
import { useAuth } from "~/lib/auth";
import { useClubSuggestion } from "~/lib/hooks/useMatchQueries";
import {
  MatchClubDialog,
  type MatchClubDialogMatch,
} from "./match-club-dialog";

/** Matches whose suggestion was answered "Not a club match" here. */
const DISMISSED_KEY = "cricscore:club-suggestion-dismissed";
const MAX_DISMISSED = 50;

function dismissedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function rememberDismissed(matchId: string) {
  try {
    const ids = [matchId, ...dismissedIds().filter((id) => id !== matchId)];
    window.localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify(ids.slice(0, MAX_DISMISSED)),
    );
  } catch {
    // Storage blocked: it is asked again next time.
  }
}

/**
 * "Add this match to <club>?" on a finished match that is in no club but
 * whose players have played for one of the scorer's clubs: the moment
 * someone realises it belongs there (`useClubSuggestion`). Opens the
 * "Add to club" dialog with that club; "Not a club match" stops asking on
 * this device. Renders nothing otherwise (and nothing on the server).
 */
export function ClubSuggestionCard({
  match,
  isScorer,
  onAdded,
  className,
}: {
  match: MatchClubDialogMatch & {
    status?: string | null;
    tournament_id?: string | null;
  };
  isScorer: boolean;
  onAdded?: () => void;
  className?: string;
}) {
  const { user } = useAuth();
  // Read on the client only: the card never renders before its query
  // answers, so the server's empty output and this agree.
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && dismissedIds().includes(match.id),
  );
  const { club, choosable } = useClubSuggestion(
    match,
    user?.id,
    isScorer,
    dismissed,
  );
  const [open, setOpen] = useState(false);
  if (!club && !open) return null;

  return (
    <>
      {club && (
        <Card className={className}>
          <CardHeader
            title={`Add this match to ${club.name}?`}
            description={`Its players have played for ${club.name} before. Adding it puts their stats in the club's leaderboards.`}
          />
          <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
            <Button variant="soft" size="sm" onClick={() => setOpen(true)}>
              Add to {club.name}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                rememberDismissed(match.id);
                setDismissed(true);
              }}
            >
              Not a club match
            </Button>
          </div>
        </Card>
      )}
      <MatchClubDialog
        open={open}
        onOpenChange={setOpen}
        match={match}
        clubs={choosable}
        initialClubId={club?.id}
        onSaved={onAdded}
      />
    </>
  );
}
