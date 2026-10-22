/**
 * Firebase Storage facade (server only).
 *
 * The former Supabase buckets (`team-logos`, `club-assets`) become folders
 * inside the project's default bucket. Files are served through tokenised
 * download URLs, which work identically against the Storage emulator.
 */

import "server-only";
import { getAdminStorage } from "./admin";
import {
  EMULATOR_PORTS,
  firebaseEmulatorHost,
  firebaseStorageBucket,
  useFirebaseEmulators,
} from "./config";

export interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
  cacheControl?: string;
  /**
   * The file never changes once written (a fresh path and download token
   * per upload, e.g. logos): browsers and the Storage CDN keep it for a
   * year instead of revalidating it every hour.
   */
  immutable?: boolean;
}

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface StorageError {
  message: string;
}

function objectPath(folder: string, path: string): string {
  return `${folder}/${path.replace(/^\/+/, "")}`;
}

export function publicDownloadUrl(fullPath: string, token: string): string {
  const encoded = encodeURIComponent(fullPath);
  if (useFirebaseEmulators) {
    return `http://${firebaseEmulatorHost}:${EMULATOR_PORTS.storage}/v0/b/${firebaseStorageBucket}/o/${encoded}?alt=media&token=${token}`;
  }
  return `https://firebasestorage.googleapis.com/v0/b/${firebaseStorageBucket}/o/${encoded}?alt=media&token=${token}`;
}

export class StorageFolder {
  private tokens = new Map<string, string>();

  constructor(private readonly folder: string) {}

  async upload(
    path: string,
    body: File | Blob | ArrayBuffer | Uint8Array | Buffer,
    options?: UploadOptions,
  ): Promise<{
    data: { path: string; fullPath: string } | null;
    error: StorageError | null;
  }> {
    try {
      const fullPath = objectPath(this.folder, path);
      const bucket = getAdminStorage().bucket(firebaseStorageBucket);
      const file = bucket.file(fullPath);
      if (!options?.upsert) {
        const [exists] = await file.exists();
        if (exists) {
          return {
            data: null,
            error: { message: "The resource already exists" },
          };
        }
      }
      const buffer = await toBuffer(body);
      const token = crypto.randomUUID();
      const contentType =
        options?.contentType ??
        (typeof body === "object" &&
        "type" in body &&
        typeof body.type === "string" &&
        body.type
          ? body.type
          : "application/octet-stream");
      await file.save(buffer, {
        resumable: false,
        contentType,
        metadata: {
          contentType,
          cacheControl:
            options?.cacheControl ??
            (options?.immutable
              ? IMMUTABLE_CACHE_CONTROL
              : "public, max-age=3600"),
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      this.tokens.set(fullPath, token);
      return { data: { path, fullPath }, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : "Upload failed",
        },
      };
    }
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    const fullPath = objectPath(this.folder, path);
    const token = this.tokens.get(fullPath) ?? "";
    return { data: { publicUrl: publicDownloadUrl(fullPath, token) } };
  }

  async remove(
    paths: string[],
  ): Promise<{ data: string[] | null; error: StorageError | null }> {
    try {
      const bucket = getAdminStorage().bucket(firebaseStorageBucket);
      await Promise.all(
        paths.map((p) =>
          bucket
            .file(objectPath(this.folder, p))
            .delete({ ignoreNotFound: true }),
        ),
      );
      return { data: paths, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : "Delete failed",
        },
      };
    }
  }
}

async function toBuffer(
  body: File | Blob | ArrayBuffer | Uint8Array | Buffer,
): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  return Buffer.from(await body.arrayBuffer());
}

export const storage = {
  from(folder: string): StorageFolder {
    return new StorageFolder(folder);
  },
};
