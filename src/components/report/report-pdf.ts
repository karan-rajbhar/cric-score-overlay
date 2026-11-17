/**
 * "Share PDF" on the report page: the report is turned into a PDF file in
 * the browser (html2canvas renders each `.report-page` in its desktop A4
 * layout, jsPDF assembles them; both pinned on jsDelivr with integrity
 * hashes) as soon as the page has loaded, so a tap opens the phone's share
 * sheet (WhatsApp, Gmail, ...) at once: browsers allow sharing only right
 * after a tap. Where files cannot be shared (Firefox, Linux) it downloads.
 */

type Html2Canvas = (
  el: HTMLElement,
  opts: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;
type JsPdf = {
  addPage(): void;
  addImage(
    data: string,
    type: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
  output(type: "blob"): Blob;
};
type ReportWindow = Window & {
  html2canvas?: Html2Canvas;
  jspdf?: { jsPDF: new (opts: Record<string, unknown>) => JsPdf };
};

export const PDF_LIBS = [
  [
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
    "sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H",
  ],
  [
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
    "sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/",
  ],
] as const;

const A4_W = 210;
const A4_H = 297;
/** A sheet may not end inside a block this short (a row, a card). */
const KEEP_WHOLE = 400;
/** Nor right after a heading. */
const KEEP_WITH_NEXT = 60;

export function canShareFiles(): boolean {
  try {
    return Boolean(
      navigator.canShare?.({
        files: [new File(["x"], "x.pdf", { type: "application/pdf" })],
      }),
    );
  } catch {
    return false;
  }
}

function load(src: string, integrity: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Team logos live on another site, which a canvas may not read: they go in
 * through this site's image optimizer, or show initials (as when a team has
 * no logo) if that fails.
 */
async function proxyLogos(): Promise<Map<string, string>> {
  const via = new Map<string, string>();
  const imgs =
    document.querySelectorAll<HTMLImageElement>("img[data-initials]");
  await Promise.all(
    Array.from(imgs, (img) => {
      const src = img.getAttribute("src") ?? "";
      let url: URL;
      try {
        url = new URL(src, location.href);
      } catch {
        return null;
      }
      if (url.origin === location.origin || url.protocol === "data:") {
        return null;
      }
      const proxied = `${location.origin}/_next/image?url=${encodeURIComponent(url.href)}&w=256&q=75`;
      return new Promise<void>((resolve) => {
        const probe = new Image();
        probe.onload = () => {
          via.set(src, proxied);
          resolve();
        };
        probe.onerror = () => resolve();
        probe.src = proxied;
      });
    }),
  );
  return via;
}

/**
 * Where a sheet may end, measured on the copy html2canvas renders, and the
 * section each part of the page belongs to (for the running header).
 */
type Layout = {
  box: DOMRect;
  cuts: number[];
  blocks: [number, number][];
  labels: [number, string][];
};

/**
 * A `.report-page` with `data-running-header` starts every sheet with a
 * band naming the match (`[data-report-heading]`'s text) on the left and
 * the section and "Page N of M" on the right, so a sheet seen alone (a
 * WhatsApp preview, a printout) says what it is. Its height, CSS px.
 */
const HEADER_PX = 44;

/** The page's width in the PDF copy (CSS px, margin included). */
const SHEET_PX = 820;

/** Pixels per CSS px in the PDF's pictures. */
const SCALE = 2;

/**
 * iPhone Safari draws no canvas larger than 16,777,216 pixels (it comes out
 * blank), and each `.report-page` is one canvas; keep below it with room.
 */
const MAX_CANVAS_PX = 15_000_000;

/**
 * The scale for one page's canvas: SCALE, or less for a page tall enough
 * to pass MAX_CANVAS_PX. Its height in the copy is not known yet; as shown
 * it is at least as tall (a page narrower than SHEET_PX only grows).
 */
export function canvasScale(shown: { width: number; height: number }): number {
  const height = shown.height * Math.max(1, shown.width / SHEET_PX);
  if (height <= 0) return SCALE;
  // Rounded down, so the canvas never ends a pixel over the limit.
  const fit = Math.floor(Math.sqrt(MAX_CANVAS_PX / (SHEET_PX * height)) * 1000) / 1000;
  return Math.min(SCALE, fit);
}

/**
 * What html2canvas draws differently from the browser, set right in its
 * copy: text in a clipping box (a truncated name) can lose its bottom, it
 * places glyphs without tabular figures, it leaves out text nested in an
 * inline-flex box (a ball chip's label), paints an inset ring over the
 * fill (the brand tile, extras chips), and it crops by the page's own
 * box, so the page goes to the top left at a fixed width with a margin.
 */
function fitForCanvas(doc: Document, el: HTMLElement) {
  const style = doc.createElement("style");
  style.textContent = `
    .truncate, [class*="line-clamp"] { overflow: visible !important; text-overflow: clip !important; }
    * { font-variant-numeric: normal !important; }
    .inline-flex { display: flex !important; }
    .ring-inset { box-shadow: none !important; }
  `;
  doc.head.appendChild(style);
  for (
    let n = el.parentElement;
    n && n !== doc.documentElement;
    n = n.parentElement
  ) {
    n.style.margin = "0";
    n.style.padding = "0";
    n.style.maxWidth = "none";
  }
  el.style.width = `${SHEET_PX}px`;
  el.style.margin = "0";
  // A running header's band is the top margin of every sheet.
  el.style.padding = el.hasAttribute("data-running-header")
    ? "0 28px 8px"
    : "28px 28px 8px";
}

/**
 * The copy html2canvas renders (desktop A4 layout): no toolbar, logos as
 * cover backgrounds (it ignores object-fit), and the places a sheet may
 * end: not through a small block, nor right after a heading.
 */
function prepare(
  doc: Document,
  el: HTMLElement,
  via: Map<string, string>,
  layout: Layout,
) {
  doc.getElementById("screen-toolbar")?.remove();
  fitForCanvas(doc, el);
  doc.querySelectorAll("img[data-initials]").forEach((img) => {
    const span = doc.createElement("span");
    const logo = via.get(img.getAttribute("src") ?? "");
    if (logo) {
      span.style.cssText = `display:block;width:100%;height:100%;background:url(${JSON.stringify(logo)}) center / cover no-repeat`;
    } else {
      span.textContent = img.getAttribute("data-initials");
    }
    span.className = img.className;
    img.replaceWith(span);
  });
  layout.box = el.getBoundingClientRect();
  layout.cuts = [];
  layout.blocks = [];
  layout.labels = [];
  const sheetH = sheetHeight(layout.box.width, el);
  el.querySelectorAll("*").forEach((n) => {
    const rect = n.getBoundingClientRect();
    const t = rect.top - layout.box.top;
    let b = rect.bottom - layout.box.top;
    if (b - t <= 0) return;
    layout.cuts.push(t, b);
    const label = n.getAttribute("data-sheet-label");
    if (label) layout.labels.push([t, label]);
    if (n.matches("h1, h2, h3, h4, header")) b += KEEP_WITH_NEXT;
    // `data-keep-whole`: a group taller than KEEP_WHOLE that must not be
    // cut (an innings' two columns), as long as it fits a sheet at all.
    const keep = b - t <= KEEP_WHOLE || n.hasAttribute("data-keep-whole");
    if (keep && b - t < sheetH) layout.blocks.push([t, b]);
  });
}

/** How much of a page one sheet holds, CSS px (less its header band). */
function sheetHeight(width: number, page: Element): number {
  const sheetH = (width * A4_H) / A4_W;
  return page.hasAttribute("data-running-header") ? sheetH - HEADER_PX : sheetH;
}

/**
 * Sheets of one page: [top, bottom] in CSS px, each at most `sheetH` high,
 * ending at the lowest clean cut in its lower half; failing that, at the
 * lowest clean cut higher up (a short sheet rather than a block cut
 * through, e.g. five overs that start just past the middle); else a sheet
 * high.
 */
function sheets(
  layout: Layout,
  height: number,
  sheetH: number,
): [number, number][] {
  const clean = (y: number) =>
    !layout.blocks.some(([t, b]) => t < y - 0.5 && b > y + 0.5);
  const out: [number, number][] = [];
  // Past the last content there is only padding: no sheet for that alone.
  const bottom = Math.min(height, Math.max(0, ...layout.cuts));
  let y = 0;
  while (bottom - y > 1) {
    let end = Math.min(bottom, y + sheetH);
    if (end < bottom) {
      const lowest = (from: number) =>
        layout.cuts.filter((c) => c > from && c <= end && clean(c));
      const fit = lowest(y + sheetH / 2);
      const any = fit.length ? fit : lowest(y + 24);
      if (any.length) end = Math.max(...any);
    }
    out.push([y, end]);
    y = end;
  }
  return out;
}

/** One A4 sheet, cut and ready for the PDF. */
type Sheet = {
  canvas: HTMLCanvasElement;
  /** The section it shows, when the page has a running header. */
  header: { label: string | null } | null;
};

/** The section a sheet starts in: the last label above its top. */
function labelAt(layout: Layout, top: number): string | null {
  let label: string | null = layout.labels[0]?.[1] ?? null;
  for (const [t, l] of layout.labels) if (t <= top + 4) label = l;
  return label;
}

function cutSheets(
  canvas: HTMLCanvasElement,
  layout: Layout,
  page: Element,
  background: string,
): Sheet[] {
  const k = canvas.width / layout.box.width;
  const header = page.hasAttribute("data-running-header");
  const band = header ? Math.round(HEADER_PX * k) : 0;
  const out: Sheet[] = [];
  const sheetH = sheetHeight(layout.box.width, page);
  for (const [top, bottom] of sheets(layout, canvas.height / k, sheetH)) {
    const y = Math.round(top * k);
    const h = Math.min(canvas.height, Math.round(bottom * k)) - y;
    if (h <= 0) continue;
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = band + h;
    const ctx = part.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, part.width, part.height);
    if (band && !/^(transparent|rgba\(.*,\s*0\))$/.test(background)) {
      // The band takes the page's own background, as the margin did.
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, part.width, band);
    }
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, band, canvas.width, h);
    out.push({
      canvas: part,
      header: header ? { label: labelAt(layout, top) } : null,
    });
  }
  return out;
}

/**
 * The running header on a sheet's band: the match on the left, the section
 * and "Page N of M" on the right, over a hairline, in the page's text face
 * (next/font may rename the family, so it is read, not named).
 */
function drawHeader(
  sheet: Sheet,
  heading: string,
  pageNo: number,
  pages: number,
  look: { font: string; muted: string; strong: string; line: string },
) {
  const ctx = sheet.canvas.getContext("2d");
  if (!ctx || !sheet.header) return;
  const k = sheet.canvas.width / SHEET_PX;
  const pad = 28 * k;
  const base = 28 * k;
  const right = [sheet.header.label, `Page ${pageNo} of ${pages}`]
    .filter(Boolean)
    .join(" · ");
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 ${11 * k}px ${look.font}`;
  ctx.fillStyle = look.muted;
  ctx.textAlign = "right";
  ctx.fillText(right, sheet.canvas.width - pad, base);
  const room = sheet.canvas.width - 2 * pad - ctx.measureText(right).width - 16 * k;
  ctx.textAlign = "left";
  ctx.font = `600 ${11 * k}px ${look.font}`;
  ctx.fillStyle = look.strong;
  let text = heading;
  while (text.length > 4 && ctx.measureText(text).width > room) {
    text = `${text.slice(0, -2).trimEnd()}…`;
  }
  ctx.fillText(text, pad, base);
  ctx.fillStyle = look.line;
  ctx.fillRect(pad, base + 7 * k, sheet.canvas.width - 2 * pad, Math.max(1, k));
}

/** The header's face and colours, from the report itself (always light). */
function headerLook(page: Element) {
  const css = getComputedStyle(page);
  const hsl = (name: string, fallback: string) => {
    const v = css.getPropertyValue(name).trim();
    return v ? `hsl(${v})` : fallback;
  };
  return {
    font: css.fontFamily || "sans-serif",
    muted: hsl("--muted-foreground", "#5f6275"),
    strong: hsl("--foreground", "#111433"),
    line: hsl("--border", "#e2e4ee"),
  };
}

/**
 * html2canvas finds each font's baseline with a 1 px GIF set inline; the
 * Tailwind reset makes images blocks, which puts every line of text a few
 * pixels low. Undone for that probe image while the PDF is drawn.
 */
function baselineProbeFix(): () => void {
  const style = document.createElement("style");
  style.textContent =
    'img[src^="data:image/gif"] { display: inline !important; }';
  document.head.appendChild(style);
  return () => style.remove();
}

/** The report as an A4 PDF file. */
export async function buildReportPdf(fileName: string): Promise<File> {
  for (const [src, integrity] of PDF_LIBS) await load(src, integrity);
  await document.fonts?.ready;
  const via = await proxyLogos();
  const w = window as ReportWindow;
  if (!w.html2canvas || !w.jspdf) throw new Error("PDF libraries missing");
  const undoProbeFix = baselineProbeFix();
  try {
    return await drawPdf(w, fileName, via);
  } finally {
    undoProbeFix();
  }
}

async function drawPdf(
  w: ReportWindow,
  fileName: string,
  via: Map<string, string>,
): Promise<File> {
  if (!w.html2canvas || !w.jspdf) throw new Error("PDF libraries missing");
  const pdf = new w.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
  const background = getComputedStyle(document.body).backgroundColor;
  const all: Sheet[] = [];
  let look: ReturnType<typeof headerLook> | null = null;
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>(".report-page"),
  )) {
    const layout: Layout = {
      box: el.getBoundingClientRect(),
      cuts: [],
      blocks: [],
      labels: [],
    };
    const canvas = await w.html2canvas(el, {
      scale: canvasScale(el.getBoundingClientRect()),
      useCORS: true,
      backgroundColor: background,
      logging: false,
      windowWidth: 1024,
      windowHeight: 1400,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc: Document, clone: HTMLElement) =>
        prepare(doc, clone, via, layout),
    });
    look ??= headerLook(el);
    all.push(...cutSheets(canvas, layout, el, background));
  }
  // The heading is read now, after the page has shown its dates in the
  // viewer's time zone (`LocalDate`).
  const heading =
    document.querySelector("[data-report-heading]")?.textContent?.trim() ?? "";
  all.forEach((sheet, i) => {
    if (sheet.header && look) drawHeader(sheet, heading, i + 1, all.length, look);
    if (i > 0) pdf.addPage();
    const px = sheet.canvas.width / A4_W;
    pdf.addImage(
      sheet.canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      A4_W,
      sheet.canvas.height / px,
    );
  });
  return new File([pdf.output("blob")], fileName, { type: "application/pdf" });
}

export { downloadFile } from "~/lib/share-match";
