/**
 * Server-only contact details: `users_private/{uid}` holds the email and
 * phone that used to sit on the public `users` profile. Rules deny all
 * client access, so only server code (Admin SDK data source) touches it.
 *
 * Emails are stored lower-cased; look-ups are exact matches (1 indexed
 * query), never substring searches.
 */

import type { DataSource } from "./datasource";
import type { UsersPrivateRow } from "./types";

export const USERS_PRIVATE = "users_private";

export function normaliseEmail(
  email: string | null | undefined,
): string | null {
  const clean = email?.trim().toLowerCase();
  return clean && clean.includes("@") ? clean : null;
}

export async function getUserPrivate(
  ds: DataSource,
  uid: string,
): Promise<UsersPrivateRow | null> {
  return (await ds.getById(
    USERS_PRIVATE,
    uid,
  )) as unknown as UsersPrivateRow | null;
}

/** Ids of the profiles registered with this email (normally 0 or 1). */
export async function userIdsByEmail(
  ds: DataSource,
  email: string | null | undefined,
): Promise<string[]> {
  const clean = normaliseEmail(email);
  if (!clean) return [];
  const rows = await ds.query(USERS_PRIVATE, [
    { field: "email", op: "==", value: clean },
  ]);
  return rows.map((r) => r.id);
}

/** Ids of the profiles registered with this phone number. */
export async function userIdsByPhone(
  ds: DataSource,
  phone: string | null | undefined,
): Promise<string[]> {
  if (!phone) return [];
  const rows = await ds.query(USERS_PRIVATE, [
    { field: "phone", op: "==", value: phone },
  ]);
  return rows.map((r) => r.id);
}

/**
 * Creates or updates `users_private/{uid}`. Writes only when a value
 * actually changes; `undefined` keeps the stored value. Pass `existing`
 * when it was already read to save the lookup.
 */
export async function upsertUserPrivate(
  ds: DataSource,
  uid: string,
  values: { email?: string | null; phone?: string | null },
  existing?: UsersPrivateRow | null,
): Promise<void> {
  const current =
    existing === undefined ? await getUserPrivate(ds, uid) : existing;
  const now = new Date().toISOString();
  const email =
    values.email === undefined ? undefined : normaliseEmail(values.email);
  if (!current) {
    await ds.insert(USERS_PRIVATE, [
      {
        id: uid,
        email: email ?? null,
        phone: values.phone ?? null,
        created_at: now,
        updated_at: now,
      },
    ]);
    return;
  }
  const patch: Record<string, unknown> = {};
  if (email !== undefined && email !== current.email) patch.email = email;
  if (values.phone !== undefined && values.phone !== current.phone) {
    patch.phone = values.phone;
  }
  if (Object.keys(patch).length === 0) return;
  await ds.update(USERS_PRIVATE, uid, { ...patch, updated_at: now });
}

/** Moves `users_private/{oldId}` to `{newId}` (profile re-map). */
export async function moveUserPrivate(
  ds: DataSource,
  oldId: string,
  newId: string,
): Promise<void> {
  if (oldId === newId) return;
  const old = await getUserPrivate(ds, oldId);
  if (!old) return;
  const copy: Record<string, unknown> = { ...old };
  delete copy.id;
  await ds.insert(USERS_PRIVATE, [{ ...copy, id: newId }]);
  await ds.delete(USERS_PRIVATE, oldId);
}
