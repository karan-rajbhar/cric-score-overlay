import type { ProducerCommand } from "~/components/overlay/types";

export type SendResult = { ok: true } | { ok: false; message: string };

/** Why a command did not go out, in words a volunteer can act on. */
function failureMessage(status: number): string {
  if (status === 401) return "You are signed out. Sign in again, then retry.";
  if (status === 403) {
    return "Only this match's scorers, organisers and streamers can change its overlay.";
  }
  if (status === 400) return "The overlay did not accept this.";
  return "The server could not save it. Try again.";
}

/**
 * Sends a control room command to the match's overlay through
 * `POST /api/overlay/command`, which checks the producer is an admin of
 * the match (browsers cannot write the overlay state themselves).
 */
export async function sendOverlayCommand(
  matchId: string,
  payload: ProducerCommand,
): Promise<SendResult> {
  try {
    const res = await fetch("/api/overlay/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ matchId, payload }),
    });
    if (res.ok) return { ok: true };
    console.error(`[overlay] command refused (${res.status})`);
    return { ok: false, message: failureMessage(res.status) };
  } catch (err) {
    console.error("[overlay] command failed:", err);
    return {
      ok: false,
      message: "No connection. Check the internet, then try again.",
    };
  }
}
