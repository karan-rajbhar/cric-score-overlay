/**
 * Checks on an uploaded image's bytes (never the type the browser
 * declares): PNG, JPEG, WebP or, where allowed, SVG. The stored file takes
 * its content type and extension from the result. SVGs are rejected, not
 * sanitised, when they could run script or load anything: script elements,
 * event handler attributes, `javascript:` links, embedded HTML / frames /
 * animation of attributes, DOCTYPE / entities, and any reference (href,
 * src, CSS url / @import) other than `#fragment` or an inline raster
 * `data:image`. Plain `<style>` rules are fine. Used for sponsor logos,
 * team and club logos and club banners.
 */

export type ImageUploadType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/svg+xml";

export type ImageUploadCheck =
  | { ok: true; contentType: ImageUploadType; ext: string }
  | { ok: false; error: string };

export interface ImageUploadRules {
  /** The largest file accepted, in bytes. */
  maxBytes: number;
  /** The refusal for a file over `maxBytes`. */
  tooLarge: string;
  /** Whether a script-free SVG is accepted (PNG, JPEG and WebP always are). */
  svg: boolean;
}

function startsWith(bytes: Uint8Array, sig: number[], at = 0): boolean {
  if (bytes.length < at + sig.length) return false;
  return sig.every((b, i) => bytes[at + i] === b);
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function rasterType(bytes: Uint8Array): ImageUploadCheck | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, contentType: "image/png", ext: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { ok: true, contentType: "image/jpeg", ext: "jpg" };
  }
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return { ok: true, contentType: "image/webp", ext: "webp" };
  }
  return null;
}

/** Element names that can run script, embed documents or rewrite links. */
const UNSAFE_ELEMENT =
  /<\s*(?:[\w-]+:)?(?:script|foreignObject|iframe|frame|embed|object|applet|audio|video|animate|animateMotion|animateTransform|set|handler|listener|base|meta|link)\b/i;
const EVENT_HANDLER = /[\s"'/;]on[a-z]+\s*=/i;
const DOCTYPE_OR_ENTITY = /<!\s*(?:DOCTYPE|ENTITY)/i;
const SCRIPT_URL = /(?:java|vb)script\s*:|data\s*:\s*text\/html/i;
/** href / xlink:href / src values other than #fragment or a raster data URI. */
const EXTERNAL_REF =
  /(?:href|src)\s*=\s*(["'])(?!\s*(?:#|data:image\/(?:png|jpeg|gif|webp);base64,))[^"']*\1/i;
/** url(...) in styles other than url(#fragment). */
const CSS_URL = /url\(\s*(?!["']?\s*#)/i;
const CSS_IMPORT = /@import/i;

const NOT_AN_IMAGE = "That file is not an image";

/** Null when `text` is a self-contained, script-free SVG. */
export function svgProblem(text: string): string | null {
  const head = text.replace(/^﻿/, "").trimStart();
  const opening =
    /^(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head);
  if (!opening) return NOT_AN_IMAGE;
  if (DOCTYPE_OR_ENTITY.test(text)) return "SVGs with a DOCTYPE are not allowed";
  if (UNSAFE_ELEMENT.test(text) || EVENT_HANDLER.test(text)) {
    return "SVGs with scripts or animation are not allowed";
  }
  if (SCRIPT_URL.test(text)) return "SVGs with script links are not allowed";
  if (EXTERNAL_REF.test(text) || CSS_URL.test(text) || CSS_IMPORT.test(text)) {
    return "SVGs must not load other files";
  }
  return null;
}

/** What the uploaded `bytes` are, or why they are refused. */
export function checkImageUpload(
  bytes: Uint8Array,
  rules: ImageUploadRules,
): ImageUploadCheck {
  if (bytes.length === 0) return { ok: false, error: "Choose an image file" };
  if (bytes.length > rules.maxBytes) return { ok: false, error: rules.tooLarge };
  const raster = rasterType(bytes);
  if (raster) return raster;

  const wrongType = rules.svg
    ? "Use a PNG, JPEG, WebP or SVG file"
    : "Use a PNG, JPEG or WebP file";
  if (!rules.svg) return { ok: false, error: wrongType };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: wrongType };
  }
  const problem = svgProblem(text);
  if (problem === NOT_AN_IMAGE) return { ok: false, error: wrongType };
  if (problem) return { ok: false, error: problem };
  return { ok: true, contentType: "image/svg+xml", ext: "svg" };
}

/** The bytes of an uploaded file, checked (`checkImageUpload`). */
export async function readImageUpload(
  file: Blob,
  rules: ImageUploadRules,
): Promise<{ bytes: Uint8Array; image: ImageUploadCheck }> {
  if (file.size > rules.maxBytes) {
    return { bytes: new Uint8Array(), image: { ok: false, error: rules.tooLarge } };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, image: checkImageUpload(bytes, rules) };
}
