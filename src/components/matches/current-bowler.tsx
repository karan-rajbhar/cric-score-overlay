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
            <Target className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <h3
              className={
                sunlightMode
                  ? "text-xs font-black uppercase tracking-wider text-black"
                  : "text-xs font-bold uppercase tracking-wider text-muted-foreground"
              }
            >
              Current Bowler
            </h3>
          </div>
          {onChangeBowler && (
            <button
              type="button"
              onClick={onChangeBowler}
              className={
                sunlightMode
                  ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 py-1.5 text-xs font-black text-black active:scale-95"
                  : "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-3 py-1.5 text-xs font-bold text-foreground transition-transform hover:bg-muted active:scale-95"
              }
            >
              <Repeat className="h-3.5 w-3.5 text-sky-600" />
              Change Bowler
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
                  ? "text-xs font-black text-black"
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
                    ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 border-black bg-black px-3.5 py-1.5 text-xs font-black text-white active:scale-95"
                    : "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-bold text-sky-700 transition-all hover:bg-sky-500/20 active:scale-95 dark:text-sky-300"
                }
              >
                Select Bowler
              </button>
            )}
          </div>
        ) : (
          <div
            className={
              sunlightMode
                ? "flex items-center justify-between gap-2 rounded-2xl border-2 border-black bg-white p-3 sm:p-3.5"
                : "flex items-center justify-between gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 transition-all sm:p-3.5 dark:border-sky-500/35 dark:bg-sky-950/25 dark:shadow-[inset_0_1px_0_0_rgba(56,189,248,0.2)]"
            }
          >
            <div className="min-w-0 flex-1">
              <p
                className={
                  sunlightMode
                    ? "truncate text-sm font-black text-black sm:text-base"
                    : "truncate text-sm font-bold text-foreground"
                }
              >
                {bowler.name}
              </p>
              <p
                className={
                  sunlightMode
                    ? "tabular mt-0.5 text-xs font-black text-black"
                    : "tabular mt-0.5 text-xs text-muted-foreground"
                }
              >
                <span
                  className={
                    sunlightMode
                      ? "font-black text-black"
                      : "font-semibold text-sky-700 dark:text-sky-300"
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
                  ? "score-display tabular shrink-0 text-3xl font-black leading-none text-black sm:text-4xl"
                  : "score-display tabular shrink-0 text-2xl font-black leading-none text-foreground sm:text-3xl"
              }
            >
              <span
                className={
                  bowler.wickets > 0
                    ? sunlightMode
                      ? "text-red-700 font-black"
                      : "text-red-600 dark:text-red-400"
                    : ""
                }
              >
                {bowler.wickets}
              </span>
              <span
                className={
                  sunlightMode ? "text-black font-black" : "text-muted-foreground"
                }
              >
                /
              </span>
              <span>{bowler.runs}</span>
              <span
                className={
                  sunlightMode
                    ? "ml-1 text-xs font-black text-black sm:text-sm"
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
