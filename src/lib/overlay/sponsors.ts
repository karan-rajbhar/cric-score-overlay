/**
 * Sponsor logos of clubs and tournaments (`sponsors` array on the club /
 * tournament doc, files in Storage `sponsor-logos/{scope}/{id}/`). Admins
 * upload each logo once; every stream of their matches reuses them.
 *
 * {@link resolveMatchSponsors} picks a match's set (its tournament's, else
 * its club's, else its tournament's club's) for the control room to copy
 * into the overlay when a stream starts: 1 to 3 reads, never per ball.
 */

import type { DataSource } from "~/lib/firebase/datasource";
import { newId } from "~/lib/firebase/query-builder";
import { isClubAdmin } from "~/lib/firebase/rpc/auth-helpers";
import type {
  ClubsRow,
  MatchesRow,
  Sponsor,
  SponsorSlot,
  TournamentsRow,
} from "~/lib/firebase/types";
import { checkSponsorLogo } from "./sponsor-logo";

export type { Sponsor, SponsorSlot };

export type SponsorScope = "club" | "tournament";

export const SPONSOR_SLOTS: readonly SponsorSlot[] = [
  "corner",
  "break",
  "over_end",
];
export const MAX_SPONSORS = 24;
export const MAX_SPONSOR_NAME = 60;

/** Storage folder (public read, server writes; storage.rules). */
export const SPONSOR_LOGO_FOLDER = "sponsor-logos";
/** Each upload gets a new path, so caches may keep a logo for a year. */
export const SPONSOR_LOGO_CACHE = "public, max-age=31536000, immutable";

/** A refusal or bad input, with a message to show as is. */
export class SponsorError extends Error {}

/** Where logo files go; the server action binds it to Firebase Storage. */
export interface SponsorLogoStore {
  /** Saves the file and returns its public URL. */
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
  remove(paths: string[]): Promise<void>;
}

const TABLE: Record<SponsorScope, "clubs" | "tournaments"> = {
  club: "clubs",
  tournament: "tournaments",
};

export function isSponsorScope(value: unknown): value is SponsorScope {
  return value === "club" || value === "tournament";
}

export function cleanSponsorName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new SponsorError("Give the sponsor a name");
  if (name.length > MAX_SPONSOR_NAME) {
    throw new SponsorError(
      `Keep the name under ${MAX_SPONSOR_NAME} characters`,
    );
  }
  return name;
}

/** Known slots, each once, in the canonical order. */
export function cleanSlots(raw: unknown): SponsorSlot[] {
  const given = new Set(Array.isArray(raw) ? raw : []);
  return SPONSOR_SLOTS.filter((s) => given.has(s));
}

/** Club admins; for a tournament its creator or its club's admins. */
export async function canManageSponsors(
  ds: DataSource,
  scope: SponsorScope,
  scopeId: string,
  userId: string,
): Promise<boolean> {
  if (scope === "club") return isClubAdmin(ds, scopeId, userId);
  const t = (await ds.getById(
    "tournaments",
    scopeId,
  )) as unknown as TournamentsRow | null;
  if (!t) return false;
  return t.created_by === userId || isClubAdmin(ds, t.club_id, userId);
}

function sponsorsOf(doc: { sponsors?: Sponsor[] | null } | null): Sponsor[] {
  return Array.isArray(doc?.sponsors) ? doc.sponsors : [];
}

export async function listSponsors(
  ds: DataSource,
  scope: SponsorScope,
  scopeId: string,
): Promise<Sponsor[]> {
  const doc = (await ds.getById(TABLE[scope], scopeId)) as {
    sponsors?: Sponsor[] | null;
  } | null;
  if (!doc) throw new SponsorError("Not found");
  return sponsorsOf(doc);
}

async function save(
  ds: DataSource,
  scope: SponsorScope,
  scopeId: string,
  sponsors: Sponsor[],
): Promise<Sponsor[]> {
  await ds.update(TABLE[scope], scopeId, {
    sponsors,
    updated_at: new Date().toISOString(),
  });
  return sponsors;
}

/** The logo's possible paths (one per file type it may have). */
function logoPaths(scope: SponsorScope, scopeId: string, id: string): string[] {
  return ["png", "jpg", "webp", "svg"].map(
    (ext) => `${scope}/${scopeId}/${id}.${ext}`,
  );
}

/**
 * Checks and stores a new logo, then appends the sponsor. The caller has
 * checked {@link canManageSponsors}.
 */
export async function addSponsor(
  ds: DataSource,
  store: SponsorLogoStore,
  scope: SponsorScope,
  scopeId: string,
  input: { name: unknown; slots: unknown; bytes: Uint8Array },
): Promise<Sponsor[]> {
  const name = cleanSponsorName(input.name);
  const slots = cleanSlots(input.slots);
  const check = checkSponsorLogo(input.bytes);
  if (!check.ok) throw new SponsorError(check.error);
  const current = await listSponsors(ds, scope, scopeId);
  if (current.length >= MAX_SPONSORS) {
    throw new SponsorError(`There can be up to ${MAX_SPONSORS} sponsors`);
  }
  const id = newId();
  const url = await store.upload(
    `${scope}/${scopeId}/${id}.${check.ext}`,
    input.bytes,
    check.contentType,
  );
  return save(ds, scope, scopeId, [
    ...current,
    { id, name, logo_url: url, slots },
  ]);
}

/**
 * Renames, re-slots and reorders: `edits` lists every current sponsor id
 * once, in the new order. Logo URLs always come from the stored copy.
 */
export async function updateSponsors(
  ds: DataSource,
  scope: SponsorScope,
  scopeId: string,
  edits: { id: string; name: unknown; slots: unknown }[],
): Promise<Sponsor[]> {
  const current = await listSponsors(ds, scope, scopeId);
  const byId = new Map(current.map((s) => [s.id, s]));
  const ids = new Set(edits.map((e) => e.id));
  if (
    edits.length !== current.length ||
    ids.size !== edits.length ||
    edits.some((e) => !byId.has(e.id))
  ) {
    throw new SponsorError("The sponsors changed meanwhile. Reload and retry.");
  }
  return save(
    ds,
    scope,
    scopeId,
    edits.map((e) => ({
      ...byId.get(e.id)!,
      name: cleanSponsorName(e.name),
      slots: cleanSlots(e.slots),
    })),
  );
}

export async function removeSponsor(
  ds: DataSource,
  store: SponsorLogoStore,
  scope: SponsorScope,
  scopeId: string,
  sponsorId: string,
): Promise<Sponsor[]> {
  const current = await listSponsors(ds, scope, scopeId);
  if (!current.some((s) => s.id === sponsorId)) return current;
  const next = await save(
    ds,
    scope,
    scopeId,
    current.filter((s) => s.id !== sponsorId),
  );
  // The doc no longer points at it; a failed delete only leaves a file.
  await store.remove(logoPaths(scope, scopeId, sponsorId)).catch(() => {});
  return next;
}

export interface MatchSponsors {
  source: SponsorScope | null;
  sourceId: string | null;
  sponsors: Sponsor[];
}

/**
 * The sponsor set for a match: its tournament's when it has any, else its
 * club's, else its tournament's club's. Pass the match doc when it is
 * already loaded (saves a read).
 */
export async function resolveMatchSponsors(
  ds: DataSource,
  match:
    | string
    | Pick<MatchesRow, "id" | "club_id" | "tournament_id">
    | null,
): Promise<MatchSponsors> {
  const none: MatchSponsors = { source: null, sourceId: null, sponsors: [] };
  const m =
    typeof match === "string"
      ? ((await ds.getById("matches", match)) as unknown as MatchesRow | null)
      : match;
  if (!m) return none;

  let tournamentClub: string | null = null;
  if (m.tournament_id) {
    const t = (await ds.getById(
      "tournaments",
      m.tournament_id,
    )) as unknown as TournamentsRow | null;
    const list = sponsorsOf(t);
    if (list.length) {
      return { source: "tournament", sourceId: m.tournament_id, sponsors: list };
    }
    tournamentClub = t?.club_id ?? null;
  }
  const clubs = new Set(
    [m.club_id, tournamentClub].filter((id): id is string => Boolean(id)),
  );
  for (const clubId of clubs) {
    const club = (await ds.getById(
      "clubs",
      clubId,
    )) as unknown as ClubsRow | null;
    const list = sponsorsOf(club);
    if (list.length) return { source: "club", sourceId: clubId, sponsors: list };
  }
  return none;
}

/**
 * The overlay's sponsor items (`SET_SPONSORS` / `overlay_state.sponsors`),
 * optionally only those booked for one slot.
 */
export function overlaySponsorItems(
  sponsors: Sponsor[],
  slot?: SponsorSlot,
): { id: string; name: string; logoUrl: string }[] {
  return sponsors
    .filter((s) => !slot || s.slots.includes(slot))
    .map((s) => ({ id: s.id, name: s.name, logoUrl: s.logo_url }));
}
