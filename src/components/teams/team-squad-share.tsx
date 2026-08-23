"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { CANVAS, COLORS, generateQRImage, createCanvas, downloadCanvas, slugify } from "~/lib/canvas";

interface SquadPlayer {
    full_name: string;
    role_in_team?: string | null;
    jersey_number?: number | null;
}

interface TeamSquadShareProps {
    teamId: string;
    teamName: string;
    shortName?: string | null;
    players: SquadPlayer[];
}

const { W, H } = CANVAS.SQUAD;

function drawSquadCanvas(
    ctx: CanvasRenderingContext2D,
    teamName: string,
    players: SquadPlayer[],
    teamUrl: string,
    qrImage: HTMLImageElement | null
) {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, "#1a3328");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, 0, W, 5);

    ctx.textBaseline = "top";

    // Header
    ctx.fillStyle = COLORS.dim;
    ctx.font = "600 18px Arial, sans-serif";
    ctx.fillText("TEAM SQUAD", 48, 40);

    ctx.fillStyle = COLORS.accent;
    ctx.font = "600 13px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("C R I C S C O R E", W - 48, 44);
    ctx.textAlign = "left";

    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 32px Arial, sans-serif";
    const title = teamName.length > 34 ? `${teamName.slice(0, 34)}…` : teamName;
    ctx.fillText(title, 48, 72);

    ctx.fillStyle = COLORS.dim;
    ctx.font = "15px Arial, sans-serif";
    ctx.fillText(`${players.length} players`, 48, 112);

    // Player list header
    let y = 160;
    ctx.fillStyle = COLORS.faint;
    ctx.font = "600 12px Arial, sans-serif";
    ctx.fillText("#", 48, y);
    ctx.fillText("PLAYER", 100, y);
    ctx.textAlign = "right";
    ctx.fillText("ROLE", W - 48, y);
    ctx.textAlign = "left";

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(48, y + 18);
    ctx.lineTo(W - 48, y + 18);
    ctx.stroke();

    y += 28;

    // Rows
    ctx.font = "15px Arial, sans-serif";
    for (let i = 0; i < Math.min(players.length, 18); i++) {
        const p = players[i]!;
        if (i % 2 === 0) {
            ctx.fillStyle = COLORS.panel;
            ctx.fillRect(40, y - 4, W - 80, 32);
        }

        ctx.fillStyle = COLORS.text;
        const jersey = p.jersey_number ? `#${p.jersey_number}` : `${i + 1}`;
        ctx.fillText(jersey, 48, y + 6);

        const name = p.full_name.length > 32 ? `${p.full_name.slice(0, 32)}…` : p.full_name;
        ctx.fillText(name, 100, y + 6);

        const role = (p.role_in_team ?? "player").replace(/_/g, " ");
        ctx.textAlign = "right";
        ctx.fillStyle = COLORS.dim;
        ctx.font = "13px Arial, sans-serif";
        ctx.fillText(role, W - 48, y + 7);
        ctx.textAlign = "left";
        ctx.font = "15px Arial, sans-serif";

        y += 32;
    }

    if (players.length > 18) {
        ctx.fillStyle = COLORS.faint;
        ctx.font = "13px Arial, sans-serif";
        ctx.fillText(`+ ${players.length - 18} more`, 48, y + 8);
        y += 28;
    }

    // Footer with QR + URL
    const footerY = H - 110;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(48, footerY);
    ctx.lineTo(W - 48, footerY);
    ctx.stroke();

    ctx.fillStyle = COLORS.faint;
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(teamUrl, 48, footerY + 18);
    ctx.fillStyle = COLORS.dim;
    ctx.font = "600 12px Arial, sans-serif";
    ctx.fillText("View team on CricScore", 48, footerY + 38);

    if (qrImage) {
        ctx.drawImage(qrImage, W - 128, footerY + 12, 80, 80);
        ctx.fillStyle = COLORS.faint;
        ctx.font = "10px Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("SCAN", W - 88, footerY + 98);
        ctx.textAlign = "left";
    }
}

export function TeamSquadShare({ teamId, teamName, players }: TeamSquadShareProps) {
    const [saving, setSaving] = useState(false);

    const handleShare = async () => {
        setSaving(true);
        try {
            const teamUrl =
                typeof window !== "undefined"
                    ? `${window.location.origin}/teams/${teamId}`
                    : `/teams/${teamId}`;

            const qrImage = await generateQRImage(teamUrl, 160);
            const { canvas, ctx } = createCanvas(W, H);
            drawSquadCanvas(ctx, teamName, players, teamUrl, qrImage);
            await downloadCanvas(canvas, `${slugify(teamName)}-squad`);
            toast.success("Squad image downloaded");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={() => void handleShare()} disabled={saving}>
            <Share2 className="mr-1.5 h-4 w-4" />
            {saving ? "Generating…" : "Share squad"}
        </Button>
    );
}
