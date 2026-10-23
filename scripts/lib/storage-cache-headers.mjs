/**
 * Which stored uploads still lack the year-long immutable Cache-Control
 * (scripts/migrate-storage-cache-headers.mjs; tested in
 * src/lib/firebase/storage-cache-headers.test.ts).
 *
 * Logos and banners are written once, each under a fresh path with a fresh
 * download token (`src/lib/firebase/storage.ts`, `immutable: true`), so the
 * file behind a URL never changes and browsers / the Storage CDN may keep
 * it for a year. Files uploaded before carry the old one-hour header.
 *
 * Idempotent: once applied, planning again finds nothing.
 */

/** Same value as `src/lib/firebase/storage.ts` sets on new uploads. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** The folders of write-once uploads (team logos; club logos and banners). */
export const IMMUTABLE_PREFIXES = /** @type {const} */ ([
  "team-logos/",
  "club-assets/",
]);

/**
 * Names of the files under {@link IMMUTABLE_PREFIXES} whose Cache-Control
 * is not yet the immutable one (folder placeholders are skipped).
 * @param {Array<{ name: string, cacheControl?: string | null }>} files
 * @returns {string[]}
 */
export function filesNeedingCacheControl(files) {
  return files
    .filter(
      (f) =>
        IMMUTABLE_PREFIXES.some((p) => f.name.startsWith(p)) &&
        !f.name.endsWith("/") &&
        f.cacheControl !== IMMUTABLE_CACHE_CONTROL,
    )
    .map((f) => f.name);
}

/**
 * Bucket names to try for a project, most likely first: the configured one
 * when it belongs to this project, then the two Firebase defaults (new
 * projects get `<id>.firebasestorage.app`, older ones `<id>.appspot.com`).
 * @param {string} projectId
 * @param {string | undefined} configured
 * @returns {string[]}
 */
export function bucketCandidates(projectId, configured) {
  const names = [];
  if (configured && configured.startsWith(`${projectId}.`)) {
    names.push(configured);
  }
  names.push(`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`);
  return [...new Set(names)];
}
