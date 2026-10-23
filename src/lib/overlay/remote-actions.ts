/**
 * The fixed set of Stream Deck / Companion actions
 * (`/api/overlay/remote/{token}/{action}`) and the producer command each
 * one sends. Shared by the route and the setup instructions.
 */

import type { ProducerCommandPayload } from "./commands";

export const REMOTE_ACTIONS = [
  { id: "scorebar-show", label: "Show scorebar" },
  { id: "scorebar-hide", label: "Hide scorebar" },
  { id: "clear", label: "Clear all graphics" },
  { id: "batting-card", label: "Batting card" },
  { id: "bowling-card", label: "Bowling card" },
  { id: "partnership", label: "Partnership" },
  { id: "ticker-on", label: "Ticker on" },
  { id: "ticker-off", label: "Ticker off" },
  { id: "next-sponsor", label: "Next sponsor" },
  { id: "four", label: "Four" },
  { id: "six", label: "Six" },
  { id: "wicket", label: "Wicket" },
] as const;

export type RemoteActionId = (typeof REMOTE_ACTIONS)[number]["id"];

const IDS = new Set<string>(REMOTE_ACTIONS.map((a) => a.id));

export function isRemoteAction(value: string): value is RemoteActionId {
  return IDS.has(value);
}

/** Actions whose card depends on the innings in play (1 `live_state` read). */
export function needsInnings(action: RemoteActionId): boolean {
  return action === "batting-card" || action === "bowling-card";
}

/**
 * The producer command for `action`. `innings` is the innings in play
 * (from `live_state`), which picks the first- or second-innings card.
 */
export function remoteCommandFor(
  action: RemoteActionId,
  innings: number | null = null,
  now = Date.now(),
): ProducerCommandPayload {
  const second = (innings ?? 1) >= 2;
  const base = { timestamp: now };
  switch (action) {
    case "scorebar-show":
      return { ...base, type: "TOGGLE_BUG", visible: true };
    case "scorebar-hide":
      return { ...base, type: "TOGGLE_BUG", visible: false };
    case "clear":
      return { ...base, type: "PANIC_CLEAR" };
    case "batting-card":
      return {
        ...base,
        type: "SET_BROADCAST_VIEW",
        broadcastView: second ? "4" : "2",
      };
    case "bowling-card":
      return {
        ...base,
        type: "SET_BROADCAST_VIEW",
        broadcastView: second ? "5" : "3",
      };
    case "partnership":
      return { ...base, type: "SET_BROADCAST_VIEW", broadcastView: "23" };
    case "ticker-on":
      return { ...base, type: "TOGGLE_TICKER", visible: true };
    case "ticker-off":
      return { ...base, type: "TOGGLE_TICKER", visible: false };
    case "next-sponsor":
      return { ...base, type: "NEXT_SPONSOR" };
    case "four":
    case "six":
    case "wicket":
      return { ...base, type: "TRIGGER_STING", stingType: action };
  }
}

/** The remote URL for one action (shown once, with the token). */
export function remoteActionUrl(
  origin: string,
  token: string,
  action: RemoteActionId,
): string {
  return `${origin}/api/overlay/remote/${token}/${action}`;
}
