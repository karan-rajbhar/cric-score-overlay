"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import type { PlayAction } from "~/app/matches/mutations";
import type { PlayBreak } from "~/lib/firebase/types";
import { playBreakName } from "~/lib/multi-innings";

interface PlayBreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The break on now, if any. */
  playBreak: PlayBreak | null | undefined;
  /** The day of play (1 on the first). */
  day: number;
  /** The days the match is scheduled for. */
  days: number | null;
  onChoose: (action: PlayAction) => void;
  isProcessing?: boolean;
}

/**
 * Lunch, tea and stumps in a two-innings match, and play again after them.
 * Viewers see the break on the match page and the overlay; scoring waits
 * until play resumes.
 */
export function PlayBreakDialog({
  open,
  onOpenChange,
  playBreak,
  day,
  days,
  onChoose,
  isProcessing = false,
}: PlayBreakDialogProps) {
  const choose = (action: PlayAction) => {
    onOpenChange(false);
    onChoose(action);
  };
  const lastDay = days !== null && day >= days;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-balance">
            {playBreak
              ? `${playBreakName(playBreak)}, day ${day}`
              : `Break in play, day ${day}`}
          </DialogTitle>
          <DialogDescription>
            {playBreak === "stumps"
              ? lastDay
                ? "That was the last scheduled day. If time has run out, draw the match from Match tools; otherwise start another day."
                : `Start day ${day + 1} when play begins.`
              : playBreak
                ? "Resume when the players are back on the field."
                : "Viewers see the break on the match page and the overlay. Scoring waits until play resumes."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {playBreak === "stumps" ? (
            <>
              <Button
                onClick={() => choose("next_day")}
                disabled={isProcessing}
                className="min-h-11"
              >
                Start day {day + 1}
              </Button>
              <Button
                variant="outline"
                onClick={() => choose("resume")}
                disabled={isProcessing}
                className="min-h-11"
              >
                Stumps by mistake: play on, day {day}
              </Button>
            </>
          ) : playBreak ? (
            <Button
              onClick={() => choose("resume")}
              disabled={isProcessing}
              className="min-h-11"
            >
              Resume play
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => choose("lunch")}
                disabled={isProcessing}
                className="min-h-11"
              >
                Lunch
              </Button>
              <Button
                variant="outline"
                onClick={() => choose("tea")}
                disabled={isProcessing}
                className="min-h-11"
              >
                Tea
              </Button>
              <Button
                onClick={() => choose("stumps")}
                disabled={isProcessing}
                className="min-h-11"
              >
                Stumps (end of day {day})
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
