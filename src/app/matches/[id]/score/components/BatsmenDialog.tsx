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

interface BatsmenDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    battingTeamPlayers: TeamPlayer[];
    strikerId: string | null;
    nonStrikerId: string | null;
    onStrikerChange: (v: string) => void;
    onNonStrikerChange: (v: string) => void;
    onConfirm: () => void;
    isProcessing: boolean;
    addPlayerTarget: string | null;
    newPlayerName: string;
    onNewPlayerNameChange: (v: string) => void;
    onAddPlayer: () => void;
    onAddPlayerTargetChange: (v: "batting" | "bowling" | null) => void;
}

export function BatsmenDialog({
    open,
    onOpenChange,
    battingTeamPlayers,
    strikerId,
    nonStrikerId,
    onStrikerChange,
    onNonStrikerChange,
    onConfirm,
    isProcessing,
    addPlayerTarget,
    newPlayerName,
    onNewPlayerNameChange,
    onAddPlayer,
    onAddPlayerTargetChange,
}: BatsmenDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Batsmen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div>
                        <label className="text-sm font-medium">Striker</label>
                        <Select value={strikerId || ""} onValueChange={onStrikerChange}>
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select striker" />
                            </SelectTrigger>
                            <SelectContent>
                                {battingTeamPlayers
                                    .filter((p) => p.user_id !== nonStrikerId)
                                    .map((player) => (
                                        <SelectItem key={player.user_id} value={player.user_id}>
                                            {player.user?.full_name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Non-Striker</label>
                        <Select value={nonStrikerId || ""} onValueChange={onNonStrikerChange}>
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select non-striker" />
                            </SelectTrigger>
                            <SelectContent>
                                {battingTeamPlayers
                                    .filter((p) => p.user_id !== strikerId)
                                    .map((player) => (
                                        <SelectItem key={player.user_id} value={player.user_id}>
                                            {player.user?.full_name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {addPlayerTarget === "batting" ? (
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
                            onClick={() => onAddPlayerTargetChange("batting")}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                            <UserPlus className="h-3.5 w-3.5" /> New player? Add to squad
                        </button>
                    )}

                    <Button className="w-full" onClick={onConfirm} disabled={!strikerId || !nonStrikerId || isProcessing}>
                        Confirm
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
