"use server";

import { createServerClient } from "~/lib/firebase/server";
import { serverDataSource } from "~/lib/firebase/server-ds";
import { MAX_SPONSOR_LOGO_BYTES } from "~/lib/overlay/sponsor-logo";
import {
  addSponsor,
  canManageSponsors,
  isSponsorScope,
  listSponsors,
  removeSponsor,
  resolveMatchSponsors,
  SPONSOR_LOGO_CACHE,
  SPONSOR_LOGO_FOLDER,
  SponsorError,
  updateSponsors,
  type MatchSponsors,
  type Sponsor,
  type SponsorLogoStore,
  type SponsorScope,
} from "~/lib/overlay/sponsors";

/**
 * Sponsor logos of a club or tournament (`~/lib/overlay/sponsors`):
 * uploaded through the server (Admin SDK, checked bytes) into the public
 * `sponsor-logos/` Storage folder, managed by club / tournament admins.
 */

type Db = Awaited<ReturnType<typeof createServerClient>>;
type Result<T> = { data: T; error: null } | { data: null; error: string };

function logoStore(db: Db): SponsorLogoStore {
  // One folder instance: its public URL needs the upload's token.
  const folder = db.storage.from(SPONSOR_LOGO_FOLDER);
  return {
    async upload(path, bytes, contentType) {
      const { error } = await folder.upload(path, bytes, {
        contentType,
        cacheControl: SPONSOR_LOGO_CACHE,
        upsert: true,
      });
      if (error) {
        console.error("Sponsor logo upload failed:", error.message);
        throw new SponsorError("Could not upload the logo");
      }
      return folder.getPublicUrl(path).data.publicUrl;
    },
    async remove(paths) {
      await folder.remove(paths);
    },
  };
}

async function asAdmin<T>(
  scope: unknown,
  scopeId: unknown,
  work: (ctx: {
    db: Db;
    scope: SponsorScope;
    scopeId: string;
  }) => Promise<T>,
): Promise<Result<T>> {
  try {
    if (!isSponsorScope(scope) || typeof scopeId !== "string" || !scopeId) {
      return { data: null, error: "Not found" };
    }
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { data: null, error: "You must be logged in" };
    if (!(await canManageSponsors(serverDataSource(), scope, scopeId, user.id))) {
      return {
        data: null,
        error:
          scope === "club"
            ? "Only club admins can manage sponsors"
            : "Only the tournament's organisers can manage sponsors",
      };
    }
    return { data: await work({ db, scope, scopeId }), error: null };
  } catch (err) {
    if (err instanceof SponsorError) return { data: null, error: err.message };
    console.error("sponsor action failed:", err);
    return { data: null, error: "Something went wrong" };
  }
}

export async function getSponsorLogos(
  scope: SponsorScope,
  scopeId: string,
): Promise<Result<Sponsor[]>> {
  return asAdmin(scope, scopeId, (c) =>
    listSponsors(serverDataSource(), c.scope, c.scopeId),
  );
}

/**
 * Form fields: `scope`, `scopeId`, `name`, `slots` (repeated), `file`.
 * Returns the updated list.
 */
export async function uploadSponsorLogo(
  form: FormData,
): Promise<Result<Sponsor[]>> {
  return asAdmin(form.get("scope"), form.get("scopeId"), async (c) => {
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      throw new SponsorError("Choose a logo file");
    }
    if (file.size > MAX_SPONSOR_LOGO_BYTES) {
      throw new SponsorError("Logos must be 1 MB or smaller");
    }
    return addSponsor(serverDataSource(), logoStore(c.db), c.scope, c.scopeId, {
      name: form.get("name"),
      slots: form.getAll("slots"),
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  });
}

/** Rename, change slots, reorder: every sponsor once, in the new order. */
export async function saveSponsorLogos(
  scope: SponsorScope,
  scopeId: string,
  edits: { id: string; name: string; slots: string[] }[],
): Promise<Result<Sponsor[]>> {
  return asAdmin(scope, scopeId, (c) =>
    updateSponsors(
      serverDataSource(),
      c.scope,
      c.scopeId,
      Array.isArray(edits) ? edits : [],
    ),
  );
}

export async function deleteSponsorLogo(
  scope: SponsorScope,
  scopeId: string,
  sponsorId: string,
): Promise<Result<Sponsor[]>> {
  return asAdmin(scope, scopeId, (c) =>
    removeSponsor(
      serverDataSource(),
      logoStore(c.db),
      c.scope,
      c.scopeId,
      sponsorId,
    ),
  );
}

/**
 * A match's sponsor set (tournament first, else club), for the control
 * room to copy into the overlay when a stream starts. Public data.
 */
export async function getMatchSponsors(
  matchId: string,
): Promise<MatchSponsors> {
  if (typeof matchId !== "string" || !/^[\w-]{1,128}$/.test(matchId)) {
    return { source: null, sourceId: null, sponsors: [] };
  }
  return resolveMatchSponsors(serverDataSource(), matchId);
}
