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

/**
 * The producer command for `action`, in the overlay state's terms
 * (`~/lib/overlay-state`). The batting and bowling cards are the
 * scorecard card, which shows the innings in play (batting and bowling) and
 * stays up until cleared, like the control room's.
 */
export function remoteCommandFor(
  action: RemoteActionId,
  now = Date.now(),
): ProducerCommandPayload {
  const base = { timestamp: now };
  switch (action) {
    case "scorebar-show":
      return { ...base, type: "TOGGLE_BUG", visible: true };
    case "scorebar-hide":
      return { ...base, type: "TOGGLE_BUG", visible: false };
    case "clear":
      return { ...base, type: "PANIC_CLEAR" };
    case "batting-card":
    case "bowling-card":
      return { ...base, type: "SHOW_CARD", card: "scorecard" };
    case "partnership":
      return { ...base, type: "SHOW_CARD", card: "partnership" };
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
