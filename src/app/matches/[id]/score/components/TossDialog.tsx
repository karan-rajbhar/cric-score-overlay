"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Loader2, Play } from "lucide-react";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Toss</DialogTitle>
          <DialogDescription>
            Record the toss winner and elected decision (bat or bowl) to
            commence the match.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium">Won by</label>
            <Select value={tossWinner} onValueChange={onTossWinnerChange}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={match.team1.id}>
                  {match.team1.name}
                </SelectItem>
                <SelectItem value={match.team2.id}>
                  {match.team2.name}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Elected to</label>
            <Select value={tossDecision} onValueChange={onTossDecisionChange}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bat">Bat</SelectItem>
                <SelectItem value="bowl">Bowl</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full h-11 min-h-[44px] text-sm font-bold shadow-md"
            onClick={onConfirm}
            disabled={!tossWinner || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start Match
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
