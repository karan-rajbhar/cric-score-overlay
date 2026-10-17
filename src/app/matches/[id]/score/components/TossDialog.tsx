"use client";

import { useId } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { segmentedItem, segmentedTrack } from "~/components/ui/segmented";
import { cn } from "~/lib/utils";
import { Loader2 } from "lucide-react";

interface TossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    team1: { id: string; name: string };
    team2: { id: string; name: string };
  };
  tossWinner: string;
  tossDecision: string;
  onTossWinnerChange: (v: string) => void;
  onTossDecisionChange: (v: string) => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

/** Two taps: who won the toss, then bat or bowl. */
export function TossDialog({
  open,
  onOpenChange,
  match,
  tossWinner,
  tossDecision,
  onTossWinnerChange,
  onTossDecisionChange,
  onConfirm,
  isProcessing,
}: TossDialogProps) {
  const winnerLabel = useId();
  const decisionLabel = useId();
  const statusId = useId();
  const teams = [match.team1, match.team2];
  const winner = teams.find((t) => t.id === tossWinner);
  const loser = teams.find((t) => t.id !== tossWinner);
  const batting = winner
    ? tossDecision === "bat"
      ? winner
      : loser
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Toss</DialogTitle>
          <DialogDescription>
            Record the toss to start the match. The opening batters and
            bowler come next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p id={winnerLabel} className="text-sm font-medium">
              Who won the toss?
            </p>
            <div
              role="radiogroup"
              aria-labelledby={winnerLabel}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {teams.map((team) => {
                const active = team.id === tossWinner;
                return (
                  <button
                    key={team.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onTossWinnerChange(team.id)}
                    className={cn(
                      "min-h-12 min-w-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    <span className="line-clamp-2 break-words">{team.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p id={decisionLabel} className="text-sm font-medium">
              They chose to
            </p>
            <div
              role="radiogroup"
              aria-labelledby={decisionLabel}
              className={cn(segmentedTrack, "mt-2 sm:flex sm:w-full")}
            >
              {(
                [
                  ["bat", "Bat"],
                  ["bowl", "Bowl"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={tossDecision === value}
                  onClick={() => onTossDecisionChange(value)}
                  className={segmentedItem(
                    tossDecision === value,
                    "min-h-11 sm:min-h-10 sm:flex-1",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p
            id={statusId}
            className="text-sm text-muted-foreground"
            aria-live="polite"
          >
            {winner && batting
              ? `${winner.name} won the toss and chose to ${tossDecision}. ${batting.name} bat first.`
              : "Choose who won the toss."}
          </p>
          <Button
            className="h-12 w-full text-sm font-semibold"
            onClick={onConfirm}
            disabled={!winner || isProcessing}
            aria-describedby={statusId}
          >
            {isProcessing && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Start match
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
