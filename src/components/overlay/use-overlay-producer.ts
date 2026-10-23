"use client";

import { useCallback, useState } from "react";
import { sendOverlayCommand } from "./send-command";
import {
  applyOverlayPatch,
  overlayPatchOf,
  type OverlayStateDoc,
} from "~/lib/overlay-state";
import type { ProducerCommand } from "./types";
import { useOverlayStateDoc } from "./use-overlay-state";

export type CommandStatus = "sending" | "sent" | "on_air" | "failed";

export type OverlayCommand = Omit<ProducerCommand, "id" | "timestamp">;

export interface CommandRecord {
  id: string;
  /** What the producer did, in words ("Lower third: Striker"). */
  label: string;
  status: CommandStatus;
  /** Why it failed. */
  message?: string;
  command: OverlayCommand;
}

function newCommandId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Producing a match's overlay: what is on air (`overlay_state`, one
 * listener) and sending commands with honest feedback. A command is
 * "sending", then "sent" once the server stored it, then "on air" once the
 * overlay state names it (the same document the overlay follows), or
 * "failed" with a reason. The demo match keeps its state on this page.
 */
export function useOverlayProducer(matchId: string, demo = false) {
  const snap = useOverlayStateDoc(matchId, !demo);
  const [demoDoc, setDemoDoc] = useState<OverlayStateDoc | null>(null);
  const doc = demo ? demoDoc : snap.doc;
  const [last, setLast] = useState<CommandRecord | null>(null);

  // On air once the state names it (adjusted while rendering, not in an
  // effect, so the status and the preview change together).
  if (
    last &&
    (last.status === "sending" || last.status === "sent") &&
    doc?.last_command_id === last.id
  ) {
    setLast({ ...last, status: "on_air" });
  }

  const send = useCallback(
    async (command: OverlayCommand, label: string): Promise<boolean> => {
      const id = newCommandId();
      const payload: ProducerCommand = {
        ...command,
        id,
        timestamp: Date.now(),
      };
      setLast({ id, label, status: "sending", command });
      if (demo) {
        const now = Date.now();
        const patch = overlayPatchOf(payload, now);
        if (patch) setDemoDoc((d) => applyOverlayPatch(d, patch, id, now));
        return patch !== null;
      }
      const result = await sendOverlayCommand(matchId, payload);
      setLast((curr) => {
        if (!curr || curr.id !== id) return curr;
        if (!result.ok) {
          return { ...curr, status: "failed", message: result.message };
        }
        return curr.status === "sending" ? { ...curr, status: "sent" } : curr;
      });
      return result.ok;
    },
    [demo, matchId],
  );

  const retry = useCallback(() => {
    if (last) void send(last.command, last.label);
  }, [last, send]);

  return {
    doc,
    /** Whether the state has been read at least once. */
    loaded: demo || snap.loaded,
    /** The listener's connection (the demo match has none). */
    status: demo ? ("connected" as const) : snap.status,
    last,
    send,
    retry,
  };
}
