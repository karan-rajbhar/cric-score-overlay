"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Flag,
  Loader2,
  MoreHorizontal,
  Share2,
  SlidersHorizontal,
  Sun,
  Tv,
  UserCog,
  Users,
  WifiOff,
} from "lucide-react";
import { LiveMatchHUD } from "~/components/matches/live-match-hud";
import { ScoringPanel } from "~/components/matches/scoring-panel";
import { ActionMenu } from "~/components/ds/action-menu";
import { Button, buttonVariants } from "~/components/ds/button";
import { Chip, chipVariants } from "~/components/ds/chip";
import { ScreenWash } from "~/components/ds/screen";
import { Segmented } from "~/components/ds/tabs";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { BatsmenDialog } from "~/app/matches/[id]/score/components/BatsmenDialog";
import {
  ScoringBalls,
  ScoringScoreLine,
  ScoringScorecard,
  ScoringViewSwitch,
} from "~/app/matches/[id]/score/components/ScoringViews";
import {
  DEFAULT_SCORING_VIEW,
  scoringViewFrom,
  type ScoringView,
} from "~/app/matches/[id]/score/scoring-views";
import { cn } from "~/lib/utils";
import {
  BALL_LOG,
  BOWLER,
  CHASE,
  HILLTOP_SQUAD,
  LAST_BALLS,
  MATCH,
  NON_STRIKER,
  SIDES,
  STRIKER,
} from "./sample-scoring";

/*
 * Dev-only reference of the scoring screen (docs/scoring-screen-ux.md): the
 * real pieces on a sample chase, as /design/match does for the match page.
 * The top bar's switch, the score card, the keypad, Scorecard, Balls and the
 * batter dialog are the screen's own components; only the bar's frame and
 * the save status (from the screen's state) are drawn here. Open it at
 * phone width (360 by 640, 390 by 844) to judge the fit.
 */

const noop = () => {};
const emptySubscribe = () => () => {};

/** The keypad states worth checking. */
type Mode = "normal" | "free-hit" | "undone" | "sunlight";
/** What the score card's top right says about saving. */
type Status = "saved" | "saving" | "unsaved" | "offline" | "other";

export default function ScoringDesignPage() {
  const [view, setView] = useState<ScoringView>(DEFAULT_SCORING_VIEW);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("saved");
  const [openers, setOpeners] = useState(false);
  const [options, setOptions] = useState(true);
  // Into <body>, above the app shell, like the real console (no shell).
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return null;
  const sunlight = mode === "sunlight";

  return createPortal(
    <div
      data-sunlight={sunlight ? "true" : undefined}
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
    >
      {options ? (
        <div className="space-y-2 border-b border-border bg-muted/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-sm font-semibold">Scoring screen</h1>
            <Button size="sm" variant="ghost" onClick={() => setOptions(false)}>
              Hide options
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented
              label="State"
              value={mode}
              onChange={setMode}
              options={[
                { value: "normal", label: "Normal" },
                { value: "free-hit", label: "Free hit" },
                { value: "undone", label: "After undo" },
                { value: "sunlight", label: "Sunlight" },
              ]}
            />
            <Segmented
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "saved", label: "Saved" },
                { value: "saving", label: "Saving" },
                { value: "unsaved", label: "Not saved" },
                { value: "offline", label: "Offline" },
                { value: "other", label: "Co-scorer" },
              ]}
            />
            <Button size="sm" variant="outline" onClick={() => setOpeners(true)}>
              Opening batters
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOptions(true)}
          className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 rounded-t-md bg-foreground/60 px-3 text-xs font-medium text-background"
        >
          Options
        </button>
      )}

      <Tabs
        swipeable={false}
        value={view}
        onValueChange={(v) => setView(scoringViewFrom(v))}
        className={cn("flex min-h-0 flex-1 flex-col", sunlight && "sunlight-mode")}
      >
        <ScoringBarFrame sunlight={sunlight} />
        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          <TabsContent
            value="score"
            forceMount
            className="mt-0 flex-1 data-[state=inactive]:!hidden max-sm:flex max-sm:flex-col"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-2 pb-1 pt-1 max-sm:flex-1 sm:gap-4 sm:px-4 sm:py-6">
              <Console mode={mode} status={status} keysOff={view !== "score"} />
            </div>
          </TabsContent>
          <TabsContent value="scorecard" className="mt-0">
            <div className="mx-auto w-full max-w-3xl space-y-3 px-2 pb-4 pt-1.5 sm:px-4 sm:py-6">
              <ScoringScoreLine match={MATCH} innings={CHASE} battingName="HIL" />
              <ScoringScorecard match={MATCH} sides={SIDES} />
            </div>
          </TabsContent>
          <TabsContent value="balls" className="mt-0">
            <div className="mx-auto w-full max-w-3xl space-y-3 px-2 pb-4 pt-1.5 sm:px-4 sm:py-6">
              <ScoringScoreLine match={MATCH} innings={CHASE} battingName="HIL" />
              <ScoringBalls
                active={view === "balls"}
                ballLogKey={["design-scoring-balls"]}
                fetchBallLog={async () => BALL_LOG}
                offline={status === "offline"}
                innings={[{ id: CHASE.id, number: 2, teamId: "hil", label: "2nd innings · Hilltop Hawks" }]}
                defaultInningsId={CHASE.id}
                sides={SIDES}
                unsaved={status === "unsaved" ? 2 : 0}
                onBall={noop}
                onBowler={noop}
              />
            </div>
          </TabsContent>
        </main>
      </Tabs>

      <BatsmenDialog
        open={openers}
        onOpenChange={setOpeners}
        battingTeamPlayers={HILLTOP_SQUAD}
        battingTeamName="Hilltop Hawks"
        strikerId={null}
        nonStrikerId={null}
        onConfirm={() => setOpeners(false)}
        isProcessing={false}
      />
    </div>,
    document.body,
  );
}

/**
 * The top bar's frame (`ScoringBar` reads the screen's state, so it is
 * drawn here around the real switch): back, the views, Match tools.
 */
function ScoringBarFrame({ sunlight }: { sunlight: boolean }) {
  const bar = (
    <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-2.5 pb-1 pt-1 sm:px-4 sm:pb-1.5 sm:pt-2">
      <span
        role="img"
        aria-label="Exit scoring"
        className={cn(
          buttonVariants({ variant: "surface", size: "icon" }),
          "shrink-0",
          sunlight && "border-2 border-black bg-white text-black",
        )}
      >
        <ChevronLeft />
      </span>
      <ScoringViewSwitch
        sunlight={sunlight}
        className="min-w-0 flex-1 sm:mx-auto sm:max-w-md"
      />
      <ActionMenu
        title="Match tools"
        trigger={
          <Button
            variant="surface"
            size="icon"
            aria-label="Match tools"
            className={cn("shrink-0 sm:w-auto sm:px-4", sunlight && "border-2 border-black bg-white text-black")}
          >
            <span className="hidden sm:inline">Match tools</span>
            <MoreHorizontal className="sm:hidden" />
          </Button>
        }
        groups={[
          {
            items: [{ key: "sunlight", label: "Sunlight mode: Off", icon: Sun, onSelect: noop }],
          },
          {
            label: "This match",
            items: [
              { key: "squads", label: "Squads", icon: Users, onSelect: noop },
              { key: "settings", label: "Match settings", icon: SlidersHorizontal, onSelect: noop },
              { key: "replace", label: "Replace a player", icon: UserCog, onSelect: noop },
              { key: "end", label: "End innings", icon: Flag, onSelect: noop },
            ],
          },
          {
            label: "Share",
            items: [
              { key: "share", label: "Share the live score", icon: Share2, onSelect: noop },
              { key: "overlay", label: "Open the broadcast overlay", icon: Tv, onSelect: noop },
            ],
          },
        ]}
      />
    </div>
  );
  return (
    <header className={cn("shrink-0", sunlight && "border-b-2 border-black bg-white")}>
      {sunlight ? bar : <ScreenWash>{bar}</ScreenWash>}
    </header>
  );
}

/** The real score card and keypad, on the sample chase. */
function Console({
  mode,
  status,
  keysOff,
}: {
  mode: Mode;
  status: Status;
  keysOff: boolean;
}) {
  const sunlight = mode === "sunlight";
  return (
    <>
      <LiveMatchHUD
        match={MATCH}
        currentInnings={CHASE}
        striker={STRIKER}
        nonStriker={NON_STRIKER}
        bowler={BOWLER}
        lastBalls={LAST_BALLS}
        battingTeamName="Hilltop Hawks"
        sideOnPhones
        status={<StatusNote status={status} sunlight={sunlight} />}
        onSwapStriker={noop}
        onChangeStriker={noop}
        onChangeNonStriker={noop}
        onChangeBowler={noop}
        sunlightMode={sunlight}
      />
      <ScoringPanel
        onScore={noop}
        onWicket={noop}
        onUndo={noop}
        onRedo={noop}
        onSwapStriker={noop}
        onEditBalls={noop}
        currentOver={16}
        currentBall={3}
        lastBalls={LAST_BALLS}
        isFreeHit={mode === "free-hit"}
        sunlightMode={sunlight}
        keyboardSuppressed={keysOff}
        undoNotice={
          mode === "undone"
            ? {
                label: "Four",
                position: "16.3",
                players: "Qureshi to Mehta",
                note: null,
                pending: false,
                canRedo: true,
              }
            : null
        }
      />
    </>
  );
}

/**
 * The screen's save status (`ScoringStatus`, which reads the screen's
 * state), drawn as it shows on the score card.
 */
function StatusNote({ status, sunlight }: { status: Status; sunlight: boolean }) {
  const quiet = sunlight ? "text-black/70" : "text-board-muted";
  switch (status) {
    case "saved":
    case "saving":
      return (
        <span className={cn("flex items-center gap-1 px-1 text-xs font-medium", quiet)}>
          {status === "saved" ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          )}
          {status === "saved" ? "Saved" : "Saving…"}
        </span>
      );
    case "unsaved":
      return (
        <button type="button" className={chipVariants({ tone: "warning", size: "sm" })}>
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Not saved <span className="tabular-nums">(2)</span>
        </button>
      );
    case "offline":
      return (
        <Chip tone="warning" size="sm" role="status">
          <WifiOff className="h-3 w-3" aria-hidden="true" />
          Offline <span className="tabular-nums">(3)</span>
        </Chip>
      );
    case "other":
      return (
        <>
          <Chip tone="neutral" size="sm">
            <Users className="h-3 w-3" aria-hidden="true" />
            Karan also scoring
          </Chip>
          <Check className={cn("h-3 w-3", quiet)} aria-label="Saved" />
        </>
      );
  }
}
