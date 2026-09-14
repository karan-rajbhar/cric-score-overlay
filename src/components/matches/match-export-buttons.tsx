"use client";

import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { Download, Share2, FileJson, Loader2 } from "lucide-react";
import { downloadCricsheetJson } from "~/lib/cricsheet";
import { getFullMatchForExport } from "~/app/matches/queries";
import {
  buildMatchReportHtml,
  buildExportSummary,
  type MatchExportSummary,
  type ExportTeamStats,
} from "~/lib/match-report";
import type { Match } from "~/lib/match-types";
import {
  CANVAS,
  COLORS,
  generateQRImage,
  createCanvas,
  downloadCanvas,
  slugify,
  roundRect,
} from "~/lib/canvas";

export type {
  ExportBatter,
  ExportBowler,
  ExportTeamStats,
  MatchExportSummary,
} from "~/lib/match-report";

const { W, H } = CANVAS.MATCH_SUMMARY;

function drawSummary(
  ctx: CanvasRenderingContext2D,
  s: MatchExportSummary,
  qrImage: HTMLImageElement | null,
) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top accent stripe
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, W, 4);

  ctx.textBaseline = "top";

  // Header
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 34px Arial, sans-serif";
  ctx.fillText("MATCH SUMMARY", 64, 34);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.accent;
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("C R I C S C O R E", W - 64, 42);
  ctx.textAlign = "left";

  // Team blocks
  const block = (y: number, t: ExportTeamStats) => {
    // Team panel
    ctx.fillStyle = COLORS.panel;
    roundRect(ctx, 64, y, W - 128, 186, 12);
    ctx.fill();

    ctx.fillStyle = COLORS.accent;
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(
      t.name.length > 34 ? `${t.name.slice(0, 34)}…` : t.name,
      88,
      y + 16,
    );

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.fillText(t.scoreLine, W - 88, y + 14);
    ctx.textAlign = "left";

    // Column headers
    ctx.fillStyle = COLORS.faint;
    ctx.font = "600 12px Arial, sans-serif";
    ctx.fillText("BATTING", 88, y + 50);
    ctx.fillText("BOWLING", 640, y + 50);

    ctx.fillStyle = COLORS.dim;
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText("R (B)        SR", 400, y + 50);
    ctx.fillText("O-R-W      ECON", 960, y + 50);

    // Rows
    const rows = Math.min(Math.max(t.batters.length, t.bowlers.length, 1), 3);
    for (let i = 0; i < rows; i++) {
      const ry = y + 72 + i * 32;
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.025)";
        ctx.fillRect(76, ry - 4, W - 152, 28);
      }
      ctx.font = "14px Arial, sans-serif";

      const b = t.batters[i];
      if (b) {
        ctx.fillStyle = COLORS.text;
        ctx.fillText(
          b.name.length > 22 ? `${b.name.slice(0, 22)}…` : b.name,
          88,
          ry,
        );
        ctx.textAlign = "right";
        ctx.fillStyle = COLORS.dim;
        ctx.fillText(`${b.runs} (${b.balls})`, 470, ry);
        ctx.fillText(b.sr, 560, ry);
        ctx.textAlign = "left";
      }

      const bo = t.bowlers[i];
      if (bo) {
        ctx.fillStyle = COLORS.text;
        ctx.fillText(
          bo.name.length > 22 ? `${bo.name.slice(0, 22)}…` : bo.name,
          640,
          ry,
        );
        ctx.textAlign = "right";
        ctx.fillStyle = COLORS.dim;
        ctx.fillText(`${bo.overs}-${bo.runs}-${bo.wickets}`, 990, ry);
        ctx.fillText(bo.econ, 1108, ry);
        ctx.textAlign = "left";
      }
    }
  };

  block(84, s.team1);
  block(282, s.team2);

  // Result banner
  const bannerY = 480;
  ctx.fillStyle = COLORS.accent;
  roundRect(ctx, 64, bannerY, W - 128, 44, 8);
  ctx.fill();
  ctx.fillStyle = "#06130d";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.textAlign = "center";
  const resultText = s.playerOfTheMatch
    ? `${s.result.length > 46 ? `${s.result.slice(0, 46)}…` : s.result}  ★  POTM: ${s.playerOfTheMatch}`
    : s.result.length > 72
      ? `${s.result.slice(0, 72)}…`
      : s.result;
  ctx.fillText(resultText, W / 2, bannerY + 13);
  ctx.textAlign = "left";

  // Footer: URL left, meta center-left, QR right
  ctx.fillStyle = COLORS.faint;
  ctx.font = "14px Arial, sans-serif";
  ctx.fillText(s.matchUrl, 64, bannerY + 58);
  const meta = [s.venue, s.playedAt].filter(Boolean).join(", ");
  if (meta) {
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(
      meta.length > 90 ? `${meta.slice(0, 90)}…` : meta,
      64,
      bannerY + 78,
    );
  }

  if (qrImage) {
    const qrSize = 80;
    const qrX = W - 64 - qrSize;
    ctx.drawImage(qrImage, qrX, bannerY + 50, qrSize, qrSize);
    ctx.fillStyle = COLORS.faint;
    ctx.font = "10px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("SCAN FOR SCORECARD", W - 64, bannerY + 138);
    ctx.textAlign = "left";
  }
}

export function MatchExportButtons({ match }: { match: Match }) {
  const matchUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/matches/${match.id}`
      : `/matches/${match.id}`;
  const summary = useMemo(
    () => buildExportSummary(match, matchUrl),
    [match, matchUrl],
  );

  const shareImage = async () => {
    const { canvas, ctx } = createCanvas(W, H);
    const qrImage = await generateQRImage(summary.matchUrl, 184);
    drawSummary(ctx, summary, qrImage);
    await downloadCanvas(canvas, slugify(summary.title));
    toast.success("Summary image downloaded");
  };

  const exportPdf = async () => {
    const html = await buildMatchReportHtml(match, summary.matchUrl);
    const w = window.open("", "_blank", "width=860,height=950");
    if (!w) {
      toast.error("Allow pop-ups to export the PDF");
      return;
    }
    w.document.write(html);
    w.document.close();
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
      <Button variant="outline" size="sm" onClick={() => void exportPdf()}>
        <Download className="mr-1.5 h-4 w-4" />
        Match report (PDF)
      </Button>
      <Button variant="outline" size="sm" onClick={() => void shareImage()}>
        <Share2 className="mr-1.5 h-4 w-4" />
        Share summary
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isExportingCricsheet}
        onClick={() => void handleCricsheetExport()}
      >
        {isExportingCricsheet ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <FileJson className="mr-1.5 h-4 w-4" />
        )}
        Cricsheet JSON
      </Button>
    </>
  );
}
