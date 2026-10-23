"use client";

import { useState } from "react";
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
}

const nameOf = (players: TeamPlayer[], id: string | null | undefined) =>
  players.find((p) => p.user_id === id)?.user?.full_name ?? null;

const chip = (selected: boolean) =>
  cn(
    "flex min-h-11 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors",
    selected
      ? "border-transparent bg-primary text-primary-foreground"
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
}: {
  form: Form;
  set: SetForm;
  nonStriker: string | null;
  battingTeamPlayers: TeamPlayer[];
  bowlingTeamPlayers: TeamPlayer[];
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
}: EditBallDialogProps) {
  const [form, setForm] = useState<Form | null>(
    delivery ? formOfDelivery(delivery) : null,
  );
  const [error, setError] = useState<string | null>(null);
  // A fresh form for each ball, and each time the dialog opens.
  const key = `${open}:${delivery?.id ?? ""}`;
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setForm(delivery ? formOfDelivery(delivery) : null);
    setError(null);
  }

  if (!delivery || !form) return null;
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });

  // Runs awarded between balls are not deliveries: undo them instead.
  const isEvent =
    delivery.extra_type === "penalty" ||
    delivery.extra_type === "bonus" ||
    !delivery.bowler_id;
  const position = `${delivery.over_number ?? 0}.${delivery.ball_number ?? 1}`;
  const missing = correctionMissing(form);

  const save = async () => {
    if (missing) return;
    setError(null);
    const res = await onSave(correctionOf(delivery, form));
    const err = res && "error" in res ? res.error : null;
    if (err) setError(err);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
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
            />
            <PlayerFields
              form={form}
              set={set}
              battingTeamPlayers={battingTeamPlayers}
              bowlingTeamPlayers={bowlingTeamPlayers}
            />
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
