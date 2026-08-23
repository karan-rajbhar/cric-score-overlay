/**
 * Shared canvas + QR helpers — deduplicates the identical QR + canvas
 * boilerplate that lived in match-export-buttons.tsx and team-squad-share.tsx.
 */
import QRCode from "qrcode";

export const CANVAS = {
    MATCH_SUMMARY: { W: 1200, H: 675 },
    SQUAD: { W: 800, H: 900 },
    QR: { WIDTH: 184, MARGIN: 0 },
} as const;

export const COLORS = {
    bgTop: "#0c1210",
    bgBottom: "#1a3328",
    panel: "rgba(255,255,255,0.04)",
    accent: "#22c55e",
    text: "#f2f5f3",
    dim: "#8fa89b",
    faint: "#6b8579",
} as const;

/** Generate a QR data URL for the given text. */
export async function generateQRDataUrl(text: string, width: number = CANVAS.QR.WIDTH): Promise<string> {
    return QRCode.toDataURL(text, {
        margin: CANVAS.QR.MARGIN,
        width,
        color: { dark: COLORS.bgTop, light: COLORS.text },
    });
}

/** Load an image from a data URL — resolves when decoded. */
export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/** Convenience: generate QR and load as image in one call. Returns null on failure. */
export async function generateQRImage(text: string, width: number = CANVAS.QR.WIDTH): Promise<HTMLImageElement | null> {
    try {
        const dataUrl = await generateQRDataUrl(text, width);
        return await loadImage(dataUrl);
    } catch {
        return null;
    }
}

/** Create a canvas with typical download helper. */
export function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    return { canvas, ctx };
}

/** Trigger download of a canvas as PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
    return new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) return resolve();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
            a.click();
            URL.revokeObjectURL(url);
            resolve();
        }, "image/png");
    });
}

/** Slugify a title for filenames. */
export function slugify(text: string): string {
    return text.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");
}

/** Rounded-rect helper for canvas. */
export function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}
