#!/usr/bin/env node
/**
 * Idempotent migration: uploaded logos and banners (`team-logos/`,
 * `club-assets/`) stored before uploads set a year-long immutable
 * Cache-Control get it too, so browsers and the Storage CDN stop
 * revalidating them every hour. See scripts/lib/storage-cache-headers.mjs.
 *
 *   node scripts/migrate-storage-cache-headers.mjs                 # local emulator (default)
 *   node scripts/migrate-storage-cache-headers.mjs --dry-run       # print counts only
 *   node scripts/migrate-storage-cache-headers.mjs --project=<id>  # real project, using the
 *                                                                  # service account in .env.local
 *   ... --bucket=<name>                                            # a bucket other than the defaults
 *
 * Only the objects' Cache-Control metadata changes (a metadata patch: the
 * content, content type and download tokens stay as they are). Safe while
 * the app runs: new uploads go to new paths. Re-running is safe: a second
 * run finds nothing to change. The service account needs to list and
 * update objects in the bucket (e.g. Storage Object Admin).
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import {
  IMMUTABLE_CACHE_CONTROL,
  IMMUTABLE_PREFIXES,
  bucketCandidates,
  filesNeedingCacheControl,
} from "./lib/storage-cache-headers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
/** @param {string} name */
const flag = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length);
const remoteProject = flag("project");
const bucketFlag = flag("bucket");

const PROJECT_ID =
  remoteProject ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "demo-cricscore";
const HOST = process.env.FIREBASE_EMULATOR_HOST_SERVER || "127.0.0.1";

if (!remoteProject) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= `${HOST}:9199`;
}

function remoteCredential() {
  try {
    process.loadEnvFile(resolve(here, "../.env.local"));
  } catch {
    // Fall back to whatever is already in the environment.
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not set in .env.local.");
    process.exit(1);
  }
  const account = JSON.parse(
    raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
  );
  if (account.project_id !== remoteProject) {
    console.error(
      `The service account in .env.local belongs to "${account.project_id}", not "${remoteProject}".`,
    );
    process.exit(1);
  }
  return cert(account);
}

/**
 * The first candidate bucket that exists, or null.
 * @param {import("firebase-admin/storage").Storage} storage
 */
async function findBucket(storage) {
  const names = bucketFlag
    ? [bucketFlag]
    : bucketCandidates(
        PROJECT_ID,
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      );
  for (const name of names) {
    try {
      const bucket = storage.bucket(name);
      const [exists] = await bucket.exists();
      if (exists) return bucket;
    } catch (err) {
      console.warn(
        `Bucket ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  console.log(`No bucket found among: ${names.join(", ")}`);
  return null;
}

/**
 * The files under the write-once folders, by name.
 * @param {import("@google-cloud/storage").Bucket} bucket
 */
async function listUploads(bucket) {
  /** @type {Map<string, import("@google-cloud/storage").File>} */
  const files = new Map();
  for (const prefix of IMMUTABLE_PREFIXES) {
    const [listed] = await bucket.getFiles({ prefix });
    for (const file of listed) files.set(file.name, file);
  }
  return files;
}

async function main() {
  if (remoteProject) {
    initializeApp({ projectId: PROJECT_ID, credential: remoteCredential() });
  } else {
    initializeApp({ projectId: PROJECT_ID });
  }
  const target = remoteProject
    ? `project ${PROJECT_ID}`
    : `emulator ${process.env.FIREBASE_STORAGE_EMULATOR_HOST} (${PROJECT_ID})`;
  console.log(
    `Storage Cache-Control migration on ${target}${dryRun ? " [dry run]" : ""}`,
  );

  const bucket = await findBucket(getStorage());
  if (!bucket) {
    // A real project must not be recorded as migrated by mistake.
    if (remoteProject) process.exit(1);
    console.log("Nothing to do (no Storage emulator bucket).");
    return;
  }

  const files = await listUploads(bucket);
  const pending = filesNeedingCacheControl(
    [...files.values()].map((f) => ({
      name: f.name,
      cacheControl: f.metadata.cacheControl ?? null,
    })),
  );
  console.log(`
Bucket ${bucket.name}: ${files.size} files under ${IMMUTABLE_PREFIXES.join(", ")}
Plan   ${pending.length} to set to "${IMMUTABLE_CACHE_CONTROL}"`);

  if (dryRun) return;
  if (!pending.length) {
    console.log("\nNothing to do.");
    return;
  }

  console.log("\nApplying…");
  let done = 0;
  for (let i = 0; i < pending.length; i += 20) {
    await Promise.all(
      pending.slice(i, i + 20).map(async (name) => {
        // A metadata patch: content and download tokens are untouched.
        await files.get(name)?.setMetadata({
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        });
        done += 1;
      }),
    );
  }
  console.log(
    `Done (${done} updated). Re-run with --dry-run to confirm nothing is left.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
