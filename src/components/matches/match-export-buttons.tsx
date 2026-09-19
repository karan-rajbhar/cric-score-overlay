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

export function drawSummary(
  ctx: CanvasRenderingContext2D,
  s: MatchExportSummary,
  qrImage: HTMLImageElement | null,
) {
  const fontSans =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  const fontScore =
    "'Barlow Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // 1. Stadium Nocturnal Background & Atmospheric Floodlights
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#070c09");
  bg.addColorStop(0.45, "#0d1712");
  bg.addColorStop(1, "#070c0a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top-center stadium floodlight cone
  const floodlight = ctx.createRadialGradient(W / 2, -20, 20, W / 2, 0, 640);
  floodlight.addColorStop(0, "rgba(16, 185, 129, 0.18)");
  floodlight.addColorStop(0.5, "rgba(14, 165, 233, 0.05)");
  floodlight.addColorStop(1, "transparent");
  ctx.fillStyle = floodlight;
  ctx.fillRect(0, 0, W, H);

  // Top-right subtle golden aura
  const goldAura = ctx.createRadialGradient(W - 80, 80, 10, W - 80, 80, 420);
  goldAura.addColorStop(0, "rgba(234, 179, 8, 0.08)");
  goldAura.addColorStop(1, "transparent");
  ctx.fillStyle = goldAura;
  ctx.fillRect(0, 0, W, H);

  // Subtle geometric angled stadium slash lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.15, 0);
  ctx.lineTo(W * 0.05, H);
  ctx.moveTo(W * 0.88, 0);
  ctx.lineTo(W * 0.78, H);
  ctx.stroke();

  // Top broadcast accent strip (Emerald -> Sky -> Gold)
  const topStripe = ctx.createLinearGradient(0, 0, W, 0);
  topStripe.addColorStop(0, "#10b981");
  topStripe.addColorStop(0.5, "#38bdf8");
  topStripe.addColorStop(1, "#f59e0b");
  ctx.fillStyle = topStripe;
  ctx.fillRect(0, 0, W, 4);

  // Outer frame stroke
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  ctx.textBaseline = "top";

  // 2. Header Bar (y: 24 to 82)
  // Left: Brand Badge
  ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
  roundRect(ctx, 56, 24, 138, 26, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#34d399";
  ctx.font = `bold 11px ${fontSans}`;
  ctx.fillText("⚡ CRIC PLATFORM", 68, 30);

  // Match Title
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 24px ${fontScore}`;
  const titleText =
    s.title.length > 44 ? `${s.title.slice(0, 44)}…` : s.title;
  ctx.fillText(titleText, 56, 56);

  // Right: Match Format & Broadcast Badge
  ctx.textAlign = "right";
  // Format Pill
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  roundRect(ctx, W - 56 - 150, 24, 150, 26, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#cbd5e1";
  ctx.font = `bold 11px ${fontSans}`;
  ctx.fillText(s.format.toUpperCase(), W - 66, 30);

  // Broadcast Label
  ctx.fillStyle = "#34d399";
  ctx.font = `800 13px ${fontSans}`;
  ctx.fillText("OFFICIAL MATCH SUMMARY", W - 56, 58);
  ctx.textAlign = "left";

  // 3. Team Cards (Hero Surfaces)
  const cardX = 56;
  const cardW = W - 112; // 1088
  const cardH = 180;

  const drawTeamCard = (
    y: number,
    t: ExportTeamStats,
    accentColor: string,
  ) => {
    // Glass panel surface
    ctx.fillStyle = "rgba(18, 27, 22, 0.88)";
    roundRect(ctx, cardX, y, cardW, cardH, 14);
    ctx.fill();

    // 1px Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Specular top highlight line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 16, y + 1);
    ctx.lineTo(cardX + cardW - 16, y + 1);
    ctx.stroke();

    // Team Accent left bar
    ctx.fillStyle = accentColor;
    roundRect(ctx, cardX, y + 12, 4, 32, 2);
    ctx.fill();

    // Short Name Pill
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    roundRect(ctx, cardX + 16, y + 12, 46, 26, 6);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.font = `bold 12px ${fontSans}`;
    ctx.textAlign = "center";
    ctx.fillText(t.shortName, cardX + 39, y + 18);
    ctx.textAlign = "left";

    // Full Team Name
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 22px ${fontScore}`;
    const nameText =
      t.name.length > 28 ? `${t.name.slice(0, 28)}…` : t.name;
    ctx.fillText(nameText, cardX + 72, y + 14);

    // Hero Score Display (Right)
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 30px ${fontScore}`;
    ctx.fillText(t.scoreLine, cardX + cardW - 18, y + 10);
    ctx.textAlign = "left";

    // Subtle horizontal divider between header and stats
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 16, y + 46);
    ctx.lineTo(cardX + cardW - 16, y + 46);
    ctx.stroke();

    // Section Headers
    const headY = y + 54;
    ctx.fillStyle = "#64748b";
    ctx.font = `bold 10px ${fontSans}`;
    ctx.fillText("TOP BATTERS", cardX + 18, headY);
    ctx.textAlign = "right";
    ctx.fillText("R", cardX + 370, headY);
    ctx.fillText("(B)", cardX + 425, headY);
    ctx.fillText("SR", cardX + 490, headY);
    ctx.textAlign = "left";

    // Vertical Divider
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.moveTo(cardX + 520, headY - 2);
    ctx.lineTo(cardX + 520, y + cardH - 12);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.fillText("KEY BOWLERS", cardX + 540, headY);
    ctx.textAlign = "right";
    ctx.fillText("O", cardX + 860, headY);
    ctx.fillText("R", cardX + 915, headY);
    ctx.fillText("W", cardX + 970, headY);
    ctx.fillText("ECON", cardX + 1045, headY);
    ctx.textAlign = "left";

    // Player Rows (up to 3)
    const rows = Math.min(Math.max(t.batters.length, t.bowlers.length, 1), 3);
    for (let i = 0; i < rows; i++) {
      const ry = y + 74 + i * 32;

      // Alternating subtle row wash
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        ctx.fillRect(cardX + 14, ry - 4, cardW - 28, 28);
      }

      // Batter
      const b = t.batters[i];
      if (b) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = `bold 13px ${fontSans}`;
        const bName =
          b.name.length > 22 ? `${b.name.slice(0, 22)}…` : b.name;
        ctx.fillText(bName, cardX + 18, ry);

        ctx.textAlign = "right";
        // Runs: highlight milestones
        const isMilestone = b.runs >= 50;
        ctx.fillStyle = isMilestone ? "#fbbf24" : "#ffffff";
        ctx.font = `800 14px ${fontScore}`;
        ctx.fillText(`${isMilestone ? "★ " : ""}${b.runs}`, cardX + 370, ry - 1);

        ctx.fillStyle = "#94a3b8";
        ctx.font = `12px ${fontSans}`;
        ctx.fillText(`(${b.balls})`, cardX + 425, ry);

        ctx.fillStyle = "#38bdf8";
        ctx.font = `12px ${fontSans}`;
        ctx.fillText(b.sr, cardX + 490, ry);
        ctx.textAlign = "left";
      }

      // Bowler
      const bo = t.bowlers[i];
      if (bo) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = `bold 13px ${fontSans}`;
        const boName =
          bo.name.length > 22 ? `${bo.name.slice(0, 22)}…` : bo.name;
        ctx.fillText(boName, cardX + 540, ry);

        ctx.textAlign = "right";
        ctx.fillStyle = "#94a3b8";
        ctx.font = `12px ${fontSans}`;
        ctx.fillText(bo.overs, cardX + 860, ry);
        ctx.fillText(String(bo.runs), cardX + 915, ry);

        // Wickets highlight
        ctx.fillStyle = bo.wickets > 0 ? "#f87171" : "#94a3b8";
        ctx.font = bo.wickets > 0 ? `800 14px ${fontScore}` : `12px ${fontSans}`;
        ctx.fillText(String(bo.wickets), cardX + 970, ry - 1);

        ctx.fillStyle = "#cbd5e1";
        ctx.font = `12px ${fontSans}`;
        ctx.fillText(bo.econ, cardX + 1045, ry);
        ctx.textAlign = "left";
      }
    }
  };

  drawTeamCard(92, s.team1, "#10b981");
  drawTeamCard(284, s.team2, "#38bdf8");

  // 4. Result & Player of the Match Banner (y: 476, h: 48)
  const bannerY = 476;
  const bannerH = 48;

  const resultGradient = ctx.createLinearGradient(
    cardX,
    bannerY,
    cardX + cardW,
    bannerY,
  );
  resultGradient.addColorStop(0, "rgba(16, 185, 129, 0.25)");
  resultGradient.addColorStop(0.5, "rgba(6, 78, 59, 0.4)");
  resultGradient.addColorStop(1, "rgba(16, 185, 129, 0.2)");
  ctx.fillStyle = resultGradient;
  roundRect(ctx, cardX, bannerY, cardW, bannerH, 10);
  ctx.fill();

  ctx.strokeStyle = "rgba(52, 211, 153, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top specular line on banner
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 12, bannerY + 1);
  ctx.lineTo(cardX + cardW - 12, bannerY + 1);
  ctx.stroke();

  // Winner Announcement
  ctx.fillStyle = "#ecfdf5";
  ctx.font = `800 16px ${fontScore}`;
  const resultStr = `🏆 ${s.result.toUpperCase()}`;
  ctx.fillText(resultStr, cardX + 18, bannerY + 14);

  // Player of the Match Jewel Pill (Right)
  if (s.playerOfTheMatch) {
    ctx.textAlign = "right";
    const potmLabel = `⭐ POTM: ${s.playerOfTheMatch}`;
    const potmW = ctx.measureText(potmLabel).width + 32;

    ctx.fillStyle = "rgba(234, 179, 8, 0.18)";
    roundRect(ctx, cardX + cardW - potmW - 12, bannerY + 9, potmW, 30, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(234, 179, 8, 0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#fef08a";
    ctx.font = `bold 12px ${fontSans}`;
    ctx.fillText(potmLabel, cardX + cardW - 24, bannerY + 16);
    ctx.textAlign = "left";
  }

  // 5. Footer: Match Metadata & Optical QR Card (y: 536 to 650)
  const footY = 538;

  // Venue Strip
  if (s.venue) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `bold 13px ${fontSans}`;
    ctx.fillText(`📍 ${s.venue}`, cardX, footY);
  }

  // Scheduled / Played At
  if (s.playedAt) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `12px ${fontSans}`;
    ctx.fillText(`📅 ${s.playedAt}`, cardX, footY + 22);
  }

  // URL
  ctx.fillStyle = "#34d399";
  ctx.font = `bold 12px ${fontSans}`;
  ctx.fillText(`🔗 ${s.matchUrl}`, cardX, footY + 44);

  // Optical White QR Card (Right side)
  if (qrImage) {
    const qrBoxSize = 92;
    const qrBoxX = W - cardX - qrBoxSize;
    const qrBoxY = 536;

    // High contrast white rounded card for phone camera readability
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 10);
    ctx.fill();

    const qrInner = 82;
    const qrOffset = (qrBoxSize - qrInner) / 2;
    ctx.drawImage(qrImage, qrBoxX + qrOffset, qrBoxY + qrOffset, qrInner, qrInner);

    // Callout text to the left of QR
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 11px ${fontSans}`;
    ctx.fillText("SCAN FOR FULL SCORECARD", qrBoxX - 16, qrBoxY + 18);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `11px ${fontSans}`;
    ctx.fillText("Ball-by-ball, Worm & Wagon Wheel", qrBoxX - 16, qrBoxY + 36);

    ctx.fillStyle = "#34d399";
    ctx.font = `bold 10px ${fontSans}`;
    ctx.fillText("Official Match Center", qrBoxX - 16, qrBoxY + 54);
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

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const exportPdf = async () => {
    setIsExportingPdf(true);
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
      const html = await buildMatchReportHtml(exportMatch, summary.matchUrl);
      const w = window.open("", "_blank", "width=860,height=950");
      if (!w) {
        toast.error("Allow pop-ups to export the PDF");
        return;
      }
      w.document.write(html);
      w.document.close();
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate match report PDF");
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
      >
        {isExportingPdf ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-4 w-4" />
        )}
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
