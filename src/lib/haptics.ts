import { usePreferencesStore } from "./stores/usePreferencesStore";

/**
 * Trigger haptic vibration feedback for outdoor tactile score recording
 * Only runs if the device supports Vibration API and hapticFeedback is enabled in user preferences.
 */
export function triggerHaptic(pattern: number | number[] = 12): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  const { hapticFeedback } = usePreferencesStore.getState();
  if (!hapticFeedback) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {
    // Gracefully handle any security/permission errors in iframe or restricted environment
  }
}

/** Crisp micro-pulse for standard dot and single deliveries */
export function hapticBall(): void {
  triggerHaptic(12);
}

/** Distinct double-tap vibration for boundaries (4s and 6s) */
export function hapticBoundary(): void {
  triggerHaptic([18, 40, 18]);
}

/** Strong rhythmic vibration pulse sequence for wickets */
export function hapticWicket(): void {
  triggerHaptic([25, 50, 25, 50, 40]);
}

/** Quick subtle feedback for undo action */
export function hapticUndo(): void {
  triggerHaptic(10);
}
