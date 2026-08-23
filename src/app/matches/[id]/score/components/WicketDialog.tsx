"use client";

import { Button } from "~/components/ui/button";
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

const DISMISSAL_TYPES = [
    { value: "bowled", label: "Bowled", needsFielder: false },
    { value: "caught", label: "Caught", needsFielder: true },
    { value: "lbw", label: "LBW", needsFielder: false },
    { value: "stumped", label: "Stumped", needsFielder: true },
    { value: "run_out", label: "Run Out", needsFielder: true },
    { value: "hit_wicket", label: "Hit Wicket", needsFielder: false },
];

interface WicketDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dismissalType: string;
    onDismissalTypeChange: (v: string) => void;
    fielderId: string;
    onFielderChange: (v: string) => void;
    bowlingTeamPlayers: Array<{ user_id: string; user?: { full_name: string } | null }>;
    onConfirm: () => void;
    isProcessing: boolean;
}

export function WicketDialog({
    open,
    onOpenChange,
    dismissalType,
    onDismissalTypeChange,
    fielderId,
    onFielderChange,
    bowlingTeamPlayers,
    onConfirm,
    isProcessing,
}: WicketDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Wicket</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div>
                        <label className="text-sm font-medium">How was the batsman out?</label>
                        <Select value={dismissalType} onValueChange={onDismissalTypeChange}>
                            <SelectTrigger className="mt-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DISMISSAL_TYPES.map((d) => (
                                    <SelectItem key={d.value} value={d.value}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {DISMISSAL_TYPES.find((d) => d.value === dismissalType)?.needsFielder && (
                        <div>
                            <label className="text-sm font-medium">Fielder</label>
                            <Select value={fielderId} onValueChange={onFielderChange}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select fielder" />
                                </SelectTrigger>
                                <SelectContent>
                                    {bowlingTeamPlayers.map((player) => (
                                        <SelectItem key={player.user_id} value={player.user_id}>
                                            {player.user?.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <Button className="w-full" onClick={onConfirm} disabled={isProcessing}>
                        Record Wicket
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
