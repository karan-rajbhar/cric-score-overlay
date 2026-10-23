"use client";

// TEMPORARY (not committed): screenshots of layouts and data the gallery has no switch for.

import { galleryElementProps, type GalleryState } from "~/components/overlay/packages/gallery";
import { OverlayElement } from "~/components/overlay/packages/element";
import { OverlayPackageScope } from "~/components/overlay/packages/registry";
import type { OverlayElementId } from "~/components/overlay/packages/types";
import { DEFAULT_CUSTOM_COLOURS } from "~/components/overlay/overlay-themes";
import type { Innings, Match } from "~/lib/match-types";
import type { LiveMatchState } from "~/components/overlay/types";

const LONG = "Christopher Wolstenholme";
const LONG_TEAM = "Chesterfield Park Rovers";

function testMatch(base: Match, third: number, fourth: boolean): { match: Match; inn: Innings[] } {
  const [i1, i2] = base.innings ?? [];
  const t1 = base.team1_id;
  const t2 = base.team2_id;
  const mk = (n: number, team: string, runs: number, wkts: number, balls: number, done: boolean, from: Innings): Innings => ({
    ...from,
    id: `test-inn-${n}`,
    innings_number: n,
    team_id: team,
    total_runs: runs,
    total_wickets: wkts,
    total_balls: balls,
    total_overs: Math.floor(balls / 6),
    is_completed: done,
  });
  const inn = [
    mk(1, t1, 325, 10, 612, true, i1!),
    mk(2, t2, 412, 10, 720, true, i2!),
    mk(3, t1, third, fourth ? 10 : 2, fourth ? 500 : 190, fourth, i1!),
  ];
  if (fourth) inn.push(mk(4, t2, 36, 1, 70, false, i2!));
  return { match: { ...base, match_format: "Test", innings: inn }, inn };
}

export function Scratch({ c, element, k }: { c: string; element: string; k: string }) {
  const id = (element || "scoreBug") as OverlayElementId;
  const stateName: GalleryState = "live";
  const props = galleryElementProps(id, { state: stateName, theme: "test-classic", kind: k || null }) as unknown as Record<string, unknown> & {
    state: LiveMatchState;
    match: Match;
  };
  let state = props.state;
  let match = props.match;
  let layout = "bottom";
  if (c === "top") layout = "top";
  if (c === "compact") layout = "compact";
  if (c === "trail" || c === "lead") {
    const runs = c === "trail" ? 60 : 160;
    const t = testMatch(match, runs, false);
    match = t.match;
    state = {
      ...state,
      match_format: "Test",
      overs_per_innings: null,
      innings_number: 3,
      current_innings: 3,
      total_runs: runs,
      total_wickets: 2,
      total_balls: 190,
      batting_team_name: state.team1_name,
      batting_team_short_name: state.team1_short_name,
      bowling_team_name: state.team2_name,
      bowling_team_short_name: state.team2_short_name,
      target_runs: null,
      runs_needed: null,
      balls_remaining: null,
      required_run_rate: null,
    };
  }
  if (c === "chase4") {
    const t = testMatch(match, 191, true);
    match = t.match;
    state = {
      ...state,
      match_format: "Test",
      overs_per_innings: null,
      innings_number: 4,
      current_innings: 4,
      total_runs: 36,
      total_wickets: 1,
      total_balls: 70,
      batting_team_name: state.team2_name,
      batting_team_short_name: state.team2_short_name,
      bowling_team_name: state.team1_name,
      bowling_team_short_name: state.team1_short_name,
      target_runs: 105,
      runs_needed: 69,
      balls_remaining: null,
      required_run_rate: null,
    };
  }
  if (c === "long") {
    state = {
      ...state,
      striker_name: LONG,
      non_striker_name: "Bartholomew Featherstone",
      current_bowler_name: "Maximilian Ashcroft-Hale",
      batting_team_name: LONG_TEAM,
      team1_name: LONG_TEAM,
      team1_short_name: "CPR",
    };
  }
  const all = { ...props, state, match, layout } as never;
  if (id === "sting" && c === "long") {
    (all as { sting: { subtitle: string } }).sting.subtitle = LONG;
  }
  if ((id === "newBatter") && c === "long") {
    (all as { strap: { title: string } }).strap.title = LONG;
  }
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ width: 1920, height: 1080 }}>
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          background:
            "linear-gradient(180deg, #8fa3b8 0%, #b8c4cf 18%, #3d5a2a 18.5%, #4f7a32 30%, transparent 30%), repeating-linear-gradient(90deg, #4c8a2e 0px, #4c8a2e 120px, #5a9a38 120px, #5a9a38 240px)",
        }}
      />
      <OverlayPackageScope theme="test-classic" customColors={DEFAULT_CUSTOM_COLOURS} state={state}>
        <OverlayElement id={id} present props={all} />
        {c === "with-strap" && (
          <OverlayElement id="scoreBug" present props={galleryElementProps("scoreBug", { state: stateName, theme: "test-classic" }) as never} />
        )}
      </OverlayPackageScope>
    </div>
  );
}
