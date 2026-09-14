"use client";

import { Card, CardContent } from "~/components/ui/card";
import { Repeat } from "lucide-react";
import { economyRate, ballsFromOvers, formatDecimalOvers } from "~/lib/cricket";

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
  return (
    <Card className="rounded-3xl border-border/70 bg-card/90 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Current Bowler
            </h3>
          </div>
          {onChangeBowler && (
            <button
              type="button"
              onClick={onChangeBowler}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-xs font-bold text-foreground transition-transform hover:bg-muted active:scale-95"
            >
              <Repeat className="h-3.5 w-3.5 text-sky-600" />
              Change Bowler
            </button>
          )}
        </div>

        {!bowler ? (
          <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/80 bg-muted/20 p-3.5">
            <span className="text-xs font-semibold text-muted-foreground">
              No bowler selected
            </span>
            {onChangeBowler && (
              <button
                type="button"
                onClick={onChangeBowler}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-700 transition-all hover:bg-sky-500/20 active:scale-95 dark:text-sky-300"
              >
                Select Bowler
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3.5 transition-all">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {bowler.name}
              </p>
              <p className="tabular mt-0.5 text-xs text-muted-foreground">
                <span className="font-semibold text-sky-700 dark:text-sky-300">
                  Econ {economyRate(bowler.runs, ballsFromOvers(bowler.overs))}
                </span>
                {" · "}
                <span>
                  {bowler.maidens} maiden{bowler.maidens === 1 ? "" : "s"}
                </span>
              </p>
            </div>
            <p className="score-display tabular shrink-0 text-3xl font-black leading-none text-foreground">
              <span
                className={
                  bowler.wickets > 0 ? "text-red-600 dark:text-red-400" : ""
                }
              >
                {bowler.wickets}
              </span>
              <span className="text-muted-foreground">/</span>
              <span>{bowler.runs}</span>
              <span className="ml-1 text-sm font-bold text-muted-foreground">
                ({formatDecimalOvers(bowler.overs)})
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
