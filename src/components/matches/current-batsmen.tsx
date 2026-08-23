"use client";

import { Card, CardContent } from "~/components/ui/card";
import { ArrowLeftRight, UserPlus } from "lucide-react";

interface Batsman {
    id: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isStriker: boolean;
}

interface CurrentBatsmenProps {
    batsman1: Batsman | null;
    batsman2: Batsman | null;
    onSwapStriker?: () => void;
    onSelectNewBatsman?: () => void;
}

import { strikeRate } from "~/lib/cricket";

function BatsmanRow({
    batsman,
    onSelectNewBatsman,
}: {
    batsman: Batsman | null;
    onSelectNewBatsman?: () => void;
}) {
    if (!batsman) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
                <span className="text-sm text-muted-foreground">Empty seat</span>
                {onSelectNewBatsman && (
                    <button
                        type="button"
                        onClick={onSelectNewBatsman}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        Select batter
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            className={`flex items-center justify-between rounded-lg border p-3 ${
                batsman.isStriker
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-muted/30"
            }`}
        >
            <div className="min-w-0">
                <p className="truncate font-medium">
                    {batsman.name}
                    {batsman.isStriker && (
                        <span className="ml-1.5 text-primary" title="On strike">
                            *
                        </span>
                    )}
                </p>
                <p className="text-xs text-muted-foreground tabular">
                    {batsman.fours}×4 · {batsman.sixes}×6 · SR {strikeRate(batsman.runs, batsman.balls)}
                </p>
            </div>
            <p className="score-display shrink-0 text-2xl font-semibold leading-none">
                {batsman.runs}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({batsman.balls})
                </span>
            </p>
        </div>
    );
}

export function CurrentBatsmen({
    batsman1,
    batsman2,
    onSwapStriker,
    onSelectNewBatsman,
}: CurrentBatsmenProps) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        At the crease
                    </h3>
                    {onSwapStriker && batsman1 && batsman2 && (
                        <button
                            type="button"
                            onClick={onSwapStriker}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Swap strike
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    <BatsmanRow batsman={batsman1} onSelectNewBatsman={onSelectNewBatsman} />
                    <BatsmanRow batsman={batsman2} onSelectNewBatsman={onSelectNewBatsman} />
                </div>
            </CardContent>
        </Card>
    );
}
