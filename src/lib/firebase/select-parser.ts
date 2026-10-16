/**
 * Parses PostgREST-style select strings such as
 *
 *   "*, team1:teams!matches_team1_id_fkey(id, name), innings(id, total_runs)"
 *   "id, name, _count:team_players(count)"
 *
 * into a tree the query builder can resolve against Firestore.
 */

export interface RelationSpec {
  /** Key the embedded data is attached under. */
  alias: string;
  /** Target collection name. */
  target: string;
  /** Optional foreign-key hint, e.g. `matches_team1_id_fkey`. */
  hint: string | null;
  /** Columns / nested relations to return for the related rows. */
  selection: Selection;
  /** True for `relation(count)`. */
  countOnly: boolean;
}

export interface Selection {
  /** True when `*` was requested (all columns). */
  star: boolean;
  /** Explicit column names (ignored when `star` is true). */
  columns: string[];
  relations: RelationSpec[];
}

export const STAR_SELECTION: Selection = {
  star: true,
  columns: [],
  relations: [],
};

/** Splits on commas that are not nested inside parentheses. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const ITEM_RE =
  /^(?:([A-Za-z_][\w]*)\s*:\s*)?([A-Za-z_][\w]*)(?:!([\w]+))?\s*(?:\(([\s\S]*)\))?$/;

export function parseSelect(input: string | undefined | null): Selection {
  const raw = (input ?? "*").replace(/\s+/g, " ").trim();
  if (!raw || raw === "*") return STAR_SELECTION;

  const selection: Selection = { star: false, columns: [], relations: [] };

  for (const item of splitTopLevel(raw)) {
    if (item === "*") {
      selection.star = true;
      continue;
    }
    const match = ITEM_RE.exec(item);
    if (!match) {
      throw new Error(`Unsupported select fragment: "${item}"`);
    }
    const [, alias, name, hint, inner] = match;
    if (inner === undefined) {
      selection.columns.push(name!);
      continue;
    }
    const innerTrimmed = inner.trim();
    const countOnly = innerTrimmed === "count";
    selection.relations.push({
      alias: alias ?? name!,
      target: name!,
      hint: hint ?? null,
      selection: countOnly
        ? { star: false, columns: [], relations: [] }
        : parseSelect(innerTrimmed || "*"),
      countOnly,
    });
  }

  return selection;
}
