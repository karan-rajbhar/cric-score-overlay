import { NextRequest, NextResponse } from "next/server";
import { getFullMatchForExport } from "~/app/matches/queries";
import { buildMatchReportHtml } from "~/lib/match-report";
import { originFromHeaders } from "~/lib/request-origin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await getFullMatchForExport(id);
  if (res.error || !res.data) {
    return new NextResponse(res.error || "Match not found", { status: 404 });
  }

  // The public address, not the server's own (behind App Hosting's proxy
  // or the dev tunnel that is an internal host a phone cannot open).
  const matchUrl = `${originFromHeaders(request.headers)}/matches/${id}`;

  const html = await buildMatchReportHtml(res.data, matchUrl);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
