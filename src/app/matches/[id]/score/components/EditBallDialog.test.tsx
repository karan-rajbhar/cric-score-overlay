import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TeamPlayer } from "~/lib/match-types";
import {
  EditBallDialog,
  correctionMissing,
  correctionOf,
  formOfDelivery,
  type DeliveryToEdit,
} from "./EditBallDialog";

const player = (id: string, name: string) =>
  ({ id: `tp-${id}`, team_id: "t", user_id: id, user: { id, full_name: name } }) as TeamPlayer;

const caught: DeliveryToEdit = {
  id: "ball-1",
  over_number: 3,
  ball_number: 2,
  runs_scored: 0,
  extras: 0,
  extra_type: null,
  is_wicket: true,
  dismissal_type: "caught",
  fielder_id: "f1",
  bowler_id: "w1",
  batsman_id: "a1",
  non_striker_id: "a2",
  dismissed_player_id: "a1",
};

describe("ball corrections in the keypad's terms", () => {
  it("keeps the catcher when only something else changes", () => {
    const form = formOfDelivery(caught);
    expect(form).toMatchObject({ isWicket: true, fielderId: "f1" });
    expect(correctionOf(caught, form)).toMatchObject({
      dismissalType: "caught",
      fielderId: "f1",
      dismissedPlayerId: "a1",
    });
  });

  it("reads and writes byes off a no-ball", () => {
    const nb: DeliveryToEdit = {
      id: "b2",
      extra_type: "no_ball",
      extras: 3,
      runs_scored: 0,
      no_ball_runs: "leg_bye",
      bowler_id: "w1",
      batsman_id: "a1",
    };
    const form = formOfDelivery(nb);
    expect(form).toMatchObject({ kind: "no_ball", runs: 2, noBallRuns: "leg_bye" });
    expect(correctionOf(nb, { ...form, noBallRuns: "bat" })).toMatchObject({
      extraType: "no_ball",
      runsScored: 2,
      extras: 1,
      noBallRuns: null,
    });
    expect(correctionOf(nb, form)).toMatchObject({
      runsScored: 0,
      extras: 3,
      noBallRuns: "leg_bye",
    });
  });

  it("stores a wide's runs with the wide, and asks for a run on byes", () => {
    const plain: DeliveryToEdit = { id: "b3", runs_scored: 1, bowler_id: "w1" };
    const form = { ...formOfDelivery(plain), kind: "wide" as const, runs: 2 };
    expect(correctionOf(plain, form)).toMatchObject({
      extraType: "wide",
      extras: 3,
      runsScored: 0,
    });
    expect(
      correctionMissing({ ...formOfDelivery(plain), kind: "bye", runs: 0 }),
    ).toBe("Byes need at least one run");
  });
});

describe("EditBallDialog", () => {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    isProcessing: false,
    battingTeamPlayers: [player("a1", "Kohli"), player("a2", "Rohit")],
    bowlingTeamPlayers: [player("w1", "Starc"), player("f1", "Smith")],
  };

  it("names the ball as the over strip does and offers five runs", () => {
    render(<EditBallDialog {...props} delivery={caught} onSave={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Correct ball 3.2" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
  });

  it("records a no-ball's byes and stays open when the server refuses", async () => {
    const onSave = vi
      .fn()
      .mockResolvedValueOnce({ error: "ball_not_found" })
      .mockResolvedValueOnce({ error: null });
    const onOpenChange = vi.fn();
    render(
      <EditBallDialog
        {...props}
        onOpenChange={onOpenChange}
        delivery={{ ...caught, is_wicket: false, dismissal_type: null }}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "No ball" }));
    fireEvent.click(
      within(
        screen.getByRole("radiogroup", { name: "The runs off the no-ball were" }),
      ).getByRole("radio", { name: "Byes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save ball 3.2" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          extraType: "no_ball",
          extras: 3,
          runsScored: 0,
          noBallRuns: "bye",
        }),
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("ball_not_found");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Save ball 3.2" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("asks how the batter was out before saving a new wicket", () => {
    render(
      <EditBallDialog
        {...props}
        delivery={{ ...caught, is_wicket: false, dismissal_type: null }}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Wicket on this ball"));
    expect(
      screen.getByRole("button", { name: "Save ball 3.2" }),
    ).toHaveAccessibleDescription("Choose how the batter was out");
  });
});

describe("Edit ball shows what an edit changes", () => {
  const names: Record<string, string> = { a1: "Asha", a2: "Bina", w1: "Wasim" };
  const log = [
    { id: "x1", innings_id: "i", seq: 1, over_number: 0, ball_number: 1, runs_scored: 1, extras: 0, extra_type: null, is_wicket: false, bowler_id: "w1", batsman_id: "a1", non_striker_id: "a2" },
    { id: "x2", innings_id: "i", seq: 2, over_number: 0, ball_number: 2, runs_scored: 0, extras: 0, extra_type: null, is_wicket: false, bowler_id: "w1", batsman_id: "a2", non_striker_id: "a1" },
    { id: "y1", innings_id: "other", seq: 3, over_number: 0, ball_number: 1, runs_scored: 6, extras: 0, extra_type: null, is_wicket: false, bowler_id: "a1", batsman_id: "w1", non_striker_id: "w2" },
  ];
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    onSave: vi.fn(),
    isProcessing: false,
    battingTeamPlayers: [player("a1", "Asha"), player("a2", "Bina")],
    bowlingTeamPlayers: [player("w1", "Wasim")],
  };
  const preview = {
    rules: { id: "M", balls_per_over: 6 },
    teamId: "t",
    finished: true,
    nameOf: (id: string | null | undefined) => (id && names[id]) || "?",
  };

  it("lists the lines and the total an edit changes, before saving", () => {
    render(<EditBallDialog {...props} delivery={log[1]!} preview={{ ...preview, log }} />);
    expect(screen.getByText("No figures change.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    const changes = screen.getByText("What changes").parentElement!;
    expect(within(changes).getByText(/^Total:/)).toHaveTextContent(/Total: 1\/0 →\s*(becomes)?\s*5\/0/);
    expect(within(changes).getByText(/^Bina:/)).toHaveTextContent(/Bina: 0\* \(1\) →\s*(becomes)?\s*4\* \(1\)/);
    expect(within(changes).getByText(/^Wasim \(bowling\):/)).toHaveTextContent(
      /0\.2-0-1-0 →\s*(becomes)?\s*0\.2-0-5-0/,
    );
    // The other innings is not this one's business.
    expect(within(changes).queryByText(/^Asha/)).toBeNull();
    expect(changes).toHaveTextContent("its result is worked out again");
  });

  it("reads the ball log when it was not handed over", async () => {
    let answer: (v: typeof log) => void = () => {};
    const load = vi.fn(() => new Promise<typeof log>((r) => (answer = r)));
    render(<EditBallDialog {...props} delivery={log[1]!} preview={{ ...preview, load }} />);
    expect(screen.getByText(/Working out what this changes/)).toBeInTheDocument();
    answer(log);
    expect(await screen.findByText("No figures change.")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("a wicket added on a ball the batter batted on after", () => {
  // Radix Select scrolls its options and captures the pointer (not in jsdom).
  Element.prototype.scrollIntoView ??= vi.fn();
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);

  // Asha faced 0.1 and batted on (0.2 at the other end, 0.3 on strike):
  // making 0.1 her wicket means those were whoever came in.
  const log = [
    { id: "x1", innings_id: "i", seq: 1, over_number: 0, ball_number: 1, runs_scored: 1, extras: 0, extra_type: null, is_wicket: false, bowler_id: "w1", batsman_id: "a1", non_striker_id: "a2" },
    { id: "x2", innings_id: "i", seq: 2, over_number: 0, ball_number: 2, runs_scored: 0, extras: 0, extra_type: null, is_wicket: false, bowler_id: "w1", batsman_id: "a2", non_striker_id: "a1" },
    { id: "x3", innings_id: "i", seq: 3, over_number: 0, ball_number: 3, runs_scored: 2, extras: 0, extra_type: null, is_wicket: false, bowler_id: "w1", batsman_id: "a1", non_striker_id: "a2" },
  ];
  const names: Record<string, string> = { a1: "Asha", a2: "Bina", a3: "Cara", w1: "Wasim" };

  it("asks who came in, moves the later balls to them, and saves both", async () => {
    const onSave = vi.fn(async () => ({ error: null }));
    render(
      <EditBallDialog
        open
        onOpenChange={vi.fn()}
        delivery={log[0]!}
        onSave={onSave}
        isProcessing={false}
        battingTeamPlayers={[player("a1", "Asha"), player("a2", "Bina"), player("a3", "Cara")]}
        bowlingTeamPlayers={[player("w1", "Wasim")]}
        preview={{
          log,
          rules: { id: "M", balls_per_over: 6 },
          teamId: "t",
          finished: false,
          nameOf: (id) => (id && names[id]) || "?",
        }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Wicket on this ball"));
    fireEvent.click(screen.getByRole("radio", { name: "Bowled" }));
    expect(screen.getByText(/Asha batted on after this ball \(0\.2, 0\.3\)/)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save ball 0.1" });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("combobox", { name: "Who came in" }));
    fireEvent.click(await screen.findByRole("option", { name: "Cara" }));
    const changes = screen.getByText("What changes").parentElement!;
    expect(within(changes).getByText(/^Asha:/)).toHaveTextContent(/1 \(1\), bowled/);
    expect(within(changes).getByText(/^Cara:/)).toHaveTextContent(/2\* \(1\)/);
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ ballId: "x1", isWicket: true, laterBatterId: "a3" }),
      ),
    );
  });
});

describe("Edit ball warns when the later ends may be wrong", () => {
  const names: Record<string, string> = { a1: "Asha", a2: "Bina", w1: "Wasim" };
  // 0.1: Asha takes 1 (they cross), 0.2: Bina on strike.
  const log = [
    { id: "x1", innings_id: "i", seq: 1, over_number: 0, ball_number: 1, runs_scored: 1, extras: 0, extra_type: null, is_wicket: false, bowler_id: "w1", batsman_id: "a1", non_striker_id: "a2" },
    { id: "x2", innings_id: "i", seq: 2, over_number: 0, ball_number: 2, runs_scored: 0, extras: 0, extra_type: null, is_wicket: false, bowler_id: "w1", batsman_id: "a2", non_striker_id: "a1" },
  ];
  const preview = {
    rules: { id: "M", balls_per_over: 6 },
    teamId: "t",
    finished: false,
    nameOf: (id: string | null | undefined) => (id && names[id]) || "?",
    log,
  };
  const base = {
    open: true,
    onOpenChange: vi.fn(),
    isProcessing: false,
    battingTeamPlayers: [player("a1", "Asha"), player("a2", "Bina")],
    bowlingTeamPlayers: [player("w1", "Wasim")],
    preview,
  };

  it("offers to fix the ends from the next ball when runs turn even, and does so after saving", async () => {
    const onSave = vi.fn().mockResolvedValue({ error: null });
    const onEndsWrongFrom = vi.fn();
    render(
      <EditBallDialog {...base} delivery={log[0]!} onSave={onSave} onEndsWrongFrom={onEndsWrongFrom} />,
    );
    expect(screen.queryByText(/wrong ends/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText(/The batters no longer cross on this ball/)).toHaveTextContent(
      /from ball 0\.2 they may be at the wrong ends/,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save, then fix the ends from 0.2" }));
    await waitFor(() => expect(onEndsWrongFrom).toHaveBeenCalledWith("x2"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("starts the fix at the next delivery, not a retirement logged between", () => {
    const withRetirement = [
      log[0]!,
      // Bina retires hurt between the balls: an event no batter faced.
      { id: "r1", innings_id: "i", seq: 2, over_number: 0, ball_number: 1, runs_scored: 0, extras: 0, extra_type: null, is_wicket: true, dismissal_type: "retired_hurt", bowler_id: "w1", batsman_id: "a2", non_striker_id: "a1" },
      { ...log[1]!, seq: 3 },
    ];
    render(
      <EditBallDialog
        {...base}
        preview={{ ...preview, log: withRetirement }}
        delivery={log[0]!}
        onSave={vi.fn()}
        onEndsWrongFrom={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(
      screen.getByRole("button", { name: "Save, then fix the ends from 0.2" }),
    ).toBeInTheDocument();
  });

  it("says nothing for the innings' last ball (the crease follows the log)", () => {
    render(
      <EditBallDialog {...base} delivery={log[1]!} onSave={vi.fn()} onEndsWrongFrom={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    expect(screen.queryByText(/wrong ends/)).toBeNull();
  });
});
