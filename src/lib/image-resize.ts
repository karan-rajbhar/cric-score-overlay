/**
 * Downscales an image in the browser before it is uploaded, so a logo
 * shown at 32-96 px is not stored (and downloaded by every viewer) as a
 * multi-megabyte photo. The server's size and type checks stay as they are.
 *
 * - SVG (and any type it does not handle) is passed through untouched.
 * - An image already within the limit is passed through untouched.
 * - PNG and WebP keep their transparency (encoded as WebP, or PNG where the
 *   browser cannot encode WebP); JPEG stays JPEG.
 * - Anything that fails (a format the browser cannot decode, e.g. HEIC on
 *   some browsers) or comes out no smaller falls back to the original file.
 */

/** Longest side of a team or club logo (shown at 96 px at most). */
export const LOGO_MAX_PX = 512;
/** Longest side of a club banner (a full-width header). */
export const BANNER_MAX_PX = 1600;

const JPEG_QUALITY = 0.85;
const WEBP_QUALITY = 0.9;

export interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  close(): void;
}

/** Decoding and encoding, injectable for tests (jsdom has no canvas). */
export interface ImageCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encode(
    image: DecodedImage,
    width: number,
    height: number,
    type: string,
    quality: number,
  ): Promise<Blob | null>;
}

/** The size to scale to so the longest side is `max`, or null if it fits. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } | null {
  if (width <= max && height <= max) return null;
  const scale = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The type to encode `type` as, or null to leave such files alone. */
export function outputTypeOf(type: string): string | null {
  if (type === "image/jpeg") return "image/jpeg";
  // WebP keeps the alpha channel; browsers that cannot encode it return
  // PNG, which keeps it too.
  if (type === "image/png" || type === "image/webp") return "image/webp";
  return null;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function renamed(name: string, type: string): string {
  const ext = EXTENSIONS[type];
  if (!ext) return name;
  const base = name.replace(/\.[^./]+$/, "") || "image";
  return `${base}.${ext}`;
}

async function decodeInBrowser(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function encodeInBrowser(
  image: DecodedImage,
  width: number,
  height: number,
  type: string,
  quality: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image.source, 0, 0, width, height);
    return canvas.convertToBlob({ type, quality });
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image.source, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export const browserImageCodec: ImageCodec = {
  decode: decodeInBrowser,
  encode: encodeInBrowser,
};

/**
 * The encoded image as the file to upload, or null to keep `original`: no
 * output, a type it cannot name, transparency lost to JPEG, or no saving.
 */
function smallerFile(
  original: File,
  requested: string,
  blob: Blob | null,
): File | null {
  if (!blob) return null;
  // A browser without the requested encoder returns PNG instead.
  const type = blob.type || requested;
  const dropsAlpha = requested !== "image/jpeg" && type === "image/jpeg";
  if (!EXTENSIONS[type] || dropsAlpha || blob.size >= original.size) {
    return null;
  }
  return new File([blob], renamed(original.name, type), {
    type,
    lastModified: original.lastModified,
  });
}

/**
 * `file` scaled down so its longest side is at most `maxPx`, or `file`
 * itself when it is already small, not a raster type this handles, cannot
 * be decoded or would not get smaller.
 */
export async function resizeImageFile(
  file: File,
  maxPx: number,
  codec: ImageCodec = browserImageCodec,
): Promise<File> {
  const type = outputTypeOf(file.type);
  if (!type) return file;
  let image: DecodedImage | null = null;
  try {
    image = await codec.decode(file);
    const size = fitWithin(image.width, image.height, maxPx);
    if (!size) return file;
    const quality = type === "image/jpeg" ? JPEG_QUALITY : WEBP_QUALITY;
    const blob = await codec.encode(
      image,
      size.width,
      size.height,
      type,
      quality,
    );
    return smallerFile(file, type, blob) ?? file;
  } catch {
    return file;
  } finally {
    image?.close();
  }
}
