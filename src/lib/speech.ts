import { usePreferencesStore } from "./stores/usePreferencesStore";

/**
 * Text-to-speech announcement utility for real-time scoring confirmation.
 * Allows scorers and umpires to hear recorded actions without looking away from the field.
 * Safely guards against non-browser environments and respects user voice preferences.
 */
export function speakAnnouncement(text: string, options?: { rate?: number; pitch?: number }): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const { voiceAnnouncements, soundVolume } = usePreferencesStore.getState();
  if (!voiceAnnouncements || soundVolume <= 0) {
    return;
  }

  try {
    // Cancel any previous utterance to avoid latency lag during rapid scoring
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = soundVolume;
    utterance.rate = options?.rate ?? 1.1; // Slightly brisk for rapid game action
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(utterance);
  } catch {
    // Gracefully handle browser restrictions or speech synthesis errors
  }
}

/** Announce a delivery result concisely */
export function announceDelivery(params: {
  runs: number;
  extraType?: string | null;
  isWicket?: boolean;
  batterName?: string | null;
  dismissedName?: string | null;
}): void {
  const { runs, extraType, isWicket, dismissedName } = params;

  if (isWicket) {
    const who = dismissedName ? `${dismissedName} is out` : "Wicket down";
    speakAnnouncement(`Wicket! ${who}.`, { pitch: 1.15 });
    return;
  }

  if (extraType === "wide") {
    const totalWides = 1 + runs;
    speakAnnouncement(totalWides === 1 ? "Wide ball" : `${totalWides} wides`);
    return;
  }

  if (extraType === "no_ball") {
    const note = runs > 0 ? `${runs} runs, free hit` : "No ball, free hit";
    speakAnnouncement(note, { pitch: 1.1 });
    return;
  }

  if (extraType === "bye") {
    speakAnnouncement(runs === 1 ? "1 bye" : `${runs} byes`);
    return;
  }

  if (extraType === "leg_bye") {
    speakAnnouncement(runs === 1 ? "1 leg bye" : `${runs} leg byes`);
    return;
  }

  if (extraType === "penalty") {
    speakAnnouncement(`Penalty, ${runs} runs awarded`);
    return;
  }

  if (extraType === "bonus") {
    speakAnnouncement(`Bonus, ${runs} runs`);
    return;
  }

  // Standard bat runs
  if (runs === 0) {
    speakAnnouncement("Dot ball");
  } else if (runs === 1) {
    speakAnnouncement("Single");
  } else if (runs === 2) {
    speakAnnouncement("Two runs");
  } else if (runs === 3) {
    speakAnnouncement("Three runs");
  } else if (runs === 4) {
    speakAnnouncement("Four!", { pitch: 1.1 });
  } else if (runs === 6) {
    speakAnnouncement("Six!", { pitch: 1.2 });
  } else {
    speakAnnouncement(`${runs} runs`);
  }
}

/** Announce over completion */
export function announceOverComplete(overNumber: number, scoreDisplay: string): void {
  speakAnnouncement(`Over ${overNumber} complete. Score is ${scoreDisplay}.`);
}

/** Announce strike rotation */
export function announceStrikeChange(strikerName: string): void {
  speakAnnouncement(`${strikerName} on strike.`);
}

/** Announce undo action */
export function announceUndo(): void {
  speakAnnouncement("Last ball undone.");
}
