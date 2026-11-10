import { toast } from "sonner";
import { getFullMatchForExport } from "~/app/matches/queries";
import { downloadCricsheetJson } from "~/lib/cricsheet";
import type { Match } from "~/lib/match-types";

const hasBalls = (match: Match) =>
  Boolean(match.innings?.some((inn) => (inn.ball_by_ball?.length ?? 0) > 0));

/**
 * Downloads a finished match as Cricsheet JSON (every delivery), reading
 * the ball log first when the page does not hold it. A read that fails or
 * finds no balls downloads nothing and says so (an empty file is no
 * export).
 */
export async function exportCricsheet(match: Match): Promise<void> {
  try {
    let full = match;
    if (!hasBalls(match)) {
      const res = await getFullMatchForExport(match.id);
      if (res.error || !res.data) {
        throw new Error(res.error ?? "Could not read the ball log");
      }
      full = res.data;
    }
    if (!hasBalls(full)) {
      toast.error("This match has no ball-by-ball data to download");
      return;
    }
    downloadCricsheetJson(full);
    toast.success("Ball-by-ball data downloaded (Cricsheet JSON)");
  } catch (err) {
    console.error("Cricsheet export error:", err);
    toast.error("Could not download the ball-by-ball data");
  }
}
