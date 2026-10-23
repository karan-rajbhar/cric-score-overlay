"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AlertTriangle } from "lucide-react";
import type { Team } from "~/lib/match-types";

interface AbandonMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team1?: Team | null;
  team2?: Team | null;
  onConfirm: (params: {
    reason: string;
    resultType: "abandoned" | "no_result" | "win";
    winningTeamId?: string | null;
    notes?: string | null;
  }) => Promise<boolean | void> | boolean | void;
  isProcessing?: boolean;
}

const ABANDON_REASONS = [
  "Rain / Inclement Weather",
  "Wet Outfield / Unfit Pitch",
  "Bad Light / Darkness",
  "Match Forfeited / Walkover",
  "Mutual Consent / Match Called Off",
  "Safety / Facility Issues",
];

export function AbandonMatchDialog({
  open,
  onOpenChange,
  team1,
  team2,
  onConfirm,
  isProcessing = false,
}: AbandonMatchDialogProps) {
  const [reason, setReason] = useState<string>(ABANDON_REASONS[0]!);
  const [resultType, setResultType] = useState<"abandoned" | "no_result" | "win">(
    "abandoned",
  );
  const [winningTeamId, setWinningTeamId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = isProcessing || saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSaving(true);
    try {
      const done = await onConfirm({
        reason,
        resultType,
        winningTeamId: resultType === "win" ? winningTeamId : null,
        notes: notes.trim() || null,
      });
      // Not saved (no connection): the form stays as it is.
      if (done !== false) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <DialogTitle className="text-lg font-semibold">
                End the match early
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Abandoned, no result, or awarded to a team (weather, light,
              a walkover).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="abandon-reason" className="text-xs font-semibold">
                Reason for abandonment
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="abandon-reason" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABANDON_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="abandon-result" className="text-xs font-semibold">
                Official result type
              </Label>
              <Select
                value={resultType}
                onValueChange={(v) =>
                  setResultType(v as "abandoned" | "no_result" | "win")
                }
              >
                <SelectTrigger id="abandon-result" className="h-9 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abandoned">
                    Abandoned (points shared / split)
                  </SelectItem>
                  <SelectItem value="no_result">
                    No result (incomplete match)
                  </SelectItem>
                  <SelectItem value="win">
                    Win by forfeiture (walkover awarded)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {resultType === "win" && (
              <div className="space-y-1.5">
                <Label htmlFor="winning-team" className="text-xs font-semibold">
                  Award win to
                </Label>
                <Select
                  value={winningTeamId}
                  onValueChange={setWinningTeamId}
                  required
                >
                  <SelectTrigger id="winning-team" className="h-9 text-xs font-semibold">
                    <SelectValue placeholder="Select winning team" />
                  </SelectTrigger>
                  <SelectContent>
                    {team1 && <SelectItem value={team1.id}>{team1.name}</SelectItem>}
                    {team2 && <SelectItem value={team2.id}>{team2.name}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="abandon-notes" className="text-xs font-semibold">
                Additional notes / umpire statement (optional)
              </Label>
              <Textarea
                id="abandon-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Match halted at 7.2 overs due to thunderstorm..."
                className="text-xs"
                rows={3}
              />
            </div>

            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              This ends the match: no more balls can be scored.
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={busy || (resultType === "win" && !winningTeamId)}
              className="font-semibold"
            >
              {busy
                ? "Saving…"
                : resultType === "win"
                  ? "Award the match"
                  : resultType === "no_result"
                    ? "End with no result"
                    : "Abandon match"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
