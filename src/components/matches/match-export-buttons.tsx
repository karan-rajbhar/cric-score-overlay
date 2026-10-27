"use client";

import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { FileText, ImageIcon, Loader2 } from "lucide-react";
import type { Match } from "~/lib/match-types";
import { useMatchShare } from "./use-match-share";

export type {
  ExportBatter,
  ExportBowler,
  ExportTeamStats,
  MatchExportSummary,
} from "~/lib/match-report";

/**
 * A finished match's hero actions: the printable report (a page that
 * shares or prints as a PDF) and the summary image. The ball-by-ball data
 * download (Cricsheet) is in the ⋯ menu.
 */
export function MatchExportButtons({ match }: { match: Match }) {
  const router = useRouter();

  // The summary image: the share sheet on phones, a download elsewhere.
  const summaryShare = useMatchShare(match);

  const openReport = () => {
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
      console.error("Match report error:", err);
      toast.error("Could not open the match report");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openReport}
      >
        <FileText className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Match report
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={summaryShare.busy}
        onPointerDown={summaryShare.prepare}
        onFocus={summaryShare.prepare}
        onClick={() => void summaryShare.share()}
      >
        {summaryShare.busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <ImageIcon className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        Share image
      </Button>
    </>
  );
}
