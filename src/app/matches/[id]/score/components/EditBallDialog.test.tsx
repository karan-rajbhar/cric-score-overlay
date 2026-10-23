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
