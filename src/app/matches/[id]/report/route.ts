import { NextRequest, NextResponse } from "next/server";
import { getFullMatchForExport } from "~/app/matches/queries";
import { buildMatchReportHtml } from "~/lib/match-report";

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

  const origin = request.nextUrl.origin;
  const matchUrl = `${origin}/matches/${id}`;

  const html = await buildMatchReportHtml(res.data, matchUrl);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
