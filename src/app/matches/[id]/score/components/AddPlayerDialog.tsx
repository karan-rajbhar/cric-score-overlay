"use client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import { UserPlus } from "lucide-react";

interface AddPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string | undefined;
  bowlingTeamName: string | undefined;
  addPlayerTeam: "batting" | "bowling";
  onTeamChange: (v: "batting" | "bowling") => void;
  newPlayerName: string;
  onNameChange: (v: string) => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function AddPlayerDialog({
  open,
  onOpenChange,
  teamName,
  bowlingTeamName,
  addPlayerTeam,
  onTeamChange,
  newPlayerName,
  onNameChange,
  onConfirm,
  isProcessing,
}: AddPlayerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Player to Squad</DialogTitle>
          <DialogDescription>
            Quickly add a player into the batting or bowling team roster for
            this match.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium">Team</label>
            <Select
              value={addPlayerTeam}
              onValueChange={(v) => onTeamChange(v as never)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="batting">
                  {teamName ?? "Batting team"}
                </SelectItem>
                <SelectItem value="bowling">
                  {bowlingTeamName ?? "Bowling team"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Player name</label>
            <Input
              placeholder="e.g., Virat Kohli"
              value={newPlayerName}
              onChange={(e) => onNameChange(e.target.value)}
              className="mt-2"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void onConfirm()}
            />
          </div>
          <Button
            className="w-full"
            onClick={onConfirm}
            disabled={!newPlayerName.trim() || isProcessing}
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Add to{" "}
            {addPlayerTeam === "batting" ? teamName : bowlingTeamName}
          </Button>
          <p className="text-xs text-muted-foreground">
            Like Stumps/Cricheroes — add players anytime, even mid-over.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
