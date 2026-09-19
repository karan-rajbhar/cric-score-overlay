import { describe, it, expect, beforeEach } from "vitest";
import { useScoringUIStore } from "./useScoringUIStore";

describe("useScoringUIStore", () => {
  beforeEach(() => {
    useScoringUIStore.getState().resetScoringUI();
  });

  it("initializes with dialogs closed and defaults set", () => {
    const state = useScoringUIStore.getState();
    expect(state.showWicketDialog).toBe(false);
    expect(state.showAddPlayerDialog).toBe(false);
    expect(state.showPotmDialog).toBe(false);
    expect(state.dismissalType).toBe("bowled");
    expect(state.fielderId).toBe("");
    expect(state.dismissedPlayerId).toBeNull();
  });

  it("handles wicket dialog open, dismissal selection, and close", () => {
    const { openWicketDialog, setDismissalType, setFielderId, closeWicketDialog } =
      useScoringUIStore.getState();

    openWicketDialog();
    expect(useScoringUIStore.getState().showWicketDialog).toBe(true);

    setDismissalType("caught");
    setFielderId("fielder-123");
    expect(useScoringUIStore.getState().dismissalType).toBe("caught");
    expect(useScoringUIStore.getState().fielderId).toBe("fielder-123");

    closeWicketDialog();
    expect(useScoringUIStore.getState().showWicketDialog).toBe(false);
  });

  it("handles add player dialog for batting and bowling teams", () => {
    const { openAddPlayerDialog, closeAddPlayerDialog } =
      useScoringUIStore.getState();

    openAddPlayerDialog("bowling");
    let state = useScoringUIStore.getState();
    expect(state.showAddPlayerDialog).toBe(true);
    expect(state.addPlayerTeam).toBe("bowling");

    closeAddPlayerDialog();
    state = useScoringUIStore.getState();
    expect(state.showAddPlayerDialog).toBe(false);
  });

  it("handles run out details and wicket extras", () => {
    const { setWicketExtraType, setRunsCompletedBeforeRunOut, resetWicketForm } =
      useScoringUIStore.getState();

    setWicketExtraType("wide");
    setRunsCompletedBeforeRunOut(2);

    let state = useScoringUIStore.getState();
    expect(state.wicketExtraType).toBe("wide");
    expect(state.runsCompletedBeforeRunOut).toBe(2);

    resetWicketForm();
    state = useScoringUIStore.getState();
    expect(state.wicketExtraType).toBeNull();
    expect(state.runsCompletedBeforeRunOut).toBe(0);
    expect(state.dismissalType).toBe("bowled");
  });
});
