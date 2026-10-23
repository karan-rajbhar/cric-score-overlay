/**
 * Server-side producer commands for a match's overlay.
 *
 * {@link sendProducerCommand} is the one way server code drives an overlay:
 * the control room route (`POST /api/overlay/command`) and the Stream Deck
 * remote route both call it. It merges the command into the match's
 * `overlay_state/{matchId}` (`~/lib/firebase/overlay-control`), the one
 * document the overlay and the control room follow.
 */

import "server-only";
import type { ProducerCommand } from "~/components/overlay/types";
import { publishOverlayCommand } from "~/lib/firebase/overlay-control";
import type { OverlayCommandInput } from "~/lib/overlay-state";

/** A producer command, `NEXT_SPONSOR` included (the sponsor rotation). */
export type ProducerCommandPayload = ProducerCommand;

/** Match ids are part of a document path: no "/". */
const MATCH_ID = /^[\w-]{1,128}$/;

/**
 * Puts the command on air. False (nothing written) when the overlay does
 * not know it: callers answer 400.
 */
export async function sendProducerCommand(
  matchId: string,
  payload: ProducerCommandPayload | OverlayCommandInput,
): Promise<boolean> {
  if (!MATCH_ID.test(matchId)) throw new Error("Invalid match id");
  return publishOverlayCommand(matchId, payload as OverlayCommandInput);
}
