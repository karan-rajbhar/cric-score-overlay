import {
  clubStatsCsv,
  clubStatsFileName,
  parseStatsTab,
  tabCsv,
  tabTable,
} from "~/lib/club-stats-export";
import { loadClubStatsExport } from "~/lib/firebase/club-stats-data";

export const dynamic = "force-dynamic";

/**
 * The club's statistics as a spreadsheet. Without `?tab=`: one row per
 * player ranked by points, with batting, bowling and fielding figures.
 * With `?tab=batting|bowling|fielding|mvp`: that leaderboard tab's table.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const stats = await loadClubStatsExport(id);
  if (!stats) return new Response("Not found", { status: 404 });

  const tab = parseStatsTab(new URL(request.url).searchParams.get("tab"));
  const table = tab ? tabTable(stats.data, tab) : null;
  const body = table ? tabCsv(table) : clubStatsCsv(stats.rows);
  const name = clubStatsFileName(
    stats.club.name,
    "csv",
    new Date(),
    table ? table.label.toLowerCase() : "statistics",
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // ASCII fallback plus the real name (RFC 5987).
      "Content-Disposition": `attachment; filename="club-statistics.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
