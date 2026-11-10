/**
 * Sponsor logo checks, on the uploaded bytes (never the declared type):
 * PNG, JPEG, WebP or script-free SVG (`checkImageUpload`), at most
 * {@link MAX_SPONSOR_LOGO_BYTES}.
 */

import { checkImageUpload, type ImageUploadCheck } from "~/lib/image-upload";

/** 1 MB (decimal), which stays under the 1 MiB server action body limit. */
export const MAX_SPONSOR_LOGO_BYTES = 1_000_000;

export const SPONSOR_LOGO_ACCEPT =
  "image/png,image/jpeg,image/webp,image/svg+xml";

export function checkSponsorLogo(bytes: Uint8Array): ImageUploadCheck {
  if (bytes.length === 0) return { ok: false, error: "Choose a logo file" };
  return checkImageUpload(bytes, {
    maxBytes: MAX_SPONSOR_LOGO_BYTES,
    tooLarge: "Logos must be 1 MB or smaller",
    svg: true,
  });
}
