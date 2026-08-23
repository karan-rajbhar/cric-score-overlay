"use client";

import { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";
import { buildMatchReportHtml, buildExportSummary, type MatchExportSummary, type ExportTeamStats } from "~/lib/match-report";
import type { Match } from "~/lib/match-types";
import { CANVAS, COLORS, generateQRImage, createCanvas, downloadCanvas, slugify, roundRect } from "~/lib/canvas";

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
    qrImage: HTMLImageElement | null
) {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = "top";

    // Header
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 40px Arial, sans-serif";
    ctx.fillText("SUMMARY", 80, 52);

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText("C R I C S C O R E", W - 80, 62);
    ctx.textAlign = "left";

    // Team blocks
    const block = (y: number, t: ExportTeamStats) => {
        // Team panel
        ctx.fillStyle = COLORS.panel;
        roundRect(ctx, 64, y, W - 128, 210, 14);
        ctx.fill();

        ctx.fillStyle = COLORS.accent;
        ctx.font = "bold 26px Arial, sans-serif";
        ctx.fillText(t.name.length > 34 ? `${t.name.slice(0, 34)}…` : t.name, 92, y + 20);

        ctx.textAlign = "right";
        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 30px Arial, sans-serif";
        ctx.fillText(t.scoreLine, W - 92, y + 18);
        ctx.textAlign = "left";

        // Column headers
        ctx.fillStyle = COLORS.faint;
        ctx.font = "600 13px Arial, sans-serif";
        ctx.fillText("BATTING", 92, y + 62);
        ctx.fillText("BOWLING", 640, y + 62);

        ctx.fillStyle = COLORS.dim;
        ctx.font = "12px Arial, sans-serif";
        ctx.fillText("R (B)        SR", 400, y + 62);
        ctx.fillText("O-R-W      ECON", 960, y + 62);

        // Rows
        const rows = Math.max(t.batters.length, t.bowlers.length, 1);
        for (let i = 0; i < rows; i++) {
            const ry = y + 88 + i * 34;
            if (i % 2 === 0) {
                ctx.fillStyle = "rgba(255,255,255,0.025)";
                ctx.fillRect(80, ry - 6, W - 160, 30);
            }
            ctx.font = "15px Arial, sans-serif";

            const b = t.batters[i];
            if (b) {
                ctx.fillStyle = COLORS.text;
                ctx.fillText(b.name.length > 22 ? `${b.name.slice(0, 22)}…` : b.name, 92, ry);
                ctx.textAlign = "right";
                ctx.fillStyle = COLORS.dim;
                ctx.fillText(`${b.runs} (${b.balls})`, 470, ry);
                ctx.fillText(b.sr, 560, ry);
                ctx.textAlign = "left";
            }

            const bo = t.bowlers[i];
            if (bo) {
                ctx.fillStyle = COLORS.text;
                ctx.fillText(bo.name.length > 22 ? `${bo.name.slice(0, 22)}…` : bo.name, 640, ry);
                ctx.textAlign = "right";
                ctx.fillStyle = COLORS.dim;
                ctx.fillText(`${bo.overs}-${bo.runs}-${bo.wickets}`, 990, ry);
                ctx.fillText(bo.econ, 1108, ry);
                ctx.textAlign = "left";
            }
        }
    };

    block(120, s.team1);
    block(348, s.team2);

    // Result banner
    const bannerY = 576;
    ctx.fillStyle = COLORS.accent;
    roundRect(ctx, 64, bannerY, W - 128, 52, 10);
    ctx.fill();
    ctx.fillStyle = "#06130d";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
        s.result.length > 72 ? `${s.result.slice(0, 72)}…` : s.result,
        W / 2,
        bannerY + 15
    );
    ctx.textAlign = "left";

    // Footer: URL left, meta center-left, QR right
    ctx.fillStyle = COLORS.faint;
    ctx.font = "15px Arial, sans-serif";
    ctx.fillText(s.matchUrl, 64, bannerY + 68);
    const meta = [s.venue, s.playedAt].filter(Boolean).join("  ·  ");
    if (meta) {
        ctx.fillStyle = COLORS.dim;
        ctx.fillText(meta.length > 90 ? `${meta.slice(0, 90)}…` : meta, 64, bannerY + 88);
    }

    if (qrImage) {
        ctx.drawImage(qrImage, W - 156, bannerY + 60, 92, 92);
        ctx.fillStyle = COLORS.faint;
        ctx.font = "11px Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("SCAN FOR SCORECARD", W - 156, bannerY + 156);
        ctx.textAlign = "left";
    }
}

export function MatchExportButtons({ match }: { match: Match }) {
    const matchUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}/matches/${match.id}`
            : `/matches/${match.id}`;
    const summary = useMemo(() => buildExportSummary(match, matchUrl), [match, matchUrl]);

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
        </>
    );
}
