import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MatchFormat } from "~/app/matches/types";

export interface PreferencesStoreState {
  soundEffectsEnabled: boolean;
  soundVolume: number;
  hapticFeedback: boolean;
  sunlightMode: boolean;
  defaultMatchFormat: MatchFormat;
  defaultOvers: number;

  // Actions
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  toggleHaptic: () => void;
  setHapticEnabled: (enabled: boolean) => void;
  toggleSunlightMode: () => void;
  setSunlightMode: (enabled: boolean) => void;
  setDefaultFormat: (format: MatchFormat, overs?: number) => void;
  resetPreferences: () => void;
}

const DEFAULT_PREFERENCES = {
  soundEffectsEnabled: true,
  soundVolume: 0.8,
  hapticFeedback: true,
  sunlightMode: false,
  defaultMatchFormat: "T20" as MatchFormat,
  defaultOvers: 20,
};

export const usePreferencesStore = create<PreferencesStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,

      toggleSound: () =>
        set((state) => ({ soundEffectsEnabled: !state.soundEffectsEnabled })),

      setSoundEnabled: (soundEffectsEnabled) => set({ soundEffectsEnabled }),

      setVolume: (rawVolume) => {
        const soundVolume = Math.max(0, Math.min(1, rawVolume));
        set({ soundVolume });
      },

      toggleHaptic: () =>
        set((state) => ({ hapticFeedback: !state.hapticFeedback })),

      setHapticEnabled: (hapticFeedback) => set({ hapticFeedback }),

      toggleSunlightMode: () =>
        set((state) => ({ sunlightMode: !state.sunlightMode })),

      setSunlightMode: (sunlightMode) => set({ sunlightMode }),

      setDefaultFormat: (defaultMatchFormat, overs) =>
        set({
          defaultMatchFormat,
          defaultOvers:
            overs ??
            (defaultMatchFormat === "T20"
              ? 20
              : defaultMatchFormat === "ODI"
                ? 50
                : 20),
        }),

      resetPreferences: () => set({ ...DEFAULT_PREFERENCES }),
    }),
    {
      name: "cricket_app_preferences",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : ({} as Storage),
      ),
    },
  ),
);
