"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Share2, Download, Copy, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  CANVAS,
  COLORS,
  FONT,
  paintWash,
  generateQRImage,
  createCanvas,
  slugify,
  roundRect,
} from "~/lib/canvas";

export interface StandingsShareRow {
  pos: number;
  teamName: string;
  shortName: string | null;
  p: number;
  w: number;
  l: number;
  t: number;
  pts: number;
  nrr: string;
}

interface PointsTableShareProps {
  tournamentName: string;
  tournamentId: string;
  format: string;
  standings: StandingsShareRow[];
}

const { W, H } = CANVAS.POINTS_TABLE;

function drawPointsTable(
  ctx: CanvasRenderingContext2D,
  tournamentName: string,
  format: string,
  standings: StandingsShareRow[],
  qrImage: HTMLImageElement | null,
) {
  // 1. Background
  paintWash(ctx, W, H);

  ctx.textBaseline = "top";

  // 2. Header
  // Badge
  ctx.fillStyle = COLORS.soft;
  roundRect(ctx, 60, 48, 160, 32, 6);
  ctx.fill();
  ctx.fillStyle = COLORS.primary;
  ctx.font = `bold 13px ${FONT.sans}`;
  ctx.fillText("Points table", 82, 57);

  // Tournament Name
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 34px ${FONT.sans}`;
  const nameText =
    tournamentName.length > 38
      ? `${tournamentName.slice(0, 38)}…`
      : tournamentName;
  ctx.fillText(nameText, 60, 92);

  // Format & Date subtitle
  ctx.fillStyle = COLORS.dim;
  ctx.font = `16px ${FONT.sans}`;
  ctx.fillText(`${format} Tournament · Live Standings`, 60, 136);

  // QR Code + Brand
  if (qrImage) {
    const qrSize = 100;
    const qrX = W - 60 - qrSize;
    const qrY = 48;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = COLORS.faint;
    ctx.font = `11px ${FONT.sans}`;
    ctx.textAlign = "center";
    ctx.fillText("Scan to view", qrX + qrSize / 2, qrY + qrSize + 8);
    ctx.textAlign = "left";
  }

  // Top divider line
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 175);
  ctx.lineTo(W - 60, 175);
  ctx.stroke();

  // 3. Table Header
  const thY = 190;
  ctx.fillStyle = COLORS.muted;
  roundRect(ctx, 60, thY, W - 120, 36, 6);
  ctx.fill();

  ctx.fillStyle = COLORS.faint;
  ctx.font = `bold 12px ${FONT.sans}`;
  ctx.fillText("Pos", 80, thY + 11);
  ctx.fillText("Team", 150, thY + 11);
  ctx.textAlign = "center";
  ctx.fillText("P", 680, thY + 11);
  ctx.fillText("W", 760, thY + 11);
  ctx.fillText("L", 840, thY + 11);
  ctx.fillText("T", 920, thY + 11);
  ctx.fillText("NRR", 1000, thY + 11);
  ctx.fillText("Pts", 1080, thY + 11);
  ctx.textAlign = "left";

  // 4. Table Rows (up to 8 rows fit comfortably)
  const maxRows = Math.min(standings.length, 8);
  let rowY = 236;
  const rowHeight = 54;

  for (let i = 0; i < maxRows; i++) {
    const row = standings[i];
    if (!row) continue;
    const isTop = i === 0;

    // Row background
    if (isTop) {
      ctx.fillStyle = COLORS.soft;
    } else if (i % 2 === 0) {
      ctx.fillStyle = COLORS.card;
    } else {
      ctx.fillStyle = "transparent";
    }
    roundRect(ctx, 60, rowY, W - 120, rowHeight - 6, 6);
    ctx.fill();

    // Position
    ctx.fillStyle = isTop ? COLORS.primary : COLORS.dim;
    ctx.font = `bold 16px ${FONT.sans}`;
    ctx.fillText(`${row.pos}`, 88, rowY + 15);

    // Team Name & Short Name
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 17px ${FONT.sans}`;
    const tName =
      row.teamName.length > 26 ? `${row.teamName.slice(0, 26)}…` : row.teamName;
    ctx.fillText(tName, 150, rowY + 14);

    if (row.shortName) {
      ctx.fillStyle = COLORS.faint;
      ctx.font = `12px ${FONT.sans}`;
      ctx.fillText(
        `(${row.shortName})`,
        150 + ctx.measureText(tName).width + 8,
        rowY + 17,
      );
    }

    // Stats columns
    ctx.textAlign = "center";
    ctx.font = `15px ${FONT.sans}`;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`${row.p}`, 680, rowY + 15);
    ctx.fillText(`${row.w}`, 760, rowY + 15);
    ctx.fillText(`${row.l}`, 840, rowY + 15);
    ctx.fillText(`${row.t}`, 920, rowY + 15);

    // NRR
    ctx.fillStyle = row.nrr.startsWith("-") ? COLORS.wicket : COLORS.success;
    ctx.fillText(row.nrr, 1000, rowY + 15);

    // PTS (Highlighted)
    ctx.fillStyle = isTop ? COLORS.primary : COLORS.text;
    ctx.font = `bold 18px ${FONT.sans}`;
    ctx.fillText(`${row.pts}`, 1080, rowY + 14);
    ctx.textAlign = "left";

    rowY += rowHeight;
  }

  // 5. Footer branding
  const footerY = H - 54;
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(60, footerY);
  ctx.lineTo(W - 60, footerY);
  ctx.stroke();

  ctx.fillStyle = COLORS.faint;
  ctx.font = `13px ${FONT.sans}`;
  ctx.fillText(
    "C R I C S C O R E   O V E R L A Y   &   A N A L Y T I C S",
    60,
    footerY + 18,
  );

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.primary;
  ctx.font = `bold 13px ${FONT.sans}`;
  ctx.fillText("Live tournament standings", W - 60, footerY + 18);
  ctx.textAlign = "left";
}

export function PointsTableShare({
  tournamentName,
  tournamentId,
  format,
  standings,
}: PointsTableShareProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateImage = async () => {
    setGenerating(true);
    try {
      const tournamentUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/tournaments/${tournamentId}`
          : `/tournaments/${tournamentId}`;

      const qrImage = await generateQRImage(tournamentUrl, 120);
      const { canvas, ctx } = createCanvas(W, H);
      drawPointsTable(ctx, tournamentName, format, standings, qrImage);

      const dataUrl = canvas.toDataURL("image/png");
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate points table image:", err);
      toast.error("Failed to generate points table image");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpen = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && !previewUrl) {
      void generateImage();
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `points-table-${slugify(tournamentName)}.png`;
    a.click();
    toast.success("Points table graphic downloaded");
  };

  const handleCopy = async () => {
    if (!previewUrl) return;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopied(true);
      toast.success("Image copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error(
        "Could not copy directly to clipboard. Please click Download.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="h-4 w-4" />
          Share table
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share points table graphic</DialogTitle>
          <DialogDescription>
            Download or copy the points table as an image to share.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-2">
          {generating ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Rendering graphics...
              </p>
            </div>
          ) : previewUrl ? (
            <div className="overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`${tournamentName} Points Table`}
                className="h-auto w-full object-contain"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Unable to generate preview.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="secondary"
            onClick={handleCopy}
            disabled={!previewUrl || generating}
            className="gap-1.5"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy image"}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!previewUrl || generating}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
