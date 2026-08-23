"use client";

import { Card, CardContent } from "~/components/ui/card";
import { Repeat } from "lucide-react";

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
    const economy = (runs: number, overs: number) =>
        overs === 0 ? "—" : (runs / overs).toFixed(2);

    return (
        <Card>
            <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Current bowler
                    </h3>
                    {onChangeBowler && (
                        <button
                            type="button"
                            onClick={onChangeBowler}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                            <Repeat className="h-3.5 w-3.5" />
                            Change
                        </button>
                    )}
                </div>

                {!bowler ? (
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
                        <span className="text-sm text-muted-foreground">No bowler selected</span>
                        {onChangeBowler && (
                            <button
                                type="button"
                                onClick={onChangeBowler}
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                Select bowler
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-3">
                        <div className="min-w-0">
                            <p className="truncate font-medium">{bowler.name}</p>
                            <p className="text-xs text-muted-foreground tabular">
                                Econ {economy(bowler.runs, bowler.overs)} · {bowler.maidens} maiden
                                {bowler.maidens === 1 ? "" : "s"}
                            </p>
                        </div>
                        <p className="score-display shrink-0 text-xl font-semibold leading-none">
                            {bowler.wickets}-{bowler.runs}
                            <span className="ml-1 text-sm font-normal text-muted-foreground">
                                ({bowler.overs})
                            </span>
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
