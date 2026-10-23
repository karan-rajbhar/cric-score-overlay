/**
 * Server-side producer commands for a match's overlay.
 *
 * {@link sendProducerCommand} is the one way server code (the Stream Deck
 * remote route, and the control room route once merged) drives an overlay.
 * Today it does what `POST /api/overlay/command` does: append the command
 * to `broadcasts/overlay_control_{matchId}/messages`, where the overlay
 * listens, with a TTL. Point it at the persistent `overlay_state` writer
 * when that lands; callers do not change.
 */

import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { ProducerCommand } from "~/components/overlay/types";
import { getAdminFirestore } from "~/lib/firebase/admin";
import { BROADCAST_COLLECTION, BROADCAST_TTL_MS } from "~/lib/firebase/config";

/**
 * A producer command: the control room's {@link ProducerCommand}, plus
 * `NEXT_SPONSOR` (advance the sponsor rotation now; the overlay handles it
 * once wired, see the streaming notes).
 */
export type ProducerCommandPayload = Omit<ProducerCommand, "type"> & {
  type: ProducerCommand["type"] | "NEXT_SPONSOR";
};

/** Match ids are part of a document path: no "/". */
const MATCH_ID = /^[\w-]{1,128}$/;

export async function sendProducerCommand(
  matchId: string,
  payload: ProducerCommandPayload,
): Promise<void> {
  if (!MATCH_ID.test(matchId)) throw new Error("Invalid match id");
  await getAdminFirestore()
    .collection(BROADCAST_COLLECTION)
    .doc(`overlay_control_${matchId}`)
    .collection("messages")
    .add({
      event: "command",
      payload,
      ts: FieldValue.serverTimestamp(),
      expires_at: Timestamp.fromMillis(Date.now() + BROADCAST_TTL_MS),
    });
}
