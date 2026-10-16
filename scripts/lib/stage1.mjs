/**
 * Schema stage 1, as a pure plan over plain documents so it can be unit
 * tested and reused by the seed data:
 *
 * 1. Contact details move from public `users` to server-only
 *    `users_private/{uid}` ({ email, phone }), and are removed from `users`.
 * 2. Every match gets `team1_snapshot` / `team2_snapshot`
 *    ({ id, name, short_name, logo_url }).
 * 3. `match_events` (written per ball, never read) is deleted.
 *
 * Idempotent: planning again after applying yields an empty plan.
 */

/** @typedef {{ id: string } & Record<string, any>} Doc */
/** @typedef {{ id: string, name: string, short_name: string | null, logo_url: string | null }} TeamSnapshot */
/**
 * @typedef {object} Stage1Plan
 * @property {Array<{ id: string, data: Record<string, any> }>} privateWrites
 *   `users_private/{id}` documents to write (merge).
 * @property {string[]} userStrips users whose `email` / `phone` fields to delete.
 * @property {Array<{ id: string, patch: Record<string, TeamSnapshot> }>} matchSnapshots
 * @property {string[]} eventDeletes `match_events` ids to delete.
 */

export const PRIVATE_FIELDS = /** @type {const} */ (["email", "phone"]);

/**
 * @param {Doc} team
 * @returns {TeamSnapshot}
 */
export function teamSnapshot(team) {
  return {
    id: team.id,
    name: team.name,
    short_name: team.short_name ?? null,
    logo_url: team.logo_url ?? null,
  };
}

/**
 * @param {TeamSnapshot | null | undefined} a
 * @param {TeamSnapshot} b
 */
function sameSnapshot(a, b) {
  return (
    !!a &&
    a.id === b.id &&
    a.name === b.name &&
    (a.short_name ?? null) === b.short_name &&
    (a.logo_url ?? null) === b.logo_url
  );
}

/** @param {unknown} email */
function cleanEmail(email) {
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : null;
}

/**
 * @param {{ users: Doc[], usersPrivate: Doc[], teams: Doc[], matches: Doc[], matchEvents: Doc[] }} input
 * @param {{ keepUserFields?: boolean, now?: string }} [options]
 *   `keepUserFields` copies contact details without removing them from
 *   `users` (safe to run before deploying the code that reads users_private).
 * @returns {Stage1Plan}
 */
export function planStage1(input, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const privateById = new Map(input.usersPrivate.map((d) => [d.id, d]));

  /** @type {Stage1Plan} */
  const plan = {
    privateWrites: [],
    userStrips: [],
    matchSnapshots: [],
    eventDeletes: [],
  };

  for (const user of input.users) {
    const hasFields = PRIVATE_FIELDS.some((f) => f in user);
    if (!hasFields) continue;
    const existing = privateById.get(user.id);
    // users_private written by the new code wins: it is the fresher copy.
    const email = cleanEmail(existing?.email) ?? cleanEmail(user.email);
    const phone = existing?.phone ?? user.phone ?? null;
    if (
      !existing ||
      (existing.email ?? null) !== email ||
      (existing.phone ?? null) !== phone
    ) {
      plan.privateWrites.push({
        id: user.id,
        data: {
          email,
          phone,
          created_at: existing?.created_at ?? user.created_at ?? now,
          updated_at: now,
        },
      });
    }
    if (!options.keepUserFields) plan.userStrips.push(user.id);
  }

  const teamsById = new Map(input.teams.map((t) => [t.id, teamSnapshot(t)]));
  for (const match of input.matches) {
    /** @type {Record<string, TeamSnapshot>} */
    const patch = {};
    for (const side of /** @type {const} */ (["team1", "team2"])) {
      const snap = teamsById.get(match[`${side}_id`]);
      if (snap && !sameSnapshot(match[`${side}_snapshot`], snap)) {
        patch[`${side}_snapshot`] = snap;
      }
    }
    if (Object.keys(patch).length)
      plan.matchSnapshots.push({ id: match.id, patch });
  }

  plan.eventDeletes = input.matchEvents.map((e) => e.id);
  return plan;
}

/** @param {Stage1Plan} plan */
export function planWrites(plan) {
  return (
    plan.privateWrites.length +
    plan.userStrips.length +
    plan.matchSnapshots.length +
    plan.eventDeletes.length
  );
}

/**
 * Applies a plan to in-memory collections ({ users: Doc[], ... }), returning
 * new collections. Used for the seed data and tests.
 *
 * @param {Record<string, Doc[]>} data
 * @param {Stage1Plan} plan
 * @returns {Record<string, Doc[]>}
 */
export function applyStage1(data, plan) {
  /** @type {Record<string, Doc[]>} */
  const out = {};
  for (const [name, docs] of Object.entries(data)) {
    out[name] = docs.map((d) => ({ ...d }));
  }

  const priv = new Map((out.users_private ?? []).map((d) => [d.id, d]));
  for (const w of plan.privateWrites) {
    priv.set(w.id, { ...(priv.get(w.id) ?? {}), ...w.data, id: w.id });
  }
  out.users_private = Array.from(priv.values());

  const strip = new Set(plan.userStrips);
  out.users = (out.users ?? []).map((u) => {
    if (!strip.has(u.id)) return u;
    const copy = { ...u };
    for (const f of PRIVATE_FIELDS) delete copy[f];
    return copy;
  });

  const patches = new Map(plan.matchSnapshots.map((m) => [m.id, m.patch]));
  out.matches = (out.matches ?? []).map((m) =>
    patches.has(m.id) ? { ...m, ...patches.get(m.id) } : m,
  );

  const dropped = new Set(plan.eventDeletes);
  const remaining = (out.match_events ?? []).filter((e) => !dropped.has(e.id));
  if (remaining.length) out.match_events = remaining;
  else delete out.match_events;
  return out;
}
