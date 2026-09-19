"use client";

import { Card, CardContent } from "~/components/ui/card";
import { ArrowLeftRight, UserPlus, Users, Pencil } from "lucide-react";

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
  onChangeStriker?: () => void;
  onChangeNonStriker?: () => void;
}

import { strikeRate } from "~/lib/cricket";

function BatsmanRow({
  batsman,
  onSelectNewBatsman,
  onChangeBatter,
  changeLabel,
}: {
  batsman: Batsman | null;
  onSelectNewBatsman?: () => void;
  onChangeBatter?: () => void;
  changeLabel?: string;
}) {
  if (!batsman) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/80 bg-muted/20 p-3.5">
        <span className="text-xs font-semibold text-muted-foreground">
          Empty batter seat
        </span>
        {onSelectNewBatsman && (
          <button
            type="button"
            onClick={onSelectNewBatsman}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Select Batter
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-2xl border p-3 transition-all duration-200 sm:p-3.5 ${
        batsman.isStriker
          ? "border-emerald-500/50 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/25"
          : "border-border/70 bg-card/70"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-bold text-foreground">
            {batsman.name}
          </p>
          {batsman.isStriker && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/25 px-2 py-0.5 text-[9px] font-black tracking-wider text-emerald-800 dark:text-emerald-300">
              🏏 STRIKE
            </span>
          )}
          {onChangeBatter && (
            <button
              type="button"
              onClick={onChangeBatter}
              aria-label={changeLabel ?? "Change Batter"}
              title={
                changeLabel ??
                "Change or replace batter if wrong player was selected"
              }
              className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 active:scale-95 dark:hover:text-emerald-300"
            >
              <Pencil className="h-2.5 w-2.5" />
              <span>Change</span>
            </button>
          )}
        </div>
        <p className="tabular mt-0.5 text-xs text-muted-foreground">
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {batsman.fours}×4
          </span>
          {" · "}
          <span className="font-bold text-purple-600 dark:text-purple-400">
            {batsman.sixes}×6
          </span>
          {" · "}
          <span>SR {strikeRate(batsman.runs, batsman.balls)}</span>
        </p>
      </div>
      <p className="score-display tabular shrink-0 text-2xl font-black leading-none text-foreground sm:text-3xl">
        {batsman.runs}
        <span className="ml-1 text-xs font-bold text-muted-foreground sm:text-sm">
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
  onChangeStriker,
  onChangeNonStriker,
}: CurrentBatsmenProps) {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/90 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              At the Crease
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {onSwapStriker && batsman1 && batsman2 && (
              <button
                type="button"
                onClick={onSwapStriker}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2.5 py-1 text-xs font-bold text-foreground transition-transform hover:bg-muted active:scale-95"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
                Swap Strike
              </button>
            )}
            {onSelectNewBatsman && (
              <button
                type="button"
                onClick={onSelectNewBatsman}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
                title="Change or replace batters at the crease"
              >
                <Users className="h-3.5 w-3.5" />
                Change Batters
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2.5">
          <BatsmanRow
            batsman={batsman1}
            onSelectNewBatsman={onSelectNewBatsman}
            onChangeBatter={onChangeStriker ?? onSelectNewBatsman}
            changeLabel="Change Striker"
          />
          <BatsmanRow
            batsman={batsman2}
            onSelectNewBatsman={onSelectNewBatsman}
            onChangeBatter={onChangeNonStriker ?? onSelectNewBatsman}
            changeLabel="Change Non-Striker"
          />
        </div>
      </CardContent>
    </Card>
  );
}
