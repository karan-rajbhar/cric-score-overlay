/**
 * Shared canvas + QR helpers — deduplicates the identical QR + canvas
 * boilerplate that lived in summary-image.ts and team-squad-share.tsx.
 */
import QRCode from "qrcode";

export const CANVAS = {
  MATCH_SUMMARY: { W: 1200, H: 675 },
  SQUAD: { W: 800, H: 900 },
  POINTS_TABLE: { W: 1200, H: 800 },
  QR: { WIDTH: 184, MARGIN: 0 },
} as const;

/** The design system's palette for share images (globals.css tokens as hex). */
export const COLORS = {
  wash: ["#fce8ee", "#eceafd", "#e4e9fe"],
  bg: "#fafafd",
  card: "#ffffff",
  border: "#e2e4ee",
  muted: "#f1f3f8",
  row: "rgba(36, 34, 103, 0.04)",
  primary: "#242267",
  /** --brand: the logo's tile. */
  brand: "#2e449e",
  board: "#181745",
  soft: "#e7e8fd",
  text: "#11132c",
  dim: "#63667e",
  faint: "#9b9db3",
  success: "#15803d",
  wicket: "#dc2828",
  shadow: "rgba(36, 34, 103, 0.14)",
} as const;

/** The app's faces (loaded by the root layout under these names). */
export const FONT = {
  sans: "Urbanist, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fig: "Outfit, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

/** The pink-to-lavender wash over the top of the image, fading into the page. */
export function paintWash(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);
  const wash = ctx.createLinearGradient(0, 0, w, h * 0.7);
  wash.addColorStop(0, COLORS.wash[0]);
  wash.addColorStop(0.52, COLORS.wash[1]);
  wash.addColorStop(1, COLORS.wash[2]);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h * 0.62);
  const fade = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.62);
  fade.addColorStop(0, "rgba(250, 250, 253, 0)");
  fade.addColorStop(1, COLORS.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, h * 0.42, w, h * 0.2 + 1);
}

/**
 * The brand mark (src/app/icon.svg): three stumps and a split bail on the
 * brand tile, `size` px square at (x, y).
 */
export function paintBrandMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const u = size / 32;
  ctx.save();
  ctx.fillStyle = COLORS.brand;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 9 * u);
  ctx.fill();
  ctx.fillStyle = COLORS.card;
  for (const [rx, ry, w, h, r] of [
    [8, 10.5, 4, 15.5, 2],
    [14, 10.5, 4, 15.5, 2],
    [20, 10.5, 4, 15.5, 2],
    [8, 6.5, 7, 2, 1],
    [17, 6.5, 7, 2, 1],
  ] as const) {
    ctx.beginPath();
    ctx.roundRect(x + rx * u, y + ry * u, w * u, h * u, r * u);
    ctx.fill();
  }
  ctx.restore();
}

/** A white card with the design's soft shadow. */
export function paintCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.save();
  ctx.shadowColor = COLORS.shadow;
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

/** Generate a QR data URL for the given text. */
async function generateQRDataUrl(
  text: string,
  width: number = CANVAS.QR.WIDTH,
): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: CANVAS.QR.MARGIN,
    width,
    color: { dark: COLORS.board, light: COLORS.card },
  });
}

/** Load an image from a data URL — resolves when decoded. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Convenience: generate QR and load as image in one call. Returns null on failure. */
export async function generateQRImage(
  text: string,
  width: number = CANVAS.QR.WIDTH,
): Promise<HTMLImageElement | null> {
  try {
    const dataUrl = await generateQRDataUrl(text, width);
    return await loadImage(dataUrl);
  } catch {
    return null;
  }
}

/** Create a canvas with typical download helper. */
export function createCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
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
  return text
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "");
}

/** Rounded-rect helper for canvas. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
