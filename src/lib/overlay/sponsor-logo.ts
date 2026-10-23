/**
 * Sponsor logo checks, on the uploaded bytes (never the declared type):
 * PNG, JPEG, WebP or SVG, at most {@link MAX_SPONSOR_LOGO_BYTES}. SVGs are
 * rejected, not sanitised, when they could run script or load anything:
 * script elements, event handler attributes, `javascript:` links, embedded
 * HTML / frames / animation of attributes, DOCTYPE / entities, and any
 * reference (href, src, CSS url / @import) other than `#fragment` or an
 * inline raster `data:image`. Plain `<style>` rules are fine.
 */

/** 1 MB (decimal), which stays under the 1 MiB server action body limit. */
export const MAX_SPONSOR_LOGO_BYTES = 1_000_000;

export const SPONSOR_LOGO_ACCEPT =
  "image/png,image/jpeg,image/webp,image/svg+xml";

export type SponsorLogoType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/svg+xml";

export type SponsorLogoCheck =
  | { ok: true; contentType: SponsorLogoType; ext: string }
  | { ok: false; error: string };

function startsWith(bytes: Uint8Array, sig: number[], at = 0): boolean {
  if (bytes.length < at + sig.length) return false;
  return sig.every((b, i) => bytes[at + i] === b);
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function rasterType(bytes: Uint8Array): SponsorLogoCheck | null {
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

/** Null when `text` is a self-contained, script-free SVG. */
export function svgProblem(text: string): string | null {
  const head = text.replace(/^\uFEFF/, "").trimStart();
  const opening =
    /^(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head);
  if (!opening) return "That file is not an image";
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

export function checkSponsorLogo(bytes: Uint8Array): SponsorLogoCheck {
  if (bytes.length === 0) return { ok: false, error: "Choose a logo file" };
  if (bytes.length > MAX_SPONSOR_LOGO_BYTES) {
    return { ok: false, error: "Logos must be 1 MB or smaller" };
  }
  const raster = rasterType(bytes);
  if (raster) return raster;

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: "Use a PNG, JPEG, WebP or SVG file" };
  }
  const problem = svgProblem(text);
  if (problem === "That file is not an image") {
    return { ok: false, error: "Use a PNG, JPEG, WebP or SVG file" };
  }
  if (problem) return { ok: false, error: problem };
  return { ok: true, contentType: "image/svg+xml", ext: "svg" };
}
