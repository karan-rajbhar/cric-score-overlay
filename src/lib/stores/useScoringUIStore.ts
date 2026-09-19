import { create } from "zustand";

export interface ScoringUIStoreState {
  showAddPlayerDialog: boolean;
  showPotmDialog: boolean;
  showWicketDialog: boolean;
  showBatsmenDialog: boolean;
  showBowlerDialog: boolean;
  showEndInningsDialog: boolean;
  showSuperOverDialog: boolean;
  showTossDialog: boolean;
  tossDialogDismissed: boolean;

  addPlayerTeam: "batting" | "bowling";
  dismissalType: string;
  fielderId: string;
  wicketExtraType: string | null;
  dismissedPlayerId: string | null;
  runsCompletedBeforeRunOut: number;
  addPlayerTarget: "batting" | "bowling" | null;
  newPlayerName: string;

  // Actions
  openWicketDialog: () => void;
  closeWicketDialog: () => void;
  openAddPlayerDialog: (team?: "batting" | "bowling") => void;
  closeAddPlayerDialog: () => void;
  openPotmDialog: () => void;
  closePotmDialog: () => void;
  openBatsmenDialog: () => void;
  closeBatsmenDialog: () => void;
  setShowSelectBatsmen: (open: boolean) => void;
  openBowlerDialog: () => void;
  closeBowlerDialog: () => void;
  setShowSelectBowler: (open: boolean) => void;
  setShowWicketDialog: (open: boolean) => void;
  setShowAddPlayerDialog: (open: boolean) => void;
  setShowPotmDialog: (open: boolean) => void;
  setAddPlayerTeam: (team: "batting" | "bowling") => void;
  setAddPlayerTarget: (target: "batting" | "bowling" | null) => void;
  openEndInningsDialog: () => void;
  closeEndInningsDialog: () => void;
  openSuperOverDialog: () => void;
  closeSuperOverDialog: () => void;
  setDismissalType: (type: string) => void;
  setFielderId: (id: string) => void;
  setWicketExtraType: (type: string | null) => void;
  setDismissedPlayerId: (id: string | null) => void;
  setRunsCompletedBeforeRunOut: (runs: number) => void;
  setNewPlayerName: (name: string) => void;
  setTossDialogDismissed: (dismissed: boolean) => void;
  resetWicketForm: () => void;
  resetScoringUI: () => void;
}

const DEFAULT_WICKET_FORM = {
  dismissalType: "bowled",
  fielderId: "",
  wicketExtraType: null as string | null,
  dismissedPlayerId: null as string | null,
  runsCompletedBeforeRunOut: 0,
};

const DEFAULT_SCORING_UI_STATE = {
  showAddPlayerDialog: false,
  showPotmDialog: false,
  showWicketDialog: false,
  showBatsmenDialog: false,
  showBowlerDialog: false,
  showEndInningsDialog: false,
  showSuperOverDialog: false,
  showTossDialog: false,
  tossDialogDismissed: false,

  addPlayerTeam: "batting" as const,
  addPlayerTarget: null as "batting" | "bowling" | null,
  newPlayerName: "",
  ...DEFAULT_WICKET_FORM,
};

export const useScoringUIStore = create<ScoringUIStoreState>((set) => ({
  ...DEFAULT_SCORING_UI_STATE,

  openWicketDialog: () => set({ showWicketDialog: true }),
  closeWicketDialog: () => set({ showWicketDialog: false }),

  openAddPlayerDialog: (team = "batting") =>
    set({
      showAddPlayerDialog: true,
      addPlayerTeam: team,
      addPlayerTarget: team,
    }),
  closeAddPlayerDialog: () =>
    set({
      showAddPlayerDialog: false,
      addPlayerTarget: null,
      newPlayerName: "",
    }),

  openPotmDialog: () => set({ showPotmDialog: true }),
  closePotmDialog: () => set({ showPotmDialog: false }),

  openBatsmenDialog: () => set({ showBatsmenDialog: true }),
  closeBatsmenDialog: () => set({ showBatsmenDialog: false }),
  setShowSelectBatsmen: (showBatsmenDialog) => set({ showBatsmenDialog }),

  openBowlerDialog: () => set({ showBowlerDialog: true }),
  closeBowlerDialog: () => set({ showBowlerDialog: false }),
  setShowSelectBowler: (showBowlerDialog) => set({ showBowlerDialog }),

  setShowWicketDialog: (showWicketDialog) => set({ showWicketDialog }),
  setShowAddPlayerDialog: (showAddPlayerDialog) => set({ showAddPlayerDialog }),
  setShowPotmDialog: (showPotmDialog) => set({ showPotmDialog }),
  setAddPlayerTeam: (addPlayerTeam) => set({ addPlayerTeam }),
  setAddPlayerTarget: (addPlayerTarget) => set({ addPlayerTarget }),

  openEndInningsDialog: () => set({ showEndInningsDialog: true }),
  closeEndInningsDialog: () => set({ showEndInningsDialog: false }),

  openSuperOverDialog: () => set({ showSuperOverDialog: true }),
  closeSuperOverDialog: () => set({ showSuperOverDialog: false }),

  setDismissalType: (dismissalType) => set({ dismissalType }),
  setFielderId: (fielderId) => set({ fielderId }),
  setWicketExtraType: (wicketExtraType) => set({ wicketExtraType }),
  setDismissedPlayerId: (dismissedPlayerId) => set({ dismissedPlayerId }),
  setRunsCompletedBeforeRunOut: (runsCompletedBeforeRunOut) =>
    set({ runsCompletedBeforeRunOut }),
  setNewPlayerName: (newPlayerName) => set({ newPlayerName }),
  setTossDialogDismissed: (tossDialogDismissed) => set({ tossDialogDismissed }),

  resetWicketForm: () => set({ ...DEFAULT_WICKET_FORM }),

  resetScoringUI: () => set({ ...DEFAULT_SCORING_UI_STATE }),
}));
