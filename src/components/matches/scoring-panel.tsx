"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { ChevronRight, X, RotateCcw } from "lucide-react";

interface ScoringPanelProps {
    onScore: (runs: number, extras?: { type: string; runs: number }) => void;
    onWicket: () => void;
    onUndo?: () => void;
    currentOver: number;
    currentBall: number;
    lastBalls: string[];
    disabled?: boolean;
}

export function ScoringPanel({
    onScore,
    onWicket,
    onUndo,
    currentOver,
    currentBall,
    lastBalls,
    disabled = false,
}: ScoringPanelProps) {
    const [showExtras, setShowExtras] = useState(false);
    const [selectedExtra, setSelectedExtra] = useState<string | null>(null);

    const runButtons = [0, 1, 2, 3, 4, 6];
    const extraTypes = [
        { type: "wide", label: "Wide", color: "bg-yellow-500" },
        { type: "no_ball", label: "No Ball", color: "bg-orange-500" },
        { type: "bye", label: "Bye", color: "bg-blue-500" },
        { type: "leg_bye", label: "Leg Bye", color: "bg-purple-500" },
    ];

    const handleRunClick = (runs: number) => {
        if (selectedExtra) {
            onScore(0, { type: selectedExtra, runs: runs + 1 });
            setSelectedExtra(null);
            setShowExtras(false);
        } else {
            onScore(runs);
        }
    };

    const handleExtraClick = (extraType: string) => {
        setSelectedExtra(extraType);
        // For wide and no_ball, we need to know how many additional runs
    };

    const getBallDisplay = (ball: string) => {
        if (ball === "W") return "bg-red-500 text-white";
        if (ball === "4") return "bg-blue-500 text-white";
        if (ball === "6") return "bg-purple-500 text-white";
        if (ball.includes("wd") || ball.includes("nb")) return "bg-yellow-500 text-black";
        return "bg-muted text-foreground";
    };

    return (
        <Card className="border-2 border-cricket-primary/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Scoring Panel</CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-lg px-3 py-1">
                            Over {currentOver}.{currentBall}
                        </Badge>
                        {onUndo && (
                            <Button variant="ghost" size="sm" onClick={onUndo} disabled={disabled}>
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Last Over Display */}
                {lastBalls.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">This over:</span>
                        <div className="flex gap-1">
                            {lastBalls.map((ball, idx) => (
                                <div
                                    key={idx}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getBallDisplay(ball)}`}
                                >
                                    {ball}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Extra Selection Mode */}
                {selectedExtra && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between">
                        <span className="text-sm font-medium">
                            Adding {selectedExtra.replace("_", " ")} - select runs
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedExtra(null)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Run Buttons */}
                <div className="grid grid-cols-6 gap-2">
                    {runButtons.map((runs) => (
                        <Button
                            key={runs}
                            variant={runs === 4 || runs === 6 ? "default" : "outline"}
                            size="lg"
                            className={`text-xl font-bold h-14 ${runs === 4
                                    ? "bg-blue-500 hover:bg-blue-600"
                                    : runs === 6
                                        ? "bg-purple-500 hover:bg-purple-600"
                                        : ""
                                }`}
                            onClick={() => handleRunClick(runs)}
                            disabled={disabled}
                        >
                            {runs}
                        </Button>
                    ))}
                </div>

                {/* Extras Row */}
                <div className="flex gap-2">
                    {extraTypes.map((extra) => (
                        <Button
                            key={extra.type}
                            variant={selectedExtra === extra.type ? "default" : "outline"}
                            size="sm"
                            className={`flex-1 ${selectedExtra === extra.type ? extra.color : ""}`}
                            onClick={() => handleExtraClick(extra.type)}
                            disabled={disabled}
                        >
                            {extra.label}
                        </Button>
                    ))}
                </div>

                {/* Wicket Button */}
                <Button
                    variant="destructive"
                    size="lg"
                    className="w-full text-lg font-bold h-14"
                    onClick={onWicket}
                    disabled={disabled}
                >
                    🏏 WICKET
                </Button>

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="flex-1" disabled={disabled}>
                        End Over
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" disabled={disabled}>
                        End Innings
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" disabled={disabled}>
                        Retire Batsman
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
