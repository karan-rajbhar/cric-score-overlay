"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Sliders, ShieldAlert, Sparkles } from "lucide-react";
import type { Match } from "~/lib/match-types";
import type { MatchSettingsUpdate } from "~/app/matches/mutations";

interface MatchSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match;
  onSave: (settings: MatchSettingsUpdate) => Promise<void> | void;
  isProcessing?: boolean;
}

function MatchSettingsForm({
  match,
  onSave,
  onCancel,
  isProcessing,
}: {
  match: Match;
  onSave: (settings: MatchSettingsUpdate) => Promise<void> | void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  const secondInnings = match.innings?.find((i) => i.innings_number === 2);
  const currentTarget = secondInnings?.target_runs ?? null;

  const [title, setTitle] = useState(match.title || "");
  const [matchFormat, setMatchFormat] = useState(match.match_format || "T20");
  const [oversPerInnings, setOversPerInnings] = useState<number>(
    match.overs_per_innings || 20,
  );
  const [targetRuns, setTargetRuns] = useState<string>(
    currentTarget !== null ? String(currentTarget) : "",
  );
  const [wicketsPerInnings, setWicketsPerInnings] = useState<number>(
    match.wickets_per_innings || 10,
  );
  const [lastManStands, setLastManStands] = useState<boolean>(
    Boolean(match.last_man_stands),
  );
  const [goldenBall, setGoldenBall] = useState<boolean>(
    Boolean(match.golden_ball),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatePayload: MatchSettingsUpdate = {
      title: title.trim() || undefined,
      matchFormat,
      oversPerInnings: Number(oversPerInnings) || 20,
      targetRuns: targetRuns.trim() !== "" ? Number(targetRuns) : null,
      wicketsPerInnings: Number(wicketsPerInnings) || 10,
      lastManStands,
      goldenBall,
    };
    await onSave(updatePayload);
  };

  const overPresets = [5, 10, 12, 15, 20, 50];

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sliders className="h-4 w-4" />
          </span>
          <DialogTitle className="text-lg font-bold">
            Match Settings & Rules
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-muted-foreground">
          Adjust match format, total overs (e.g. rain reduction), target
          runs, and special Stumps-grade rules mid-game.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Match Title */}
        <div className="space-y-1.5">
          <Label htmlFor="match-title" className="text-xs font-bold">
            Match Title
          </Label>
          <Input
            id="match-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Final - Club Championship"
            className="h-9 text-xs"
          />
        </div>

        {/* Match Format */}
        <div className="space-y-1.5">
          <Label htmlFor="match-format" className="text-xs font-bold">
            Match Format
          </Label>
          <Select value={matchFormat} onValueChange={setMatchFormat}>
            <SelectTrigger id="match-format" className="h-9 text-xs">
              <SelectValue placeholder="Select Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="T20">Twenty20 (T20)</SelectItem>
              <SelectItem value="ODI">One Day (ODI)</SelectItem>
              <SelectItem value="Custom">
                Custom / Tape-Ball / The Hundred
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overs Per Innings */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="overs-per-innings"
              className="text-xs font-bold"
            >
              Overs Per Innings
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Quick Presets:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="overs-per-innings"
              type="number"
              min={1}
              max={100}
              value={oversPerInnings}
              onChange={(e) => setOversPerInnings(Number(e.target.value))}
              className="h-9 w-24 text-xs font-bold"
              required
            />
            <div className="flex flex-wrap gap-1">
              {overPresets.map((ov) => (
                <Button
                  key={ov}
                  type="button"
                  variant={oversPerInnings === ov ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOversPerInnings(ov)}
                  className="h-8 px-2.5 text-xs font-semibold"
                >
                  {ov}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Target Runs (if 2nd innings or revised target) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="target-runs" className="text-xs font-bold">
              Target Runs
            </Label>
            <span className="text-[11px] text-muted-foreground">
              (Rain / DLS revised target)
            </span>
          </div>
          <Input
            id="target-runs"
            type="number"
            min={1}
            placeholder="e.g. 165 (Leave empty if 1st innings)"
            value={targetRuns}
            onChange={(e) => setTargetRuns(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* Wickets Per Innings */}
        <div className="space-y-1.5">
          <Label htmlFor="wickets-per-innings" className="text-xs font-bold">
            Wickets Per Innings
          </Label>
          <Input
            id="wickets-per-innings"
            type="number"
            min={1}
            max={11}
            value={wicketsPerInnings}
            onChange={(e) => setWicketsPerInnings(Number(e.target.value))}
            className="h-9 text-xs font-bold"
          />
          <p className="text-[11px] text-muted-foreground">
            Standard is 10 wickets. Set fewer for box/corporate cricket.
          </p>
        </div>

        {/* Special Stumps Rules Options */}
        <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/30 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Special Rules</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <Label
                htmlFor="last-man-stands"
                className="cursor-pointer text-xs font-bold"
              >
                Last Man Stands
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Allow the 11th or sole remaining batter to bat alone.
              </p>
            </div>
            <input
              id="last-man-stands"
              type="checkbox"
              checked={lastManStands}
              onChange={(e) => setLastManStands(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <Label
                htmlFor="golden-ball"
                className="cursor-pointer text-xs font-bold"
              >
                Golden Ball
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Enable sudden death / golden ball rule for tied scores.
              </p>
            </div>
            <input
              id="golden-ball"
              type="checkbox"
              checked={goldenBall}
              onChange={(e) => setGoldenBall(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </div>
        </div>

        {/* Rain Warning Notice */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Changes take effect immediately across all match overlays,
            projected score counters, and live viewer tabs.
          </span>
        </div>
      </div>

      <DialogFooter className="flex flex-row items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isProcessing}
          className="font-bold"
        >
          {isProcessing ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MatchSettingsDialog({
  open,
  onOpenChange,
  match,
  onSave,
  isProcessing = false,
}: MatchSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open && (
          <MatchSettingsForm
            key={`${match.id}-${open}`}
            match={match}
            onSave={onSave}
            onCancel={() => onOpenChange(false)}
            isProcessing={isProcessing}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
