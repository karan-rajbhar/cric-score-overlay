"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ds/button";
import { ChoiceGroup } from "~/components/ds/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { readBallLabel } from "~/components/matches/scoring-panel";
import {
  deliveryLabel,
  dismissesEitherBatter,
  isWicketFall,
} from "~/lib/cricket";
import type { TeamPlayer } from "~/lib/match-types";
import type {
  CorrectOverBowlerPayload,
  SwapBattersPayload,
} from "~/lib/offline-queue";
import {
  battingAfterOut,
  overBowlerFixes,
  swapBattersFixes,
  withFixes,
  type BallPlayersFix,
} from "~/lib/scoring-correction";
import { cn } from "~/lib/utils";
import { previewChanges, type PreviewRules } from "../correction-preview";
import { CorrectionChanges } from "./CorrectionChanges";
import type { LoggedBall } from "./EditBallDialog";

export type { LoggedBall };

/** An innings to correct, in the switch at the top. */
export interface FixInnings {
  id: string;
  number: number;
  /** The batting side. */
  teamId: string;
  /** "1st innings · Omkar 11". */
  label: string;
}

/** A side, with its squad (names and who may bat or bowl). */
export interface FixTeam {
  id: string;
  name: string;
  players: TeamPlayer[];
}

/**
 * Opens straight on one fix (Back closes it, as the screen behind already
 * shows the balls): a wicket given to the wrong batter, what can be fixed
 * on a ball, or who bowled an over (the Balls view's taps).
 */
export type FixStart =
  | {
      inningsId: string;
      ballId: string;
      /** "ends": the batters were at the wrong ends from this ball. */
      mode: "wrong_batter_out" | "ball" | "ends";
    }
  | { inningsId: string; over: number; mode: "bowler" };

type Result = Promise<{ error: string | null }>;

type View =
  | { kind: "list" }
  | { kind: "ball"; ballId: string }
  | { kind: "swap"; ballId: string; wrongOut: boolean }
  | { kind: "bowler"; over: number };

type Until = "over" | "wicket" | "innings";

/** This innings' deliveries by over, latest over first (no events). */
export function oversToCorrect(
  balls: LoggedBall[],
  inningsId: string,
): Array<{ over: number; balls: LoggedBall[] }> {
  const byOver = new Map<number, LoggedBall[]>();
  for (const b of balls) {
    if (b.innings_id !== inningsId) continue;
    // Retirements and runs awarded are logged between balls: undo them.
    if (!b.bowler_id || b.penalty_team_id) continue;
    if (b.extra_type === "penalty" || b.extra_type === "bonus") continue;
    const over = b.over_number ?? 0;
    byOver.set(over, [...(byOver.get(over) ?? []), b]);
  }
  return Array.from(byOver.entries())
    .sort(([a], [b]) => b - a)
    .map(([over, list]) => ({
      over,
      balls: list.sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0)),
    }));
}

/** Every entry of one innings (events included), in `seq` order. */
function inningsLog(balls: LoggedBall[], inningsId: string): LoggedBall[] {
  return balls
    .filter((b) => b.innings_id === inningsId)
    .sort(
      (x, y) =>
        (x.seq ?? 0) - (y.seq ?? 0) ||
        (x.over_number ?? 0) - (y.over_number ?? 0) ||
        (x.ball_number ?? 0) - (y.ball_number ?? 0),
    );
}

const position = (b: { over_number?: number | null; ball_number?: number | null }) =>
  `${b.over_number ?? 0}.${b.ball_number ?? 1}`;

/** A striker-only wicket that may have been given to the wrong batter. */
function canGoToOtherBatter(b: LoggedBall): boolean {
  return (
    isWicketFall(b) &&
    !dismissesEitherBatter(b.dismissal_type) &&
    Boolean(b.non_striker_id)
  );
}

/**
 * Fix a mistake: every ball of each innings, during or after the match.
 * A ball opens what can be fixed on it (Edit ball, the batters at the
 * wrong ends from there, a wicket given to the wrong batter); each over
 * says who bowled it and changes that for the whole over. A correction
 * shows the figures it changes before it is saved, and the scorecard is
 * worked out again from every ball. docs/scoring-corrections.md, phase 1.
 */
export function FixMistakeDialog({
  open,
  onOpenChange,
  innings,
  defaultInningsId,
  teams,
  rules,
  loadBalls,
  onEditBall,
  onSwapBatters,
  onCorrectOverBowler,
  start = null,
  offline = false,
  unsaved = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The match's innings, first to last. */
  innings: FixInnings[];
  /** The innings shown first (the one in play, or the last). */
  defaultInningsId: string | null;
  teams: FixTeam[];
  /** The match's settings, for the figures a correction would give. */
  rules: PreviewRules;
  /** The match's ball log (`getMatchBallLog`). */
  loadBalls: () => Promise<LoggedBall[]>;
  /**
   * Edit ball, with the side that batted in the ball's innings and the
   * match's ball log already read (for its preview).
   */
  onEditBall: (
    ball: LoggedBall,
    battingTeamId: string,
    log: LoggedBall[],
  ) => void;
  onSwapBatters: (payload: SwapBattersPayload) => Result;
  onCorrectOverBowler: (payload: CorrectOverBowlerPayload) => Result;
  start?: FixStart | null;
  offline?: boolean;
  /** Actions still waiting to be saved (their balls are not listed yet). */
  unsaved?: number;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; balls: LoggedBall[] }
  >({ status: "loading" });
  const firstView = (): View => {
    switch (start?.mode) {
      case "wrong_batter_out":
        return { kind: "swap", ballId: start.ballId, wrongOut: true };
      case "ends":
        return { kind: "swap", ballId: start.ballId, wrongOut: false };
      case "ball":
        return { kind: "ball", ballId: start.ballId };
      case "bowler":
        return { kind: "bowler", over: start.over };
      default:
        return { kind: "list" };
    }
  };
  const [inningsId, setInningsId] = useState<string | null>(
    start?.inningsId ?? defaultInningsId,
  );
  const [view, setView] = useState<View>(firstView);
  // Read afresh and start over each time it opens.
  const [seen, setSeen] = useState(open);
  if (seen !== open) {
    setSeen(open);
    if (open) {
      setState({ status: "loading" });
      setInningsId(start?.inningsId ?? defaultInningsId);
      setView(firstView());
    }
  }

  useEffect(() => {
    if (!open || offline) return;
    let live = true;
    loadBalls()
      .then((balls) => {
        if (live) setState({ status: "ready", balls });
      })
      .catch(() => {
        if (live) setState({ status: "error" });
      });
    return () => {
      live = false;
    };
  }, [open, offline, loadBalls]);

  const current = innings.find((i) => i.id === inningsId) ?? null;
  const bowlingTeam = teams.find((t) => t.id !== current?.teamId) ?? null;
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams)
      for (const p of t.players)
        if (p.user?.full_name) map.set(p.user_id, p.user.full_name);
    return map;
  }, [teams]);
  const nameOf = (id: string | null | undefined) =>
    (id && names.get(id)) || "Unknown player";

  const balls = state.status === "ready" ? state.balls : [];
  const log = current ? inningsLog(balls, current.id) : [];
  const ballOf = (id: string) => log.find((b) => b.id === id) ?? null;

  const close = () => onOpenChange(false);
  // Back from where it opened closes it; otherwise, to the list.
  const back = start ? close : () => setView({ kind: "list" });

  let body: React.ReactNode;
  if (offline) {
    body = (
      <p className="text-sm text-muted-foreground">
        Fixing a mistake needs a connection. The balls of this over can be
        undone instead.
      </p>
    );
  } else if (state.status === "loading") {
    body = (
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading the balls…
      </p>
    );
  } else if (state.status === "error") {
    body = (
      <p role="alert" className="text-sm text-destructive">
        Could not load the balls. Check the connection and try again.
      </p>
    );
  } else if (view.kind === "ball" && ballOf(view.ballId) && current) {
    const ball = ballOf(view.ballId)!;
    body = (
      <BallChoices
        ball={ball}
        nameOf={nameOf}
        onEdit={() => onEditBall(ball, current.teamId, balls)}
        onSwap={(wrongOut) =>
          setView({ kind: "swap", ballId: ball.id, wrongOut })
        }
        onBack={back}
      />
    );
  } else if (view.kind === "swap" && ballOf(view.ballId) && current) {
    body = (
      <SwapBatters
        key={`${view.ballId}-${view.wrongOut}`}
        log={log}
        from={ballOf(view.ballId)!}
        wrongOut={view.wrongOut}
        rules={rules}
        inningsTeamId={current.teamId}
        nameOf={nameOf}
        // Back to the ball's choices it came from; closed when it opened here.
        onBack={
          start?.mode === "wrong_batter_out"
            ? close
            : start?.mode === "ball"
              ? () => setView({ kind: "ball", ballId: view.ballId })
              : () => setView({ kind: "list" })
        }
        onConfirm={async (toBallId, done) => {
          const res = await onSwapBatters({
            inningsId: current.id,
            fromBallId: view.ballId,
            toBallId,
          });
          if (!res.error) {
            toast.success(done);
            close();
          }
          return res;
        }}
      />
    );
  } else if (view.kind === "bowler" && current) {
    body = (
      <OverBowler
        key={view.over}
        log={log}
        over={view.over}
        bowlers={bowlingTeam?.players ?? []}
        rules={rules}
        inningsTeamId={current.teamId}
        nameOf={nameOf}
        onBack={back}
        onConfirm={async (bowlerId, done) => {
          const res = await onCorrectOverBowler({
            inningsId: current.id,
            overNumber: view.over,
            bowlerId,
          });
          if (!res.error) {
            toast.success(done);
            close();
          }
          return res;
        }}
      />
    );
  } else {
    body = (
      <OverList
        innings={innings}
        inningsId={inningsId}
        onInnings={setInningsId}
        overs={current ? oversToCorrect(balls, current.id) : []}
        nameOf={nameOf}
        onBall={(ballId) => setView({ kind: "ball", ballId })}
        onBowler={(over) => setView({ kind: "bowler", over })}
        unsaved={unsaved}
      />
    );
  }

  const listing = view.kind === "list" || state.status !== "ready" || offline;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fix a mistake</DialogTitle>
          <DialogDescription>
            {listing
              ? "Tap the ball where it went wrong, or change who bowled an over. The scorecard is worked out again from every ball."
              : "The scorecard is worked out again from every ball."}
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** The runs an over's balls gave (events between balls aside). */
function overRuns(balls: LoggedBall[]): number {
  return balls.reduce(
    (sum, b) => sum + (b.runs_scored ?? 0) + (b.extras ?? 0),
    0,
  );
}

/**
 * Every over of the innings shown, latest first: its bowler, runs and
 * balls. Fix a mistake's list, and the scoring screen's Balls view.
 */
export function OverList({
  name = "fix-innings",
  innings,
  inningsId,
  onInnings,
  overs,
  nameOf,
  onBall,
  onBowler,
  unsaved,
}: {
  /** The innings radios' group name (unique on the screen). */
  name?: string;
  innings: FixInnings[];
  inningsId: string | null;
  onInnings: (id: string) => void;
  overs: Array<{ over: number; balls: LoggedBall[] }>;
  nameOf: (id: string | null | undefined) => string;
  /** Tapping a ball (none: the balls are not buttons). */
  onBall?: (ballId: string) => void;
  /** Change bowler on each over (none: not offered). */
  onBowler?: (over: number) => void;
  unsaved: number;
}) {
  return (
    <div className="space-y-4">
      {innings.length > 1 && (
        <ChoiceGroup
          legend="Innings"
          name={name}
          options={innings.map((i) => ({ value: i.id, label: i.label }))}
          value={inningsId}
          onChange={onInnings}
        />
      )}
      {overs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No balls in this innings yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {overs.map(({ over, balls }) => (
            <li key={over} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
                  Over {over + 1} · {nameOf(balls[0]?.bowler_id)} ·{" "}
                  <span className="font-score tabular-nums">
                    {overRuns(balls)}
                  </span>{" "}
                  {overRuns(balls) === 1 ? "run" : "runs"}
                </p>
                {onBowler && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 max-sm:min-h-11"
                    aria-label={`Change the bowler of over ${over + 1}`}
                    onClick={() => onBowler(over)}
                  >
                    Change bowler
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {balls.map((b) => (
                  <BallButton
                    key={b.id}
                    ball={b}
                    onClick={onBall ? () => onBall(b.id) : undefined}
                  />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
      {unsaved > 0 && (
        <p className="text-xs text-muted-foreground">
          Balls not saved yet are not listed.
        </p>
      )}
    </div>
  );
}

function BallButton({
  ball,
  onClick,
}: {
  ball: LoggedBall;
  /** None: shown, not a button. */
  onClick?: () => void;
}) {
  const label = deliveryLabel(ball);
  const read = readBallLabel(label);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : { role: "img" })}
      aria-label={`Ball ${position(ball)}: ${read.spoken}`}
      className={cn(
        "flex h-11 min-w-11 items-center justify-center rounded-full border px-2 font-score text-xs font-bold tabular-nums transition-colors",
        onClick && "hover:bg-muted",
        read.kind === "wicket"
          ? "border-wicket bg-wicket text-wicket-foreground"
          : read.kind === "four"
            ? "border-four bg-four text-four-foreground"
            : read.kind === "six"
              ? "border-six bg-six text-six-foreground"
              : read.kind === "extra"
                ? "border-dashed border-extra/60 bg-extra/15 text-extra"
                : "border-border bg-background text-foreground",
      )}
    >
      {label}
    </Tag>
  );
}

/** A full-width choice: what it fixes, in a line under it. */
function ChoiceButton({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block min-h-11 w-full rounded-lg border border-border bg-card p-3.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block font-medium text-foreground">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function BallChoices({
  ball,
  nameOf,
  onEdit,
  onSwap,
  onBack,
}: {
  ball: LoggedBall;
  nameOf: (id: string | null | undefined) => string;
  onEdit: () => void;
  onSwap: (wrongOut: boolean) => void;
  onBack: () => void;
}) {
  const striker = nameOf(ball.batsman_id);
  const other = ball.non_striker_id ? nameOf(ball.non_striker_id) : null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        <span className="font-semibold">Ball {position(ball)}</span>:{" "}
        {nameOf(ball.bowler_id)} to {striker}
        {other ? `, ${other} at the other end` : ""}.
      </p>
      <div className="space-y-2">
        <ChoiceButton
          title="Edit this ball"
          description="Runs, extras, how out, the fielder, the striker or the bowler."
          onClick={onEdit}
        />
        {other && (
          <ChoiceButton
            title="The batters were at the wrong ends from here"
            description={`${striker} and ${other} change places from this ball.`}
            onClick={() => onSwap(false)}
          />
        )}
        {other && canGoToOtherBatter(ball) && (
          <ChoiceButton
            title="The wrong batter was given out"
            description={`${other} was out, not ${striker}.`}
            onClick={() => onSwap(true)}
          />
        )}
      </div>
      <Button variant="ghost" className="w-full" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}

function useSaving() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Result) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fn();
      if (res.error) setError(res.error);
    } catch {
      setError("Could not save the correction. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

function SwapBatters({
  log,
  from,
  wrongOut,
  rules,
  inningsTeamId,
  nameOf,
  onBack,
  onConfirm,
}: {
  log: LoggedBall[];
  from: LoggedBall;
  wrongOut: boolean;
  rules: PreviewRules;
  inningsTeamId: string;
  nameOf: (id: string | null | undefined) => string;
  onBack: () => void;
  onConfirm: (toBallId: string | null, done: string) => Result;
}) {
  const [until, setUntil] = useState<Until | null>(wrongOut ? "innings" : null);
  const { saving, error, run } = useSaving();
  const startAt = log.findIndex((b) => b.id === from.id);
  const rest = log.slice(startAt);
  const overEnd = [...rest]
    .filter((b) => b.over_number === from.over_number)
    .at(-1);
  const nextWicket = rest.find((b) => isWicketFall(b));
  const endOf: Record<Until, LoggedBall | null> = {
    over: overEnd ?? from,
    wicket: nextWicket ?? null,
    innings: null,
  };
  const a = from.batsman_id ?? null;
  const b = from.non_striker_id ?? null;
  const toBallId = until ? (endOf[until]?.id ?? null) : null;
  const range = until ? swapBattersFixes(log, from.id, toBallId) : null;
  const after = range ? withFixes(log, range.fixes) : null;
  const blocked = after
    ? [...battingAfterOut(after)].some((k) => !battingAfterOut(log).has(k))
    : false;
  const changes =
    after && a && b
      ? previewChanges(
          rules,
          { id: log[0]?.innings_id ?? "", team_id: inningsTeamId },
          log,
          after,
          [a, b],
        )
      : null;

  const options: { value: Until; label: string; description?: string }[] = [];
  if (overEnd && overEnd.id !== from.id)
    options.push({
      value: "over",
      label: "The end of this over",
      description: `To ${position(overEnd)}`,
    });
  if (nextWicket)
    options.push({
      value: "wicket",
      label: "The next wicket, including it",
      description: `To ${position(nextWicket)}`,
    });
  options.push({ value: "innings", label: "The end of the innings" });

  const at = position(from);
  const pair = `${nameOf(a)} and ${nameOf(b)}`;
  const done = wrongOut
    ? `Wicket at ${at} given to ${nameOf(b)}`
    : `${pair} swapped from ${at}`;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="font-semibold text-foreground">
          {wrongOut
            ? "The wrong batter was given out"
            : "The batters were at the wrong ends"}
        </p>
        <p className="text-sm text-muted-foreground">
          {wrongOut
            ? `Only the striker can be out ${from.dismissal_type?.replace(/_/g, " ") ?? "this way"}, so ${nameOf(b)} faced ball ${at}. From this ball to the end of the innings ${pair} change places: as striker, non-striker and the batter out.`
            : `From ball ${at}, ${pair} change places on every ball until the point you choose: as striker, non-striker and the batter out.`}
        </p>
      </div>
      {!wrongOut && (
        <ChoiceGroup
          legend="Until"
          name="fix-until"
          layout="cards"
          options={options}
          value={until}
          onChange={setUntil}
        />
      )}
      {blocked ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          That would put a batter at the crease after they were out. Choose
          where the mix-up ends.
        </p>
      ) : (
        <CorrectionChanges changes={changes} nameOf={nameOf} />
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          disabled={!range || range.fixes.length === 0 || blocked}
          loading={saving}
          onClick={() => void run(() => onConfirm(toBallId, done))}
        >
          {wrongOut ? `Give the wicket to ${nameOf(b)}` : "Swap them"}
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          Back
        </Button>
      </div>
    </div>
  );
}

function OverBowler({
  log,
  over,
  bowlers,
  rules,
  inningsTeamId,
  nameOf,
  onBack,
  onConfirm,
}: {
  log: LoggedBall[];
  over: number;
  bowlers: TeamPlayer[];
  rules: PreviewRules;
  inningsTeamId: string;
  nameOf: (id: string | null | undefined) => string;
  onBack: () => void;
  onConfirm: (bowlerId: string, done: string) => Result;
}) {
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  const { saving, error, run } = useSaving();
  const planned = bowlerId ? overBowlerFixes(log, over, bowlerId) : null;
  const fixes: BallPlayersFix[] = planned?.fixes ?? [];
  const from =
    log.find((b) => b.over_number === over && b.bowler_id)?.bowler_id ?? null;
  const changes =
    bowlerId && planned
      ? previewChanges(
          rules,
          { id: log[0]?.innings_id ?? "", team_id: inningsTeamId },
          log,
          withFixes(log, fixes),
          [from, bowlerId].filter((x): x is string => Boolean(x)),
        )
      : null;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Who bowled over {over + 1}?</p>
        <p className="text-sm text-muted-foreground">
          The scorecard has {nameOf(from)}. Every ball of the over moves to the
          player you pick, with its runs, wickets and maidens. Catches stay
          with their fielders.
        </p>
      </div>
      <ChoiceGroup
        legend="Bowler"
        name="fix-bowler"
        options={bowlers.map((p) => ({
          value: p.user_id,
          label: p.user?.full_name ?? "Unknown player",
        }))}
        value={bowlerId}
        onChange={setBowlerId}
      />
      <CorrectionChanges changes={changes} nameOf={nameOf} />
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          disabled={!bowlerId || fixes.length === 0}
          loading={saving}
          onClick={() =>
            bowlerId &&
            void run(() =>
              onConfirm(
                bowlerId,
                `Over ${over + 1} given to ${nameOf(bowlerId)}`,
              ),
            )
          }
        >
          {bowlerId
            ? `Give over ${over + 1} to ${nameOf(bowlerId)}`
            : "Choose who bowled"}
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          Back
        </Button>
      </div>
    </div>
  );
}
