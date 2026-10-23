/**
 * Server side of a match's overlay state, `overlay_state/{matchId}`
 * (`~/lib/overlay-state`): each producer command is merged into it, one
 * write; every overlay and control room listening reads it once.
 */

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { OverlayCommandInput } from "~/lib/overlay-state";
import { OVERLAY_STATE_COLLECTION, overlayPatchOf } from "~/lib/overlay-state";
import { getAdminFirestore } from "./admin";

/**
 * Applies a command to the match's overlay state. Scene fields merge one by
 * one (a theme change keeps the layout); the lower third, the event-card
 * cue and the automatic rules are replaced whole. False (and nothing
 * written) when the command changes nothing the overlay knows.
 */
export async function publishOverlayCommand(
  matchId: string,
  payload: OverlayCommandInput,
): Promise<boolean> {
  const now = Date.now();
  const patch = overlayPatchOf(payload, now);
  if (!patch) return false;
  const data: Record<string, unknown> = {
    match_id: matchId,
    version: FieldValue.increment(1),
    last_command_id: typeof payload.id === "string" ? payload.id : null,
    at: now,
    updated_at: FieldValue.serverTimestamp(),
  };
  const fields = Object.keys(data);
  if (patch.scene) {
    data.scene = patch.scene;
    for (const key of Object.keys(patch.scene)) fields.push(`scene.${key}`);
  }
  for (const key of ["strap", "cue", "auto"] as const) {
    if (patch[key] !== undefined) {
      data[key] = patch[key];
      fields.push(key);
    }
  }
  await getAdminFirestore()
    .collection(OVERLAY_STATE_COLLECTION)
    .doc(matchId)
    .set(data, { mergeFields: fields });
  return true;
}
