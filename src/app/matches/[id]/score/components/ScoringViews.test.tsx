import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "~/components/ui/tabs";
import type { Innings, Match, TeamPlayer } from "~/lib/match-types";
import type { ScoringSide } from "../scoring-views";
import type { FixInnings, LoggedBall } from "./FixMistakeDialog";
import {
  ScoringBalls,
  ScoringScoreLine,
  ScoringViewSwitch,
} from "./ScoringViews";

const player = (team: string, id: string, name: string): TeamPlayer =>
  ({ id: `tp_${id}`, team_id: team, user_id: id, user: { id, full_name: name } }) as TeamPlayer;

const SIDES: ScoringSide[] = [
  { id: "ta", name: "Vinayak 11", players: [player("ta", "a", "Sandeep sir"), player("ta", "b", "Vinayak")] },
  { id: "tb", name: "Omkar 11", players: [player("tb", "w1", "Kishor"), player("tb", "w2", "Karan")] },
];
const INNINGS: FixInnings[] = [
  { id: "i1", number: 1, teamId: "ta", label: "1st innings · Vinayak 11" },
];

const ball = (over: number, n: number, extra: Partial<LoggedBall> = {}): LoggedBall =>
  ({
    id: `b${over}.${n}`,
    innings_id: "i1",
    over_number: over,
    ball_number: n,
    seq: over * 10 + n,
    runs_scored: 1,
    extras: 0,
    extra_type: null,
    is_wicket: false,
    bowler_id: over === 0 ? "w1" : "w2",
    batsman_id: "a",
    non_striker_id: "b",
    ...extra,
  }) as LoggedBall;
const LOG = [ball(0, 1), ball(0, 2, { runs_scored: 4 }), ball(1, 1, { runs_scored: 6 })];

function renderBalls(props: Partial<React.ComponentProps<typeof ScoringBalls>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetchBallLog = vi.fn(async () => LOG);
  render(
    <QueryClientProvider client={client}>
      <ScoringBalls
        active
        ballLogKey={["log", "m1", "v1"]}
        fetchBallLog={fetchBallLog}
        offline={false}
        innings={INNINGS}
        defaultInningsId="i1"
        sides={SIDES}
        unsaved={0}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { fetchBallLog };
}

describe("ScoringViewSwitch", () => {
  it("offers the three views as tabs and switches between them", () => {
    const onChange = vi.fn();
    render(
      <Tabs value="score" onValueChange={onChange} swipeable={false}>
        <ScoringViewSwitch />
      </Tabs>,
    );
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Score",
      "Scorecard",
      "Balls",
    ]);
    expect(screen.getByRole("tab", { name: "Score" })).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Balls" }));
    expect(onChange).toHaveBeenCalledWith("balls");
  });
});

describe("ScoringBalls", () => {
  it("lists each over latest first with its bowler and runs; a scorer's tap opens the ball", async () => {
    const onBall = vi.fn();
    const onBowler = vi.fn();
    renderBalls({ onBall, onBowler });
    expect(await screen.findByText(/Over 2 · Karan/)).toBeInTheDocument();
    const headings = screen.getAllByText(/^Over \d/).map((p) => p.textContent);
    expect(headings).toEqual(["Over 2 · Karan · 6 runs", "Over 1 · Kishor · 5 runs"]);
    fireEvent.click(screen.getByRole("button", { name: /^Ball 0\.2/ }));
    expect(onBall).toHaveBeenCalledWith("i1", "b0.2");
    fireEvent.click(screen.getByRole("button", { name: "Change the bowler of over 1" }));
    expect(onBowler).toHaveBeenCalledWith("i1", 0);
  });

  it("shows the balls without buttons to someone who does not score", async () => {
    renderBalls();
    expect(await screen.findByText(/Over 2 · Karan/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ball / })).toBeNull();
    expect(screen.queryByText(/Change bowler/)).toBeNull();
    expect(screen.queryByText(/Tap a ball to fix it/)).toBeNull();
  });

  it("reads the log only while the view is open, and never offline", () => {
    const closed = renderBalls({ active: false });
    expect(closed.fetchBallLog).not.toHaveBeenCalled();
  });

  it("says the balls need a connection offline", () => {
    const { fetchBallLog } = renderBalls({ offline: true });
    expect(fetchBallLog).not.toHaveBeenCalled();
    expect(screen.getByText(/The balls need a connection/)).toBeInTheDocument();
  });

  it("offers Try again when the log could not be read", async () => {
    renderBalls({ fetchBallLog: vi.fn(async () => Promise.reject(new Error("down"))) });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("ScoringScoreLine", () => {
  const match = {
    id: "m1",
    status: "live",
    balls_per_over: 6,
    overs_per_innings: 20,
  } as Match;
  const inn = (extra: Partial<Innings> = {}) =>
    ({ id: "i2", innings_number: 2, total_runs: 142, total_wickets: 4, total_balls: 99, ...extra }) as Innings;

  it("shows the score, then the chase", () => {
    render(<ScoringScoreLine match={match} innings={inn({ target_runs: 169 })} battingName="HIL" />);
    expect(screen.getByText("142/4")).toBeInTheDocument();
    expect(screen.getByText("(16.3 ov)")).toBeInTheDocument();
    expect(screen.getByText(/need 27 runs from 21 balls/i)).toBeInTheDocument();
  });

  it("shows the run rate without a target, and the result once over", () => {
    const { rerender } = render(
      <ScoringScoreLine match={match} innings={inn({ innings_number: 1 })} battingName="HIL" />,
    );
    expect(screen.getByText(/Run rate/)).toHaveTextContent("Run rate 8.61");
    rerender(
      <ScoringScoreLine
        match={{ ...match, status: "completed", result_description: "HIL won by 4 wickets" }}
        innings={inn()}
        battingName="HIL"
      />,
    );
    expect(screen.getByText("HIL won by 4 wickets")).toBeInTheDocument();
  });
});
