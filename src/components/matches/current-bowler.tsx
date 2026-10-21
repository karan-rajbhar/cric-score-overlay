"use client";

import { Card, CardContent } from "~/components/ui/card";
import { Repeat, Target } from "lucide-react";
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
  sunlightMode?: boolean;
}

import { usePreferencesStore } from "~/lib/stores/usePreferencesStore";

export function CurrentBowler({
  bowler,
  onChangeBowler,
  sunlightMode: propSunlightMode,
}: CurrentBowlerProps) {
  const storeSunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const sunlightMode =
    propSunlightMode !== undefined ? propSunlightMode : storeSunlightMode;

  return (
    <Card
      data-sunlight={sunlightMode ? "true" : "false"}
      className={
        sunlightMode
          ? "rounded-3xl border-2 border-black bg-white shadow-none"
          : "rounded-3xl border-border/70 bg-card/90 shadow-sm"
      }
    >
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <h3
              className={
                sunlightMode
                  ? "text-sm font-semibold text-black"
                  : "text-sm font-semibold text-foreground"
              }
            >
              Current bowler
            </h3>
          </div>
          {onChangeBowler && (
            <button
              type="button"
              onClick={onChangeBowler}
              className={
                sunlightMode
                  ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 py-1.5 text-xs font-bold text-black"
                  : "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-3 py-1.5 text-xs font-bold text-foreground transition-transform hover:bg-muted"
              }
            >
              <Repeat className="h-3.5 w-3.5 text-primary" />
              Change bowler
            </button>
          )}
        </div>

        {!bowler ? (
          <div
            className={
              sunlightMode
                ? "flex items-center justify-between rounded-2xl border-2 border-dashed border-black bg-white p-3.5"
                : "flex items-center justify-between rounded-2xl border border-dashed border-border/80 bg-muted/20 p-3.5 dark:border-[#26312a] dark:bg-[#111614]/60"
            }
          >
            <span
              className={
                sunlightMode
                  ? "text-xs font-bold text-black"
                  : "text-xs font-semibold text-muted-foreground"
              }
            >
              No bowler selected
            </span>
            {onChangeBowler && (
              <button
                type="button"
                onClick={onChangeBowler}
                className={
                  sunlightMode
                    ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 border-black bg-black px-3.5 py-1.5 text-xs font-bold text-white"
                    : "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                }
              >
                Select bowler
              </button>
            )}
          </div>
        ) : (
          <div
            className={
              sunlightMode
                ? "flex items-center justify-between gap-2 rounded-2xl border-2 border-black bg-white p-3 sm:p-3.5"
                : "flex items-center justify-between gap-2 rounded-2xl border border-border bg-muted/30 p-3 transition-colors sm:p-3.5"
            }
          >
            <div className="min-w-0 flex-1">
              <p
                className={
                  sunlightMode
                    ? "truncate text-sm font-bold text-black sm:text-base"
                    : "truncate text-sm font-bold text-foreground"
                }
              >
                {bowler.name}
              </p>
              <p
                className={
                  sunlightMode
                    ? "tabular-nums mt-0.5 text-xs font-bold text-black"
                    : "tabular-nums mt-0.5 text-xs text-muted-foreground"
                }
              >
                <span
                  className={
                    sunlightMode
                      ? "font-bold text-black"
                      : "font-semibold text-primary"
                  }
                >
                  Econ {economyRate(bowler.runs, ballsFromOvers(bowler.overs))}
                </span>
                {" · "}
                <span>
                  {bowler.maidens} maiden{bowler.maidens === 1 ? "" : "s"}
                </span>
              </p>
            </div>
            <p
              className={
                sunlightMode
                  ? "score-display tabular-nums shrink-0 text-3xl font-bold leading-none text-black sm:text-4xl"
                  : "score-display tabular-nums shrink-0 text-2xl font-bold leading-none text-foreground sm:text-3xl"
              }
            >
              <span
                className={
                  bowler.wickets > 0
                    ? sunlightMode
                      ? "text-destructive font-bold"
                      : "text-destructive"
                    : ""
                }
              >
                {bowler.wickets}
              </span>
              <span
                className={
                  sunlightMode ? "text-black font-bold" : "text-muted-foreground"
                }
              >
                /
              </span>
              <span>{bowler.runs}</span>
              <span
                className={
                  sunlightMode
                    ? "ml-1 text-xs font-bold text-black sm:text-sm"
                    : "ml-1 text-xs font-bold text-muted-foreground sm:text-sm"
                }
              >
                ({formatDecimalOvers(bowler.overs)})
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
