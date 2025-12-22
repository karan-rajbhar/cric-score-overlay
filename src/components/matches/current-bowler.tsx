"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

interface Bowler {
    id: string;
    name: string;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
}

interface CurrentBowlerProps {
    bowler: Bowler | null;
    onChangeBowler?: () => void;
}

export function CurrentBowler({ bowler, onChangeBowler }: CurrentBowlerProps) {
    const calculateEconomy = (runs: number, overs: number) => {
        if (overs === 0) return "0.00";
        return (runs / overs).toFixed(2);
    };

    if (!bowler) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Bowler</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30">
                        <span className="text-muted-foreground">Select bowler</span>
                        {onChangeBowler && (
                            <button
                                onClick={onChangeBowler}
                                className="text-sm text-cricket-primary hover:underline"
                            >
                                Choose
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Bowler</CardTitle>
                    {onChangeBowler && (
                        <button
                            onClick={onChangeBowler}
                            className="text-xs text-cricket-primary hover:underline"
                        >
                            Change Bowler
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-cricket-secondary/10 border border-cricket-secondary/30">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-cricket-secondary text-white text-xs">
                            ⚾
                        </Badge>
                        <div>
                            <p className="font-semibold text-foreground">{bowler.name}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                                <span>{bowler.maidens}M</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-foreground">
                            {bowler.wickets}-{bowler.runs}
                            <span className="text-sm font-normal text-muted-foreground ml-1">
                                ({bowler.overs})
                            </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Econ: {calculateEconomy(bowler.runs, bowler.overs)}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
