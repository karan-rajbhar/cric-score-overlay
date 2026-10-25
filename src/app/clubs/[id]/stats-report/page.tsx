import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ClubStatsReportView } from "~/components/report/club-stats-report-view";
import {
  clubStatsFileName,
  parseStatsTab,
  tabTable,
} from "~/lib/club-stats-export";
import { loadClubStatsExport } from "~/lib/firebase/club-stats-data";
import { originFromHeaders } from "~/lib/request-origin";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const stats = await loadClubStatsExport(id);
  return {
    title: stats ? `${stats.club.name} · Statistics` : "Club statistics",
    robots: { index: false },
  };
}

/**
 * The club's printable statistics (the Stats tab's "PDF report"): players
 * ranked by points, then their batting, bowling and fielding figures; with
 * `?tab=` just that leaderboard tab's table. It shares or prints as an A4
 * PDF, like the match report.
 */
export default async function ClubStatsReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const tab = parseStatsTab((await searchParams).tab);
  const stats = await loadClubStatsExport(id);
  if (!stats) notFound();

  const clubUrl = `${originFromHeaders(await headers())}/clubs/${id}`;
  const qrDataUrl = await QRCode.toDataURL(clubUrl, {
    margin: 4,
    width: 260,
    errorCorrectionLevel: "M",
    color: { dark: "#181745", light: "#ffffff" },
  });
  const now = new Date();

  return (
    <ClubStatsReportView
      club={stats.club}
      clubUrl={clubUrl}
      rows={stats.rows}
      matches={stats.matches}
      generated={now.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
      tab={tab ? tabTable(stats.data, tab) : null}
      fileName={clubStatsFileName(
        stats.club.name,
        "pdf",
        now,
        tab ? tabTable(stats.data, tab).label.toLowerCase() : "statistics",
      )}
      qrDataUrl={qrDataUrl}
    />
  );
}
