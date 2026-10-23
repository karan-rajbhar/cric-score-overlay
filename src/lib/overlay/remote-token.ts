/**
 * Per-match producer tokens for Stream Deck / Bitfocus Companion
 * (`/api/overlay/remote/{token}/{action}`).
 *
 * A token is `{id}.{secret}`: `id` names its `producer_tokens/{id}` doc
 * (server-only), which keeps the match id and a SHA-256 hash of `secret`,
 * never the secret itself. The full token is shown once, when created.
 * Checking one costs 1 read; the hashes are compared in constant time.
 * A match has at most one token: creating a new one revokes the old.
 */

import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DataSource } from "~/lib/firebase/datasource";
import type { ProducerTokensRow } from "~/lib/firebase/types";

export const PRODUCER_TOKENS = "producer_tokens";

/** `{id}.{secret}`, both base64url: 12 + 1 + 43 characters. */
const TOKEN_PATTERN = /^([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{43})$/;

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** The token's public id, or null when it is not shaped like a token. */
export function tokenIdOf(token: string): string | null {
  return TOKEN_PATTERN.exec(token)?.[1] ?? null;
}

export interface RemoteTokenStatus {
  active: boolean;
  created_at: string | null;
}

async function tokensOf(
  ds: DataSource,
  matchId: string,
): Promise<ProducerTokensRow[]> {
  return (await ds.query(PRODUCER_TOKENS, [
    { field: "match_id", op: "==", value: matchId },
  ])) as unknown as ProducerTokensRow[];
}

/** Whether the match has a token (never the token or its hash). */
export async function remoteTokenStatus(
  ds: DataSource,
  matchId: string,
): Promise<RemoteTokenStatus> {
  const [latest] = (await tokensOf(ds, matchId)).sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
  return { active: Boolean(latest), created_at: latest?.created_at ?? null };
}

/** Revokes every token of the match. Returns how many it removed. */
export async function revokeRemoteTokens(
  ds: DataSource,
  matchId: string,
): Promise<number> {
  const tokens = await tokensOf(ds, matchId);
  for (const t of tokens) await ds.delete(PRODUCER_TOKENS, t.id);
  return tokens.length;
}

/**
 * Creates the match's token, revoking any earlier one, and returns it.
 * This is the only time the full token exists outside the caller's
 * Companion setup: show it once, store nothing but the hash.
 */
export async function createRemoteToken(
  ds: DataSource,
  matchId: string,
  createdBy: string,
): Promise<string> {
  await revokeRemoteTokens(ds, matchId);
  const id = randomBytes(9).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const row: ProducerTokensRow = {
    id,
    match_id: matchId,
    secret_hash: hashSecret(secret),
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };
  await ds.insert(PRODUCER_TOKENS, [{ ...row }]);
  return `${id}.${secret}`;
}

/**
 * The match a token controls, or null for a malformed, unknown or revoked
 * token (1 read when well-formed, none otherwise).
 */
export async function verifyRemoteToken(
  ds: DataSource,
  token: string,
): Promise<string | null> {
  const parts = TOKEN_PATTERN.exec(token);
  if (!parts) return null;
  const [, id, secret] = parts as unknown as [string, string, string];
  const row = (await ds.getById(
    PRODUCER_TOKENS,
    id,
  )) as unknown as ProducerTokensRow | null;
  if (!row || typeof row.secret_hash !== "string") return null;
  const expected = Buffer.from(row.secret_hash, "hex");
  const actual = Buffer.from(hashSecret(secret), "hex");
  if (expected.length !== actual.length) return null;
  return timingSafeEqual(expected, actual) ? row.match_id : null;
}
