"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

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

export function CurrentBatsmen({
    batsman1,
    batsman2,
    onSwapStriker,
    onSelectNewBatsman,
}: CurrentBatsmenProps) {
    const calculateStrikeRate = (runs: number, balls: number) => {
        if (balls === 0) return "0.00";
        return ((runs / balls) * 100).toFixed(2);
    };

    const BatsmanRow = ({ batsman }: { batsman: Batsman | null }) => {
        if (!batsman) {
            return (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30">
                    <span className="text-muted-foreground">Select batsman</span>
                    {onSelectNewBatsman && (
                        <button
                            onClick={onSelectNewBatsman}
                            className="text-sm text-cricket-primary hover:underline"
                        >
                            Choose
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${batsman.isStriker
                        ? "bg-cricket-primary/10 border border-cricket-primary/30"
                        : "bg-muted/30 border border-transparent"
                    }`}
            >
                <div className="flex items-center gap-3">
                    {batsman.isStriker && (
                        <Badge className="bg-cricket-primary text-white text-xs">
                            🏏
                        </Badge>
                    )}
                    <div>
                        <p className="font-semibold text-foreground">{batsman.name}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{batsman.fours} fours</span>
                            <span>•</span>
                            <span>{batsman.sixes} sixes</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">
                        {batsman.runs}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                            ({batsman.balls})
                        </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        SR: {calculateStrikeRate(batsman.runs, batsman.balls)}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Batsmen</CardTitle>
                    {onSwapStriker && batsman1 && batsman2 && (
                        <button
                            onClick={onSwapStriker}
                            className="text-xs text-cricket-primary hover:underline"
                        >
                            Swap Striker
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <BatsmanRow batsman={batsman1} />
                <BatsmanRow batsman={batsman2} />
            </CardContent>
        </Card>
    );
}
