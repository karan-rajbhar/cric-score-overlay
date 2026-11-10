import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import type { Innings } from "~/lib/match-types";
import { SummaryCard } from "./suite-views";
import type { LiveMatchState } from "./types";

const innings = DEMO_MATCH_DETAILS.innings as Innings[];
const first = innings.find((i) => i.innings_number === 1)!;
const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, " ") ?? "";

const breakCard = (state: Partial<LiveMatchState>, list = innings) =>
  text(
    render(
      <SummaryCard
        state={{ ...DEMO_MATCH_STATE, total_runs: 0, total_balls: 0, ...state }}
        match={DEMO_MATCH_DETAILS}
        innings={list}
        breakCard
      />,
    ).container,
  );

describe("the innings break card", () => {
  it("shows a DLS-revised target", () => {
    const card = breakCard({ innings_number: 2, target_runs: 98, dls_overs: 12 });
    expect(card).toContain("Target 98");
    expect(card).toContain(`${first.total_runs}/${first.total_wickets}`);
  });

  it("before a super over's chase, shows the super over and its target", () => {
    const so: Innings = {
      ...first,
      id: "so-1",
      innings_number: 3,
      total_runs: 11,
      total_wickets: 1,
      total_balls: 6,
      batting_performances: [],
      bowling_performances: [],
    };
    const card = breakCard({ innings_number: 4, target_runs: 12 }, [
      ...innings,
      so,
    ]);
    expect(card).toContain("Target 12");
    expect(card).toContain("11/1");
    expect(card).not.toContain(`Target ${first.total_runs + 1}`);
  });
});
