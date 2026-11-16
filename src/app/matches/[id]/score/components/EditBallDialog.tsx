"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "~/lib/utils";
import {
  ALL_DISMISSAL_TYPES,
  RETIREMENT_TYPES,
  dismissesEitherBatter,
} from "./WicketDialog";
import type { ExtraType, NoBallRuns } from "~/app/matches/types";
import type { TeamPlayer } from "~/lib/match-types";
import { editedBall } from "~/lib/firebase/scoring/ball-docs";
import { crossingRunsOf } from "~/lib/firebase/scoring/recompute";
import {
  battedOnAfter,
  battingAfterOut,
  laterBallsTo,
} from "~/lib/scoring-correction";
import type { BallByBallRow } from "~/lib/firebase/types";
import { previewOf, type PreviewRules } from "../correction-preview";
import { CorrectionChanges } from "./CorrectionChanges";

export interface DeliveryToEdit {
  id: string;
  over_number?: number;
  ball_number?: number;
  runs_scored?: number | null;
  extras?: number | null;
  extra_type?: string | null;
  is_wicket?: boolean | null;
  dismissal_type?: string | null;
  bowler_id?: string | null;
  batsman_id?: string | null;
  non_striker_id?: string | null;
  dismissed_player_id?: string | null;
  fielder_id?: string | null;
  /** On a no-ball: its completed runs were byes / leg byes. */
  no_ball_runs?: string | null;
  shot_zone?: string | null;
}

/** A ball-log row as `getMatchBallLog` returns it. */
export type LoggedBall = DeliveryToEdit & {
  innings_id?: string | null;
  seq?: number | null;
  penalty_team_id?: string | null;
};

/** What Edit ball needs to show the figures an edit changes. */
export interface EditPreview {
  /** The match's ball log, when already read (Fix a mistake has it). */
  log?: readonly LoggedBall[] | null;
  /** Reads the match's ball log otherwise (when the dialog opens). */
  load?: () => Promise<LoggedBall[]>;
  rules: PreviewRules;
  /** The side batting in the ball's innings. */
  teamId: string | null;
  /** The match is over: a new total gives a new result. */
  finished: boolean;
  nameOf: (id: string | null | undefined) => string;
}

/** What the dialog saves (`handleUpdateBall`). */
export interface BallCorrection {
  ballId: string;
  runsScored: number;
  extras: number;
  extraType: ExtraType | null;
  isWicket: boolean;
  dismissalType: string | null;
  fielderId: string | null;
  dismissedPlayerId: string | null;
  noBallRuns: NoBallRuns | null;
  batsmanId?: string | null;
  bowlerId?: string | null;
  /** A wicket added after the batter batted on: who came in. */
  laterBatterId?: string | null;
}

type Kind = "none" | "wide" | "no_ball" | "bye" | "leg_bye";

const KINDS: Array<[Kind, string]> = [
  ["none", "No extra"],
  ["wide", "Wide"],
  ["no_ball", "No ball"],
  ["bye", "Byes"],
  ["leg_bye", "Leg byes"],
];

/** The form as the keypad thinks of a ball: an extra, then the runs. */
interface Form {
  kind: Kind;
  /** Off the bat; besides the wide; the byes. */
  runs: number;
  noBallRuns: NoBallRuns;
  isWicket: boolean;
  dismissalType: string;
  fielderId: string;
  dismissedPlayerId: string | null;
  batsmanId: string | null;
  bowlerId: string | null;
}

/** A stored ball in the keypad's terms. */
export function formOfDelivery(d: DeliveryToEdit): Form {
  const extras = d.extras ?? 0;
  const t = d.extra_type;
  const byesOffNoBall =
    t === "no_ball" &&
    (d.no_ball_runs === "bye" || d.no_ball_runs === "leg_bye");
  const kind: Kind =
    t === "wide" || t === "no_ball" || t === "bye" || t === "leg_bye"
      ? t
      : "none";
  const runs =
    kind === "wide"
      ? Math.max(0, extras - 1)
      : byesOffNoBall
        ? Math.max(0, extras - 1)
        : kind === "bye" || kind === "leg_bye"
          ? extras
          : (d.runs_scored ?? 0);
  return {
    kind,
    runs,
    noBallRuns: byesOffNoBall ? (d.no_ball_runs as NoBallRuns) : "bat",
    isWicket: Boolean(d.is_wicket),
    dismissalType: d.is_wicket ? (d.dismissal_type ?? "") : "",
    fielderId: d.fielder_id ?? "",
    dismissedPlayerId: d.dismissed_player_id ?? d.batsman_id ?? null,
    batsmanId: d.batsman_id ?? null,
    bowlerId: d.bowler_id ?? null,
  };
}

/** The ball's stored values from the form (the keypad's payloads). */
export function correctionOf(d: DeliveryToEdit, f: Form): BallCorrection {
  let runsScored = 0;
  let extras = 0;
  let noBallRuns: NoBallRuns | null = null;
  switch (f.kind) {
    case "none":
      runsScored = f.runs;
      break;
    case "wide":
      extras = 1 + f.runs;
      break;
    case "no_ball":
      if (f.noBallRuns !== "bat" && f.runs > 0) {
        extras = 1 + f.runs;
        noBallRuns = f.noBallRuns;
      } else {
        runsScored = f.runs;
        // A no-ball off the bat keeps its stored penalty (1 unless the
        // match recorded more).
        extras =
          d.extra_type === "no_ball" && !d.no_ball_runs
            ? Math.max(1, d.extras ?? 1)
            : 1;
      }
      break;
    case "bye":
    case "leg_bye":
      extras = Math.max(1, f.runs);
      break;
  }
  const out = f.isWicket && f.dismissalType;
  return {
    ballId: d.id,
    runsScored,
    extras,
    extraType: f.kind === "none" ? null : f.kind,
    isWicket: Boolean(out),
    dismissalType: out ? f.dismissalType : null,
    fielderId:
      out && needsFielder(f.dismissalType) ? f.fielderId || null : null,
    dismissedPlayerId: out
      ? dismissesEitherBatter(f.dismissalType)
        ? (f.dismissedPlayerId ?? f.batsmanId)
        : f.batsmanId
      : null,
    noBallRuns,
    batsmanId: f.batsmanId,
    bowlerId: f.bowlerId,
  };
}

function needsFielder(type: string): boolean {
  return Boolean(
    ALL_DISMISSAL_TYPES.find((d) => d.value === type)?.needsFielder,
  );
}

/** The dismissals the ball's extra allows (as the wicket dialog offers them). */
function dismissalsFor(kind: Kind, current: string) {
  const list = ALL_DISMISSAL_TYPES.filter((d) =>
    kind === "no_ball"
      ? d.allowedOnNoBall
      : kind === "wide"
        ? d.allowedOnWide
        : true,
  );
  // A retirement recorded as a ball long ago: kept so it can be changed.
  const retired = RETIREMENT_TYPES.filter((r) => r.value === current);
  return [...list, ...retired];
}

/** Why the correction cannot be saved yet (null: it can). */
export function correctionMissing(f: Form): string | null {
  if (f.isWicket && !f.dismissalType) return "Choose how the batter was out";
  if (f.isWicket && needsFielder(f.dismissalType) && !f.fielderId) {
    return f.dismissalType === "stumped"
      ? "Choose the keeper"
      : f.dismissalType === "caught"
        ? "Choose the catcher"
        : "Choose the fielder";
  }
  if ((f.kind === "bye" || f.kind === "leg_bye") && f.runs < 1) {
    return "Byes need at least one run";
  }
  return null;
}

interface EditBallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: DeliveryToEdit | null;
  /** Resolves with the server's error, if any (the dialog then stays open). */
  onSave: (params: BallCorrection) => Promise<{ error: string | null } | void>;
  isProcessing: boolean;
  battingTeamPlayers?: TeamPlayer[];
  bowlingTeamPlayers?: TeamPlayer[];
  /**
   * The stored ball is a wicket only the striker can suffer, given to the
   * wrong batter: opens Fix a mistake on it (the batters change places from
   * this ball to the end of the innings). Absent: not offered.
   */
  onWrongBatterOut?: () => void;
  /**
   * After a save that changed whether the batters crossed: opens Fix a
   * mistake's "wrong ends from here" at that later ball. Absent: not offered.
   */
  onEndsWrongFrom?: (ballId: string) => void;
  /** Shows what the edit changes before Save (absent: not shown). */
  preview?: EditPreview | null;
}

const nameOf = (players: TeamPlayer[], id: string | null | undefined) =>
  players.find((p) => p.user_id === id)?.user?.full_name ?? null;

const chip = (selected: boolean) =>
  cn(
    "flex min-h-11 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors",
    selected
      ? "border-primary bg-primary/10 text-foreground"
      : "border-border bg-background text-foreground hover:bg-muted",
  );

type SetForm = (patch: Partial<Form>) => void;

/** What the runs were called for the ball's extra. */
function runsLabelOf(form: Form): string {
  if (form.kind === "wide") return "Runs they ran besides the wide";
  if (form.kind === "bye") return "Byes";
  if (form.kind === "leg_bye") return "Leg byes";
  if (form.kind === "no_ball" && form.noBallRuns === "bye") {
    return "Byes they ran off the no-ball";
  }
  if (form.kind === "no_ball" && form.noBallRuns === "leg_bye") {
    return "Leg byes they ran off the no-ball";
  }
  return "Runs off the bat";
}

/** The extra, what a no-ball's runs were, and the runs. */
function BallKindFields({ form, set }: { form: Form; set: SetForm }) {
  const runsLabel = runsLabelOf(form);
  return (
    <>
      <div>
        <p id="edit-kind-label" className="text-sm font-medium">
          Extra
        </p>
        <div
          role="radiogroup"
          aria-labelledby="edit-kind-label"
          className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5"
        >
          {KINDS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={form.kind === kind}
              className={chip(form.kind === kind)}
              onClick={() =>
                set({
                  kind,
                  runs:
                    (kind === "bye" || kind === "leg_bye") && form.runs < 1
                      ? 1
                      : form.runs,
                  noBallRuns: "bat",
                  dismissalType: "",
                  fielderId: "",
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {form.kind === "no_ball" && (
        <div>
          <p id="edit-nb-label" className="text-sm font-medium">
            The runs off the no-ball were
          </p>
          <div
            role="radiogroup"
            aria-labelledby="edit-nb-label"
            className="mt-1.5 grid grid-cols-3 gap-1.5"
          >
            {(
              [
                ["bat", "Off the bat"],
                ["bye", "Byes"],
                ["leg_bye", "Leg byes"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={form.noBallRuns === kind}
                className={chip(form.noBallRuns === kind)}
                onClick={() => set({ noBallRuns: kind })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p id="edit-runs-label" className="text-sm font-medium">
          {runsLabel}
        </p>
        <div
          role="group"
          aria-labelledby="edit-runs-label"
          className="mt-1.5 grid grid-cols-4 gap-1.5 sm:grid-cols-8"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((r) => {
            const noRun =
              r === 0 && (form.kind === "bye" || form.kind === "leg_bye");
            return (
              <button
                key={r}
                type="button"
                aria-pressed={form.runs === r}
                disabled={noRun}
                className={cn(
                  chip(form.runs === r),
                  "font-score text-sm tabular-nums disabled:opacity-40",
                )}
                onClick={() => set({ runs: r })}
              >
                {r}
              </button>
            );
          })}
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            aria-label="More runs"
            placeholder="7+"
            value={form.runs > 6 ? form.runs : ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0 && n <= 99) {
                set({ runs: Math.floor(n) });
              }
            }}
            className="h-11 text-center text-sm font-semibold tabular-nums"
          />
        </div>
      </div>
    </>
  );
}

/** The wicket: how, who was out, and who took it. */
function WicketFields({
  form,
  set,
  nonStriker,
  battingTeamPlayers,
  bowlingTeamPlayers,
  onWrongBatterOut,
}: {
  form: Form;
  set: SetForm;
  nonStriker: string | null;
  battingTeamPlayers: TeamPlayer[];
  bowlingTeamPlayers: TeamPlayer[];
  onWrongBatterOut?: () => void;
}) {
  const dismissals = dismissalsFor(form.kind, form.dismissalType);
  const either = form.isWicket && dismissesEitherBatter(form.dismissalType);
  const striker = form.batsmanId;
  return (
    <>
      <label
        htmlFor="edit-is-wicket"
        className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm font-medium"
      >
        <input
          type="checkbox"
          id="edit-is-wicket"
          checked={form.isWicket}
          onChange={(e) =>
            set({
              isWicket: e.target.checked,
              dismissalType: "",
              fielderId: "",
            })
          }
          className="h-4 w-4 rounded border-border"
        />
        Wicket on this ball
      </label>

      {form.isWicket && (
        <div className="space-y-3">
          <div>
            <p id="edit-dismissal-label" className="text-sm font-medium">
              How was the batter out?
            </p>
            <div
              role="radiogroup"
              aria-labelledby="edit-dismissal-label"
              className="mt-1.5 grid grid-cols-2 gap-1.5"
            >
              {dismissals.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={form.dismissalType === d.value}
                  className={chip(form.dismissalType === d.value)}
                  onClick={() =>
                    set({
                      dismissalType: d.value,
                      dismissedPlayerId: dismissesEitherBatter(d.value)
                        ? form.dismissedPlayerId
                        : striker,
                    })
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {!either && onWrongBatterOut && nonStriker && striker && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <p>
                Only the striker can be out this way. If{" "}
                {nameOf(battingTeamPlayers, nonStriker) ?? "the other batter"}{" "}
                was out, the batters were at the wrong ends.
              </p>
              <button
                type="button"
                onClick={onWrongBatterOut}
                className="mt-1.5 min-h-11 font-semibold text-primary underline-offset-4 hover:underline"
              >
                {nameOf(battingTeamPlayers, nonStriker) ?? "The other batter"}{" "}
                was out, not{" "}
                {nameOf(battingTeamPlayers, striker) ?? "the striker"}
              </button>
            </div>
          )}

          {either && nonStriker && striker && (
            <div>
              <p id="edit-out-label" className="text-sm font-medium">
                Batter out
              </p>
              <div
                role="radiogroup"
                aria-labelledby="edit-out-label"
                className="mt-1.5 grid grid-cols-2 gap-1.5"
              >
                {[striker, nonStriker].map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={(form.dismissedPlayerId ?? striker) === id}
                    className={chip((form.dismissedPlayerId ?? striker) === id)}
                    onClick={() => set({ dismissedPlayerId: id })}
                  >
                    {nameOf(battingTeamPlayers, id) ??
                      (i === 0 ? "Striker" : "Non-striker")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsFielder(form.dismissalType) && (
            <div className="space-y-1">
              <Label htmlFor="edit-fielder" className="text-sm font-medium">
                {form.dismissalType === "stumped"
                  ? "Keeper"
                  : form.dismissalType === "caught"
                    ? "Catcher"
                    : "Fielder"}
              </Label>
              <Select
                value={form.fielderId}
                onValueChange={(v) => set({ fielderId: v })}
              >
                <SelectTrigger id="edit-fielder" className="h-11">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {bowlingTeamPlayers.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.user?.full_name ?? "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Who was batting / bowling (a wrong pick on this ball). */
function PlayerFields({
  form,
  set,
  battingTeamPlayers,
  bowlingTeamPlayers,
}: {
  form: Form;
  set: SetForm;
  battingTeamPlayers: TeamPlayer[];
  bowlingTeamPlayers: TeamPlayer[];
}) {
  return (
    <>
      {/* Who was batting / bowling (a wrong pick on this ball) */}
      <div className="grid grid-cols-2 gap-2">
        {battingTeamPlayers.length > 0 && (
          <div className="min-w-0 space-y-1">
            <Label htmlFor="edit-batsman" className="text-xs font-medium">
              Striker
            </Label>
            <Select
              value={form.batsmanId ?? ""}
              onValueChange={(v) => set({ batsmanId: v || null })}
            >
              <SelectTrigger id="edit-batsman" className="h-11 text-xs">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {battingTeamPlayers.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.user?.full_name ?? "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {bowlingTeamPlayers.length > 0 && (
          <div className="min-w-0 space-y-1">
            <Label htmlFor="edit-bowler" className="text-xs font-medium">
              Bowler
            </Label>
            <Select
              value={form.bowlerId ?? ""}
              onValueChange={(v) => set({ bowlerId: v || null })}
            >
              <SelectTrigger id="edit-bowler" className="h-11 text-xs">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {bowlingTeamPlayers.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.user?.full_name ?? "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </>
  );
}

export function EditBallDialog({
  open,
  onOpenChange,
  delivery,
  onSave,
  isProcessing,
  battingTeamPlayers = [],
  bowlingTeamPlayers = [],
  onWrongBatterOut,
  onEndsWrongFrom,
  preview = null,
}: EditBallDialogProps) {
  const [form, setForm] = useState<Form | null>(
    delivery ? formOfDelivery(delivery) : null,
  );
  const loaded = useBallLog(open, preview);
  /** A wicket added after the batter batted on: who came in. */
  const [laterBatterId, setLaterBatterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A fresh form for each ball, and each time the dialog opens.
  const key = `${open}:${delivery?.id ?? ""}`;
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setForm(delivery ? formOfDelivery(delivery) : null);
    setError(null);
    setLaterBatterId(null);
  }

  if (!delivery || !form) return null;
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });

  // Runs awarded between balls are not deliveries: undo them instead.
  const isEvent =
    delivery.extra_type === "penalty" ||
    delivery.extra_type === "bonus" ||
    !delivery.bowler_id;
  const position = `${delivery.over_number ?? 0}.${delivery.ball_number ?? 1}`;
  const correction = correctionOf(delivery, form);
  const checked = preview
    ? editPreviewOf(preview, preview.log ?? loaded, delivery, correction, laterBatterId)
    : null;
  const missing =
    correctionMissing(form) ??
    (checked?.conflict && !laterBatterId ? "Choose who came in" : null) ??
    (checked?.blocked ? "Check the later balls first" : null);

  const endsFrom = onEndsWrongFrom ? (checked?.endsFrom ?? null) : null;
  const save = async (thenFixEnds = false) => {
    if (missing) return;
    setError(null);
    const res = await onSave({
      ...correction,
      laterBatterId: checked?.conflict ? laterBatterId : null,
    });
    const err = res && "error" in res ? res.error : null;
    if (err) setError(err);
    else {
      onOpenChange(false);
      if (thenFixEnds && endsFrom) onEndsWrongFrom?.(endsFrom.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">
            Correct ball {position}
          </DialogTitle>
          <DialogDescription>
            Change what happened on this ball. The scorecard is worked out again
            from every ball, so later balls stay as they are.
          </DialogDescription>
        </DialogHeader>

        {isEvent ? (
          <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            Runs awarded between balls cannot be corrected here. Undo them and
            award them again.
          </p>
        ) : (
          <div className="space-y-4">
            <BallKindFields form={form} set={set} />
            <WicketFields
              form={form}
              set={set}
              nonStriker={delivery.non_striker_id ?? null}
              battingTeamPlayers={battingTeamPlayers}
              bowlingTeamPlayers={bowlingTeamPlayers}
              onWrongBatterOut={
                onWrongBatterOut &&
                delivery.is_wicket &&
                delivery.dismissal_type &&
                !dismissesEitherBatter(delivery.dismissal_type) &&
                delivery.non_striker_id
                  ? onWrongBatterOut
                  : undefined
              }
            />
            <PlayerFields
              form={form}
              set={set}
              battingTeamPlayers={battingTeamPlayers}
              bowlingTeamPlayers={bowlingTeamPlayers}
            />
            {checked?.conflict && (
              <LaterBatterFields
                conflict={checked.conflict}
                nameOf={preview!.nameOf}
                players={battingTeamPlayers}
                value={laterBatterId}
                onChange={setLaterBatterId}
              />
            )}
            {checked?.blocked && (
              <p role="alert" className="text-sm font-medium text-destructive">
                That would put a batter at the crease after they were out.
                Check the later balls in Fix a mistake first.
              </p>
            )}
            {preview && !checked?.blocked && !(checked?.conflict && !laterBatterId) && (
              <EditChanges
                preview={preview}
                checked={checked}
                waiting={!(preview.log ?? loaded)}
                ready={!correctionMissing(form)}
              />
            )}
            {/* Runs made odd or even: the next ball was stored with the
                batters where they were before. Only a hint: the scorer may
                have set the strike right by hand then, so nothing is fixed
                unless they say so. */}
            {endsFrom && !missing && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                {endsFrom.crossesNow
                  ? "The batters now cross on this ball"
                  : "The batters no longer cross on this ball"}
                : from ball {endsFrom.position} they may be at the wrong ends.
                If they are, save and fix the ends.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:-mb-4 max-sm:border-t max-sm:border-border/70 max-sm:bg-card max-sm:px-4 max-sm:pb-4 max-sm:pt-3">
              <Button
                className="h-11 w-full text-sm font-semibold"
                onClick={() => void save()}
                disabled={isProcessing || Boolean(missing)}
                aria-describedby={missing ? "edit-missing" : undefined}
              >
                {isProcessing ? "Saving…" : `Save ball ${position}`}
              </Button>
              {endsFrom && !missing && (
                <Button
                  variant="outline"
                  className="mt-2 h-11 w-full text-sm font-medium"
                  onClick={() => void save(true)}
                  disabled={isProcessing}
                >
                  Save, then fix the ends from {endsFrom.position}
                </Button>
              )}
              {missing && (
                <p
                  id="edit-missing"
                  className="mt-1.5 text-center text-xs text-muted-foreground"
                >
                  {missing}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The match's ball log for the preview: `preview.log` when given, else read
 * once each time the dialog opens (null until it arrives or if it fails).
 */
function useBallLog(open: boolean, preview: EditPreview | null) {
  const [loaded, setLoaded] = useState<LoggedBall[] | null>(null);
  const load = !preview?.log ? preview?.load : undefined;
  // Read afresh each time it opens: drop the last read as it does (during
  // render, as FixMistakeDialog does, not in the effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setLoaded(null);
  }
  useEffect(() => {
    if (!open || !load) return;
    let live = true;
    load()
      .then((balls) => {
        if (live) setLoaded(balls);
      })
      .catch(() => {
        if (live) setLoaded(null);
      });
    return () => {
      live = false;
    };
  }, [open, load]);
  return loaded;
}

/** What an edit does to its innings, worked out on the phone. */
interface EditCheck {
  result: ReturnType<typeof previewOf>;
  /**
   * The edit makes this ball a wicket of a batter the later balls still
   * have batting: who came in must be said (`laterBallsTo`).
   */
  conflict: { outId: string; positions: string[] } | null;
  /** The log would still have a batter at the crease after they were out. */
  blocked: boolean;
  /**
   * The edit changes whether the batters crossed on this ball, and a later
   * ball still has them at the old ends: that ball's id, where Fix a
   * mistake's "wrong ends from here" starts. Null: nothing to fix.
   */
  endsFrom: { id: string; position: string; crossesNow: boolean } | null;
}

/**
 * The innings' log with the edit applied (and the later balls given to
 * whoever came in, when a wicket is added after the batter batted on), as
 * `update_ball` would store it; null until the log is read.
 */
export function editPreviewOf(
  preview: EditPreview,
  log: readonly LoggedBall[] | null | undefined,
  delivery: DeliveryToEdit,
  correction: BallCorrection,
  laterBatterId: string | null,
): EditCheck | null {
  if (!log) return null;
  const stored = log.find((b) => b.id === delivery.id);
  if (!stored) return null;
  const innings = log
    .filter((b) => b.innings_id === stored.innings_id)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const edited = editedBall(stored as unknown as BallByBallRow, correction) as unknown as LoggedBall;
  let after: LoggedBall[] = innings.map((b) => (b.id === stored.id ? edited : b));
  const on = battedOnAfter(after, edited);
  const conflict = on
    ? {
        outId: on.outId,
        positions: on.later.map(
          (b) => `${b.over_number ?? 0}.${b.ball_number ?? 1}`,
        ),
      }
    : null;
  if (on && laterBatterId) {
    after = laterBallsTo(after, edited.id, on.outId, laterBatterId);
  }
  const already = battingAfterOut(innings);
  const blocked =
    (!on || Boolean(laterBatterId)) &&
    [...battingAfterOut(after)].some((k) => !already.has(k));
  const result = previewOf(
    preview.rules,
    { id: stored.innings_id ?? "", team_id: preview.teamId },
    innings,
    after,
    null,
  );
  // Odd runs made even (or the other way) on a plain ball: the later balls
  // keep the striker they were stored with, now at the wrong end. (A
  // wicket's ends depend on who came in: Edit ball asks that itself.)
  const crossedBefore = crossingRunsOf(stored) % 2 === 1;
  const crossedNow = crossingRunsOf(edited) % 2 === 1;
  // The next delivery: not an event between balls (penalty or bonus runs,
  // a retirement), which no batter faced.
  const next = innings.find(
    (b) =>
      (b.seq ?? 0) > (stored.seq ?? 0) &&
      Boolean(b.bowler_id) &&
      b.extra_type !== "penalty" &&
      b.extra_type !== "bonus" &&
      !(
        b.is_wicket &&
        RETIREMENT_TYPES.some((r) => r.value === b.dismissal_type)
      ),
  );
  const endsFrom =
    crossedBefore !== crossedNow && !stored.is_wicket && !edited.is_wicket && next
      ? {
          id: next.id,
          position: `${next.over_number ?? 0}.${next.ball_number ?? 1}`,
          crossesNow: crossedNow,
        }
      : null;
  return { result, conflict, blocked, endsFrom };
}

/** "Nitin batted on after this ball (0.4, 0.5). Who came in?" */
function LaterBatterFields({
  conflict,
  nameOf,
  players,
  value,
  onChange,
}: {
  conflict: NonNullable<EditCheck["conflict"]>;
  nameOf: (id: string | null | undefined) => string;
  players: TeamPlayer[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const out = nameOf(conflict.outId);
  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <p>
        {out} batted on after this ball ({conflict.positions.join(", ")}). If{" "}
        {out} was out here, those balls were the next batter&apos;s. Who came
        in?
      </p>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id="edit-later-batter" className="h-11" aria-label="Who came in">
          <SelectValue placeholder="Choose who came in" />
        </SelectTrigger>
        <SelectContent>
          {players
            .filter((p) => p.user_id !== conflict.outId)
            .map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.user?.full_name ?? "Unknown"}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The figures the edit changes, from the innings' log with it applied. */
function EditChanges({
  preview,
  checked,
  waiting,
  ready,
}: {
  preview: EditPreview;
  checked: EditCheck | null;
  /** The log is still being read. */
  waiting: boolean;
  /** The form says what happened (else there is nothing to work out). */
  ready: boolean;
}) {
  if (waiting) {
    return (
      <p className="text-xs text-muted-foreground">
        Working out what this changes…
      </p>
    );
  }
  if (!checked || !ready || (checked.conflict && !checked.result)) return null;
  return (
    <CorrectionChanges
      changes={checked.result?.changes ?? null}
      total={checked.result?.total ?? null}
      finished={preview.finished}
      nameOf={preview.nameOf}
    />
  );
}
