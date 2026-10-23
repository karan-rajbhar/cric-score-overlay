import { toast } from "sonner";
import { getFullMatchForExport } from "~/app/matches/queries";
import { downloadCricsheetJson } from "~/lib/cricsheet";
import type { Match } from "~/lib/match-types";

/**
 * Downloads a finished match as Cricsheet JSON (every delivery), reading
 * the ball log first when the page does not hold it.
 */
export async function exportCricsheet(match: Match): Promise<void> {
  try {
    let full = match;
    const hasBalls = match.innings?.some(
      (inn) => inn.ball_by_ball && inn.ball_by_ball.length > 0,
    );
    if (!hasBalls) {
      const res = await getFullMatchForExport(match.id);
      if (res.data) full = res.data;
    }
    downloadCricsheetJson(full);
    toast.success("Ball-by-ball data downloaded (Cricsheet JSON)");
  } catch (err) {
    console.error("Cricsheet export error:", err);
    toast.error("Could not download the ball-by-ball data");
  }
}
