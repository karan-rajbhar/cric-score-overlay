import type { ProducerCommand } from "~/components/overlay/types";

/**
 * Sends a control room command to the match's overlay through
 * `POST /api/overlay/command`, which checks the producer is an admin of
 * the match (browsers cannot write the broadcast channel themselves).
 */
export async function sendOverlayCommand(
  matchId: string,
  payload: ProducerCommand,
): Promise<boolean> {
  try {
    const res = await fetch("/api/overlay/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ matchId, payload }),
    });
    if (!res.ok) {
      console.error(`[overlay] command refused (${res.status})`);
    }
    return res.ok;
  } catch (err) {
    console.error("[overlay] command failed:", err);
    return false;
  }
}
