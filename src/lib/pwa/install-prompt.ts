"use client";

import { useSyncExternalStore } from "react";

/** Chrome's `beforeinstallprompt` event (not in the DOM typings). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let started = false;

function emit() {
  for (const l of listeners) l();
}

/**
 * Starts listening for the browser's install offer. Called once from the
 * root layout so the event is not missed on pages without the account menu.
 */
export function initInstallPrompt(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** True when the browser has offered to install the app (Android, desktop). */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
}

/** Shows the browser's install dialog. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  emit();
  await e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
  return choice.outcome === "accepted";
}

/** Running as an installed app (home screen / standalone window). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

/**
 * iPhone / iPad Safari, which has no install prompt: people add the app with
 * Share, then Add to Home Screen. Other iOS browsers (CriOS, FxiOS, in-app
 * browsers) cannot install, so they get no hint.
 */
export function isIosSafari(userAgent: string, maxTouchPoints = 0): boolean {
  const ios =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!ios) return false;
  if (!/Safari\//.test(userAgent)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line\//.test(
    userAgent,
  );
}

const IOS_HINT_KEY = "cric_ios_install_hint_seen";

export function iosHintSeen(): boolean {
  try {
    return localStorage.getItem(IOS_HINT_KEY) === "1";
  } catch {
    return true;
  }
}

export function markIosHintSeen(): void {
  try {
    localStorage.setItem(IOS_HINT_KEY, "1");
  } catch {
    // Storage blocked: the hint may show again.
  }
}

export const IOS_INSTALL_HINT =
  "To install CricScore, tap Share, then Add to Home Screen.";
