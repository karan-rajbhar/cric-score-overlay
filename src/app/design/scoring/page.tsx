"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LiveMatchHUD } from "~/components/matches/live-match-hud";
import { ScoringPanel } from "~/components/matches/scoring-panel";
import { Segmented } from "~/components/ds/tabs";
import type { Innings, Match } from "~/lib/match-types";

/*
 * Dev-only preview of the scoring console (HUD + keypad) with sample data,
 * for checking its look without a signed-in scorer. Full screen, like the
 * real /matches/[id]/score route (no app shell).
 */

const MATCH: Match = {
  id: "preview",
  title: "Summer League · Match 12",
  match_format: "T20",
  overs_per_innings: 20,
  balls_per_over: 6,
  status: "live",
  current_innings: 2,
  current_over: 16,
  current_ball: 3,
  team1_id: "riv",
  team2_id: "hil",
  team1: { id: "riv", name: "Riverside Warriors", short_name: "RIV" },
  team2: { id: "hil", name: "Hilltop Hawks", short_name: "HIL" },
  innings: [
    {
      id: "inn-1",
      match_id: "preview",
      innings_number: 1,
      team_id: "riv",
      total_runs: 168,
      total_wickets: 6,
      total_balls: 120,
      total_overs: 20,
      is_completed: true,
      extras_total: 9,
      extras_byes: 1,
      extras_leg_byes: 2,
      extras_wides: 5,
      extras_no_balls: 1,
      extras_penalties: 0,
    },
  ],
};

const INNINGS: Innings = {
  id: "inn-2",
  match_id: "preview",
  innings_number: 2,
  team_id: "hil",
  total_runs: 142,
  total_wickets: 4,
  total_balls: 99,
  total_overs: 16.3,
  is_completed: false,
  target_runs: 169,
  extras_total: 7,
  extras_byes: 0,
  extras_leg_byes: 2,
  extras_wides: 4,
  extras_no_balls: 1,
  extras_penalties: 0,
};

const STRIKER = { id: "b1", name: "Arjun Mehta", runs: 58, balls: 41, fours: 5, sixes: 2, isStriker: true };
const NON_STRIKER = { id: "b2", name: "Kabir Shah", runs: 12, balls: 9, fours: 1, sixes: 0, isStriker: false };
const BOWLER = { id: "w1", name: "Imran Qureshi", overs: 2.3, maidens: 0, runs: 19, wickets: 1 };
const LAST_BALLS = ["1", "0", "4"];
const noop = () => {};
const emptySubscribe = () => () => {};

type Mode = "normal" | "free-hit" | "undone" | "sunlight";

export default function ScoringPreviewPage() {
  const [mode, setMode] = useState<Mode>("normal");
  const sunlight = mode === "sunlight";
  // Into <body>, above the app shell (whose stacking context would trap a
  // fixed layer), like the real console which renders without the shell.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div
      data-sunlight={sunlight ? "true" : undefined}
      className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground"
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-3 p-2.5 sm:gap-4 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-sm font-semibold">Scoring console preview</h1>
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
        </div>
        <LiveMatchHUD
          match={MATCH}
          currentInnings={INNINGS}
          striker={STRIKER}
          nonStriker={NON_STRIKER}
          bowler={BOWLER}
          lastBalls={LAST_BALLS}
          battingTeamName="Hilltop Hawks"
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
          currentOver={16}
          currentBall={3}
          lastBalls={LAST_BALLS}
          isFreeHit={mode === "free-hit"}
          sunlightMode={sunlight}
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
      </div>
    </div>,
    document.body,
  );
}
