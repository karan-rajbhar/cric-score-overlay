"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { Download, Share2, FileJson, Loader2 } from "lucide-react";
import { downloadCricsheetJson } from "~/lib/cricsheet";
import { getFullMatchForExport } from "~/app/matches/queries";
import type { Match } from "~/lib/match-types";
import { useMatchShare } from "./use-match-share";

export type {
  ExportBatter,
  ExportBowler,
  ExportTeamStats,
  MatchExportSummary,
} from "~/lib/match-report";

export function MatchExportButtons({ match }: { match: Match }) {
  const router = useRouter();

  // The summary image: the share sheet on phones, a download elsewhere.
  const summaryShare = useMatchShare(match);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const exportPdf = () => {
    setIsExportingPdf(true);
    try {
      const reportUrl = `/matches/${match.id}/report`;
      const isMobile =
        typeof window !== "undefined" && window.innerWidth < 768;
      const w = window.open(
        reportUrl,
        "_blank",
        isMobile ? undefined : "width=860,height=950",
      );
      if (!w) {
        router.push(reportUrl);
      }
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to open match report");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const [isExportingCricsheet, setIsExportingCricsheet] = useState(false);

  const handleCricsheetExport = async () => {
    setIsExportingCricsheet(true);
    try {
      let exportMatch = match;
      const hasBalls = match.innings?.some(
        (inn) => inn.ball_by_ball && inn.ball_by_ball.length > 0,
      );
      if (!hasBalls) {
        const res = await getFullMatchForExport(match.id);
        if (res.data) {
          exportMatch = res.data;
        }
      }
      downloadCricsheetJson(exportMatch);
      toast.success("Cricsheet JSON downloaded with full delivery data");
    } catch (err) {
      console.error("Cricsheet export error:", err);
      toast.error("Failed to export Cricsheet data");
    } finally {
      setIsExportingCricsheet(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isExportingPdf}
        onClick={() => void exportPdf()}
        className="h-10 px-3 text-xs font-semibold sm:h-9 sm:text-sm"
      >
        {isExportingPdf ? (
          <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-4 w-4 shrink-0" />
        )}
        Match report (PDF)
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={summaryShare.busy}
        onPointerDown={summaryShare.prepare}
        onFocus={summaryShare.prepare}
        onClick={() => void summaryShare.share()}
        className="h-10 px-3 text-xs font-semibold sm:h-9 sm:text-sm"
      >
        {summaryShare.busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Share2 className="mr-1.5 h-4 w-4 shrink-0" />
        )}
        Share summary
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isExportingCricsheet}
        onClick={() => void handleCricsheetExport()}
        className="h-10 px-3 text-xs font-semibold sm:h-9 sm:text-sm"
      >
        {isExportingCricsheet ? (
          <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <FileJson className="mr-1.5 h-4 w-4 shrink-0" />
        )}
        Cricsheet JSON
      </Button>
    </>
  );
}
