/**
 * A player in a URL. The text says which it is, never its shape:
 *  - `@name`  is a username handle (stored lower case, so it is lower-cased);
 *  - anything else is a user id, used exactly as written.
 *
 * User ids have no single format (a UUID for players the app creates, a
 * 28-character mixed-case Firebase Auth uid for every Google sign-in, and
 * whatever a future provider issues), so an id is never validated by shape
 * or case-folded: it is looked up as is and a miss is a 404. A bare
 * `/players/karan` (the old handle form) is the one fallback: when no user
 * has that id, `legacyHandleOf` names the handle to redirect to.
 */
export type PlayerRef =
  | { kind: "handle"; handle: string }
  | { kind: "id"; id: string };

const HANDLE = /^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/;

export function parsePlayerRef(raw: string): PlayerRef | null {
  let text: string;
  try {
    text = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  if (text.startsWith("@")) {
    const handle = text.slice(1).toLowerCase();
    return HANDLE.test(handle) ? { kind: "handle", handle } : null;
  }
  // Firestore document ids cannot hold "/" and are at most 1500 bytes.
  return text && !text.includes("/") && text.length <= 128
    ? { kind: "id", id: text }
    : null;
}

/** The handle an id-shaped URL segment would mean, for the redirect fallback. */
export function legacyHandleOf(ref: PlayerRef): string | null {
  if (ref.kind !== "id") return null;
  const handle = ref.id.toLowerCase();
  return HANDLE.test(handle) ? handle : null;
}

/** The `users` column and value a reference is looked up by. */
export function playerLookup(ref: PlayerRef) {
  return ref.kind === "handle"
    ? ({ column: "username", value: ref.handle } as const)
    : ({ column: "id", value: ref.id } as const);
}

/** The canonical path of a player: the handle when known, else the id. */
export function playerPath(user: { id: string; username?: string | null }) {
  return `/players/${user.username ? `@${user.username}` : encodeURIComponent(user.id)}`;
}
