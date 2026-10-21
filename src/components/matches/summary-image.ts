/**
 * The shareable match summary image (1200x675, PNG), in the app's design:
 * the wash, a white header card with both sides and the result (or, while
 * the match is live, where it stands), the top performers of each side, and
 * the link with its QR code. Used by "Share summary" on the match page and
 * the scorer's "Share live score".
 */
import {
  CANVAS,
  COLORS,
  FONT,
  createCanvas,
  generateQRImage,
  paintBrandMark,
  paintCard,
  paintWash,
  roundRect,
  slugify,
} from "~/lib/canvas";
import {
  buildExportSummary,
  type ExportTeamStats,
  type MatchExportSummary,
} from "~/lib/match-report";
import type { Match } from "~/lib/match-types";

const { W, H } = CANVAS.MATCH_SUMMARY;

const C = COLORS;
const SANS = FONT.sans;
const FIG = FONT.fig;

/** Shorten text to fit a width, with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) {
    t = t.slice(0, -1);
  }
  return `${t.trimEnd()}…`;
}

/**
 * `text` on one line within `max`, else on two balanced lines (the split
 * that keeps the longer line shortest), the second shortened if need be.
 */
function balancedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
): string[] {
  if (ctx.measureText(text).width <= max) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  let best: [string, string] | null = null;
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (ctx.measureText(a).width <= max && w < bestWidth) {
      best = [a, b];
      bestWidth = w;
    }
  }
  return best ? [best[0], fit(ctx, best[1], max)] : [fit(ctx, text, max)];
}

const card = paintCard;

/** A round lavender crest with the team's short code. */
function crest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  code: string,
) {
  ctx.fillStyle = C.soft;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.primary;
  ctx.font = `600 ${Math.round(r * 0.62)}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(code.slice(0, 3).toUpperCase(), cx, cy - r * 0.36);
  ctx.textAlign = "left";
}

function drawMapPinIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(s / 2, s * 0.4, s * 0.3, Math.PI, 0);
  ctx.lineTo(s / 2, s);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawCalendarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  roundRect(ctx, x + 1, y + 2, s - 2, s - 3, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 1, y + s * 0.42);
  ctx.lineTo(x + s - 1, y + s * 0.42);
  ctx.stroke();
  ctx.restore();
}

function drawLinkIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x + s * 0.35, y + s * 0.6, s * 0.24, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.89, y + s * 0.4);
  ctx.arc(x + s * 0.65, y + s * 0.4, s * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** One side of the header card: crest, name, score and overs. */
function heroSide(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  t: ExportTeamStats,
  dim: boolean,
) {
  crest(ctx, cx, y + 36, 34, t.shortName);
  ctx.textAlign = "center";
  ctx.fillStyle = dim ? C.dim : C.text;
  ctx.font = `600 20px ${SANS}`;
  ctx.fillText(fit(ctx, t.name, 300), cx, y + 82);
  const [score = t.scoreLine, overs] = t.scoreLine.split(" (");
  ctx.fillStyle = dim ? C.dim : C.text;
  ctx.font = `600 44px ${FIG}`;
  ctx.fillText(score, cx, y + 110);
  if (overs) {
    ctx.fillStyle = C.dim;
    ctx.font = `500 15px ${FIG}`;
    ctx.fillText(`(${overs}`, cx, y + 160);
  }
  ctx.textAlign = "left";
}

/** A team's card: its top batters and bowlers in two short tables. */
function teamCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: ExportTeamStats,
) {
  card(ctx, x, y, w, h, 20);
  crest(ctx, x + 34, y + 34, 16, t.shortName);
  ctx.fillStyle = C.text;
  ctx.font = `600 18px ${SANS}`;
  ctx.fillText(fit(ctx, t.name, w - 220), x + 60, y + 23);
  ctx.textAlign = "right";
  ctx.font = `600 20px ${FIG}`;
  ctx.fillText(t.scoreLine, x + w - 20, y + 22);
  ctx.textAlign = "left";

  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 62);
  ctx.lineTo(x + w - 20, y + 62);
  ctx.stroke();

  const colW = (w - 60) / 2;
  const cols = [
    {
      x: x + 20,
      head: "Top batters",
      rows: t.batters.slice(0, 3).map((b) => ({
        name: b.name,
        fig: `${b.runs}${b.notOut ? "*" : ""}`,
        sub: `(${b.balls})`,
        strong: b.runs >= 50,
      })),
    },
    {
      x: x + 40 + colW,
      head: "Top bowlers",
      rows: t.bowlers.slice(0, 3).map((b) => ({
        name: b.name,
        fig: `${b.wickets}/${b.runs}`,
        sub: `(${b.overs})`,
        strong: b.wickets >= 3,
      })),
    },
  ];
  for (const col of cols) {
    ctx.fillStyle = C.dim;
    ctx.font = `500 13px ${SANS}`;
    ctx.fillText(col.head, col.x, y + 76);
    col.rows.forEach((r, i) => {
      const ry = y + 104 + i * 30;
      ctx.fillStyle = C.text;
      ctx.font = `500 15px ${SANS}`;
      ctx.fillText(fit(ctx, r.name, colW - 96), col.x, ry);
      ctx.textAlign = "right";
      ctx.fillStyle = C.dim;
      ctx.font = `400 13px ${FIG}`;
      const subW = ctx.measureText(r.sub).width;
      ctx.fillText(r.sub, col.x + colW, ry + 1);
      ctx.fillStyle = r.strong ? C.primary : C.text;
      ctx.font = `600 16px ${FIG}`;
      ctx.fillText(r.fig, col.x + colW - subW - 6, ry);
      ctx.textAlign = "left";
    });
  }
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  paintWash(ctx, W, H);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  s: MatchExportSummary,
  pad: number,
) {
  // Header: brand, title; format on the right.
  paintBrandMark(ctx, pad, 32, 30);
  ctx.fillStyle = C.text;
  ctx.font = `700 20px ${SANS}`;
  ctx.fillText("CricScore", pad + 40, 36);

  ctx.fillStyle = C.text;
  ctx.font = `600 26px ${SANS}`;
  ctx.fillText(fit(ctx, s.title, W - pad * 2 - 260), pad, 74);

  ctx.textAlign = "right";
  ctx.font = `500 14px ${SANS}`;
  const fmt = s.format;
  const fmtW = ctx.measureText(fmt).width + 32;
  ctx.fillStyle = C.card;
  roundRect(ctx, W - pad - fmtW, 34, fmtW, 28, 14);
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = C.dim;
  ctx.fillText(fmt, W - pad - 16, 41);
  ctx.fillText(s.live ? "Live score" : "Match summary", W - pad, 80);
  ctx.textAlign = "left";
}

function drawHeroCard(
  ctx: CanvasRenderingContext2D,
  s: MatchExportSummary,
  pad: number,
  heroY: number,
  heroH: number,
) {
  // Header card: the two sides, the result (or, live, where the match
  // stands) and player of the match. The loser is dimmed once it is over.
  card(ctx, pad, heroY, W - pad * 2, heroH, 26);
  const winner = s.live ? "" : s.result.toLowerCase();
  const dim1 = !winner.startsWith(s.team1.name.toLowerCase());
  const dim2 = !winner.startsWith(s.team2.name.toLowerCase());
  const bothDim = dim1 && dim2;
  heroSide(ctx, pad + 210, heroY + 14, s.team1, dim1 && !bothDim);
  heroSide(ctx, W - pad - 210, heroY + 14, s.team2, dim2 && !bothDim);

  ctx.textAlign = "center";
  ctx.fillStyle = C.muted;
  roundRect(ctx, W / 2 - 34, heroY + 40, 68, 26, 13);
  ctx.fill();
  if (s.live) {
    // The live dot, then the label.
    ctx.fillStyle = C.wicket;
    ctx.beginPath();
    ctx.arc(W / 2 - 16, heroY + 53, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.wicket;
    ctx.font = `600 13px ${SANS}`;
    ctx.fillText("Live", W / 2 + 6, heroY + 46);
  } else {
    ctx.fillStyle = C.dim;
    ctx.font = `500 13px ${SANS}`;
    ctx.fillText("Result", W / 2, heroY + 46);
  }
  ctx.fillStyle = s.live ? C.text : C.success;
  ctx.font = `${s.live ? 600 : 700} 19px ${SANS}`;
  const lines = balancedLines(ctx, s.result, 340);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, heroY + 84 + i * 26));
  if (s.playerOfTheMatch) {
    const y = heroY + 122 + (lines.length - 1) * 22;
    ctx.fillStyle = C.dim;
    ctx.font = `500 14px ${SANS}`;
    ctx.fillText("Player of the match", W / 2, y);
    ctx.fillStyle = C.text;
    ctx.font = `600 17px ${SANS}`;
    ctx.fillText(fit(ctx, s.playerOfTheMatch, 320), W / 2, y + 20);
  }
  ctx.textAlign = "left";
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  s: MatchExportSummary,
  qrImage: HTMLImageElement | null,
  pad: number,
  footY: number,
) {
  // Footer: where and when, the link, and the QR code.
  let line = footY + 2;
  if (s.venue) {
    drawMapPinIcon(ctx, pad, line, 14, C.dim);
    ctx.fillStyle = C.text;
    ctx.font = `500 15px ${SANS}`;
    ctx.fillText(fit(ctx, s.venue, 640), pad + 22, line - 1);
    line += 26;
  }
  if (s.playedAt) {
    drawCalendarIcon(ctx, pad, line, 14, C.dim);
    ctx.fillStyle = C.dim;
    ctx.font = `400 14px ${SANS}`;
    ctx.fillText(s.playedAt, pad + 22, line - 1);
    line += 26;
  }
  drawLinkIcon(ctx, pad, line, 14, C.primary);
  ctx.fillStyle = C.primary;
  ctx.font = `600 14px ${SANS}`;
  ctx.fillText(fit(ctx, s.matchUrl, 640), pad + 22, line - 1);

  if (qrImage) {
    const box = 92;
    const qx = W - pad - box;
    const qy = H - pad - box + 16;
    card(ctx, qx, qy, box, box, 14);
    ctx.drawImage(qrImage, qx + 6, qy + 6, box - 12, box - 12);
    ctx.textAlign = "right";
    ctx.fillStyle = C.text;
    ctx.font = `600 14px ${SANS}`;
    ctx.fillText("Scan for the full scorecard", qx - 16, qy + 22);
    ctx.fillStyle = C.dim;
    ctx.font = `400 13px ${SANS}`;
    ctx.fillText("Ball by ball, charts and stats", qx - 16, qy + 44);
    ctx.textAlign = "left";
  }
}

/**
 * The shareable match summary (1200x675), in the app's design: the wash,
 * a white header card with both sides and the result, the top performers
 * of each side, and the link with its QR code.
 */
export function drawSummary(
  ctx: CanvasRenderingContext2D,
  s: MatchExportSummary,
  qrImage: HTMLImageElement | null,
) {
  const pad = 48;
  const heroY = 122;
  const heroH = 200;
  drawBackground(ctx);
  ctx.textBaseline = "top";
  drawHeader(ctx, s, pad);
  drawHeroCard(ctx, s, pad, heroY, heroH);

  // Top performers, one card per side.
  const cardsY = heroY + heroH + 18;
  const cardW = (W - pad * 2 - 20) / 2;
  teamCard(ctx, pad, cardsY, cardW, 196, s.team1);
  teamCard(ctx, pad + cardW + 20, cardsY, cardW, 196, s.team2);

  drawFooter(ctx, s, qrImage, pad, cardsY + 214);
}

/** The summary image of `match` as a PNG file, named after the match. */
export async function summaryImageFile(
  match: Match,
  matchUrl: string,
): Promise<File> {
  const summary = buildExportSummary(match, matchUrl);
  const { canvas, ctx } = createCanvas(W, H);
  // The canvas draws in Urbanist / Outfit: make sure both are loaded.
  await Promise.all(
    ["600 20px Urbanist", "600 20px Outfit"].map((f) =>
      document.fonts?.load(f).catch(() => undefined),
    ),
  );
  const qrImage = await generateQRImage(summary.matchUrl, 184);
  drawSummary(ctx, summary, qrImage);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not draw the summary image");
  return new File([blob], `${slugify(summary.title) || "match"}.png`, {
    type: "image/png",
  });
}
