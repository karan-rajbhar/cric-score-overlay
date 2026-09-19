import { create } from "zustand";
import type {
  BroadcastViewId,
  OverlayTheme,
  ActiveEventSting,
  ActiveLowerThirdStrap,
  PresentationCardType,
  LowerThirdStrapType,
} from "~/components/overlay/types";

export interface BroadcastStoreState {
  selectedBroadcastView: BroadcastViewId;
  selectedCategory: string;
  selectedTheme: OverlayTheme;
  audioEnabled: boolean;
  marginOffsetPx: number;
  strapDurationSecs: number;
  customStrapText: string;
  activeSting: ActiveEventSting | null;
  activeStrap: ActiveLowerThirdStrap | null;
  activeCard: PresentationCardType;
  activeTab: "inplay" | "settings";
  monitorScale: number;
  monitorBg: "stadium" | "grid";
  lastAction: string;

  // Actions
  setBroadcastView: (view: BroadcastViewId, label?: string) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedTheme: (theme: OverlayTheme) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setMarginOffsetPx: (offset: number) => void;
  setStrapDurationSecs: (duration: number) => void;
  setCustomStrapText: (text: string) => void;
  triggerSting: (sting: Partial<ActiveEventSting> & { title: string }) => void;
  clearSting: () => void;
  triggerStrap: (strap: {
    strapType?: string;
    type?: string;
    title: string;
    subtitle?: string;
    durationSecs?: number;
  }) => void;
  clearStrap: () => void;
  setActiveCard: (card: PresentationCardType) => void;
  setActiveTab: (tab: "inplay" | "settings") => void;
  setMonitorScale: (scale: number) => void;
  setMonitorBg: (bg: "stadium" | "grid") => void;
  setLastAction: (action: string) => void;
  resetBroadcastStore: () => void;
}

const DEFAULT_BROADCAST_STATE = {
  selectedBroadcastView: "1" as BroadcastViewId,
  selectedCategory: "all",
  selectedTheme: "starsports" as OverlayTheme,
  audioEnabled: true,
  marginOffsetPx: 0,
  strapDurationSecs: 8,
  customStrapText: "",
  activeSting: null as ActiveEventSting | null,
  activeStrap: null as ActiveLowerThirdStrap | null,
  activeCard: "none" as PresentationCardType,
  activeTab: "inplay" as const,
  monitorScale: 0.5,
  monitorBg: "stadium" as const,
  lastAction: "Broadcast studio ready",
};

export const useBroadcastStore = create<BroadcastStoreState>((set) => ({
  ...DEFAULT_BROADCAST_STATE,

  setBroadcastView: (view, label) =>
    set((state) => ({
      selectedBroadcastView: view,
      lastAction: label
        ? `Broadcast graphic updated: ${label}`
        : state.lastAction,
    })),

  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  setSelectedTheme: (selectedTheme) => set({ selectedTheme }),

  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),

  setMarginOffsetPx: (marginOffsetPx) => set({ marginOffsetPx }),

  setStrapDurationSecs: (strapDurationSecs) => set({ strapDurationSecs }),

  setCustomStrapText: (customStrapText) => set({ customStrapText }),

  triggerSting: (sting) =>
    set({
      activeSting: {
        id: `sting_${Date.now()}`,
        type: sting.type ?? "milestone",
        title: sting.title,
        subtitle: sting.subtitle,
        detail: sting.detail,
        accentColor: sting.accentColor,
        durationMs: sting.durationMs ?? 4000,
      },
    }),

  clearSting: () => set({ activeSting: null }),

  triggerStrap: (strap) =>
    set({
      activeStrap: {
        id: `strap_${Date.now()}`,
        type: (strap.strapType ?? strap.type ?? "custom") as LowerThirdStrapType,
        title: strap.title,
        subtitle: strap.subtitle,
        durationMs: (strap.durationSecs ?? 8) * 1000,
      },
    }),

  clearStrap: () => set({ activeStrap: null }),

  setActiveCard: (activeCard) => set({ activeCard }),

  setActiveTab: (activeTab) => set({ activeTab }),

  setMonitorScale: (monitorScale) => set({ monitorScale }),

  setMonitorBg: (monitorBg) => set({ monitorBg }),

  setLastAction: (lastAction) => set({ lastAction }),

  resetBroadcastStore: () => set({ ...DEFAULT_BROADCAST_STATE }),
}));
