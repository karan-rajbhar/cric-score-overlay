"use client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
    Dialog,
    DialogContent,
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
import type { TeamPlayer } from "~/lib/match-types";

interface BowlerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bowlingTeamPlayers: TeamPlayer[];
    currentBowlerId: string | null;
    onBowlerChange: (v: string) => void;
    onConfirm: () => void;
    isProcessing: boolean;
    addPlayerTarget: string | null;
    newPlayerName: string;
    onNewPlayerNameChange: (v: string) => void;
    onAddPlayer: () => void;
    onAddPlayerTargetChange: (v: "batting" | "bowling" | null) => void;
}

export function BowlerDialog({
    open,
    onOpenChange,
    bowlingTeamPlayers,
    currentBowlerId,
    onBowlerChange,
    onConfirm,
    isProcessing,
    addPlayerTarget,
    newPlayerName,
    onNewPlayerNameChange,
    onAddPlayer,
    onAddPlayerTargetChange,
}: BowlerDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Bowler</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <Select value={currentBowlerId || ""} onValueChange={onBowlerChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select bowler" />
                        </SelectTrigger>
                        <SelectContent>
                            {bowlingTeamPlayers.map((player) => (
                                <SelectItem key={player.user_id} value={player.user_id}>
                                    {player.user?.full_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {addPlayerTarget === "bowling" ? (
                        <div className="flex gap-2">
                            <Input
                                placeholder="Player name"
                                value={newPlayerName}
                                onChange={(e) => onNewPlayerNameChange(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && void onAddPlayer()}
                            />
                            <Button type="button" variant="secondary" onClick={() => void onAddPlayer()} disabled={!newPlayerName.trim() || isProcessing}>
                                Add
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => onAddPlayerTargetChange(null)}>
                                ✕
                            </Button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onAddPlayerTargetChange("bowling")}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            <UserPlus className="h-3.5 w-3.5" /> New player? Add to squad
                        </button>
                    )}

                    <Button className="w-full" onClick={onConfirm} disabled={!currentBowlerId || isProcessing}>
                        Confirm
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
