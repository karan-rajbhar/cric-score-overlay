/**
 * Resolves embedded-resource relations (`team1:teams!matches_team1_id_fkey`,
 * `innings(...)`, `user:users(...)`) to a join strategy.
 *
 * Postgres had foreign keys to infer joins; here we derive the same answer
 * from the foreign-key hint when present, otherwise from `<singular>_id`
 * column conventions.
 */

import { SINGULAR, TABLE_COLUMNS, hasColumn, isTableName } from "./schema";
import type { TableName } from "./types";

export type RelationStrategy =
  | { kind: "many-to-one"; localField: string }
  | { kind: "one-to-many"; foreignField: string };

export function resolveRelation(
  source: string,
  target: string,
  hint: string | null,
): RelationStrategy | null {
  if (!isTableName(source) || !isTableName(target)) return null;

  if (hint) {
    const local = new RegExp(`^${source}_(.+)_fkey$`).exec(hint);
    if (local && hasColumn(source, local[1]!)) {
      return { kind: "many-to-one", localField: local[1]! };
    }
    const foreign = new RegExp(`^${target}_(.+)_fkey$`).exec(hint);
    if (foreign && hasColumn(target, foreign[1]!)) {
      return { kind: "one-to-many", foreignField: foreign[1]! };
    }
  }

  const localCandidate = `${SINGULAR[target as TableName]}_id`;
  if (hasColumn(source, localCandidate)) {
    return { kind: "many-to-one", localField: localCandidate };
  }

  const foreignCandidate = `${SINGULAR[source as TableName]}_id`;
  if (hasColumn(target, foreignCandidate)) {
    return { kind: "one-to-many", foreignField: foreignCandidate };
  }

  return null;
}

/** Column to sort embedded one-to-many rows by, for deterministic output. */
export function defaultChildOrder(target: string): string[] {
  const columns = isTableName(target) ? TABLE_COLUMNS[target] : [];
  const preferred = [
    "innings_number",
    "batting_position",
    "batting_order",
    "seq",
    "wicket_number",
    "created_at",
    "joined_at",
  ];
  return preferred.filter((c) => columns.includes(c));
}
