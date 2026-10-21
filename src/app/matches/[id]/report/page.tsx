import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getFullMatchForExport } from "~/app/matches/queries";
import { MatchReportView } from "~/components/report/match-report-view";
import { buildMatchReport } from "~/lib/match-report";
import { originFromHeaders } from "~/lib/request-origin";

// One read of the match and its ball log for the title and the page.
const loadMatch = cache((id: string) => getFullMatchForExport(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await loadMatch(id);
  return {
    title: res.data ? `${res.data.title} · Match report` : "Match report",
    robots: { index: false },
  };
}

/**
 * The printable match report (the match page's "PDF report"): every
 * innings' scorecard, the analysis and a sign-off, built from the design
 * system's components; it shares or prints as an A4 PDF.
 */
export default async function MatchReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await loadMatch(id);
  if (res.error || !res.data) notFound();

  // The public address, not the server's own (behind App Hosting's proxy
  // or the dev tunnel that is an internal host a phone cannot open).
  const matchUrl = `${originFromHeaders(await headers())}/matches/${id}`;
  // A 4-module quiet zone (the QR standard): with less, phone cameras
  // often fail to read it from paper.
  const qrDataUrl = await QRCode.toDataURL(matchUrl, {
    margin: 4,
    width: 260,
    errorCorrectionLevel: "M",
    color: { dark: "#181745", light: "#ffffff" },
  });

  return (
    <MatchReportView
      match={res.data}
      report={buildMatchReport(res.data, matchUrl)}
      qrDataUrl={qrDataUrl}
    />
  );
}
