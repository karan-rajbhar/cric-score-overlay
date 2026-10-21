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

/** Where a sheet may end, measured on the copy html2canvas renders. */
type Layout = { box: DOMRect; cuts: number[]; blocks: [number, number][] };

/** The page's width in the PDF copy (CSS px, margin included). */
const SHEET_PX = 820;

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
  el.style.padding = "28px 28px 8px";
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
  el.querySelectorAll("*").forEach((n) => {
    const rect = n.getBoundingClientRect();
    const t = rect.top - layout.box.top;
    let b = rect.bottom - layout.box.top;
    if (b - t <= 0) return;
    layout.cuts.push(t, b);
    if (n.matches("h1, h2, h3, h4, header")) b += KEEP_WITH_NEXT;
    if (b - t <= KEEP_WHOLE) layout.blocks.push([t, b]);
  });
}

/**
 * Sheets of one page: [top, bottom] in CSS px, each at most an A4 high,
 * ending at the lowest clean cut in its lower half (else a sheet high).
 */
function sheets(layout: Layout, height: number): [number, number][] {
  const clean = (y: number) =>
    !layout.blocks.some(([t, b]) => t < y - 0.5 && b > y + 0.5);
  const sheetH = (layout.box.width * A4_H) / A4_W;
  const out: [number, number][] = [];
  let y = 0;
  while (height - y > 1) {
    let end = Math.min(height, y + sheetH);
    if (end < height) {
      const from = y + sheetH / 2;
      const fit = layout.cuts.filter((c) => c > from && c <= end && clean(c));
      if (fit.length) end = Math.max(...fit);
    }
    out.push([y, end]);
    y = end;
  }
  return out;
}

function addSheets(
  pdf: JsPdf,
  canvas: HTMLCanvasElement,
  layout: Layout,
  first: { value: boolean },
) {
  const k = canvas.width / layout.box.width;
  const px = canvas.width / A4_W;
  for (const [top, bottom] of sheets(layout, canvas.height / k)) {
    const y = Math.round(top * k);
    const h = Math.min(canvas.height, Math.round(bottom * k)) - y;
    if (h <= 0) continue;
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = h;
    const ctx = part.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, part.width, h);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (!first.value) pdf.addPage();
    first.value = false;
    pdf.addImage(
      part.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      A4_W,
      h / px,
    );
  }
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
  const first = { value: true };
  const background = getComputedStyle(document.body).backgroundColor;
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>(".report-page"),
  )) {
    const layout: Layout = {
      box: el.getBoundingClientRect(),
      cuts: [],
      blocks: [],
    };
    const canvas = await w.html2canvas(el, {
      scale: 2,
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
    addSheets(pdf, canvas, layout, first);
  }
  return new File([pdf.output("blob")], fileName, { type: "application/pdf" });
}

export { downloadFile } from "~/lib/share-match";
