/**
 * Row predicates for the query builder. Equality, `in` and single-field
 * range filters are pushed to Firestore; everything else (ilike, or, neq,
 * is, contains) is evaluated here on the fetched documents. Every filter is
 * also re-checked here after the native fetch.
 */

export type Filter =
  | { type: "eq"; field: string; value: unknown }
  | { type: "neq"; field: string; value: unknown }
  | { type: "in"; field: string; values: unknown[] }
  | { type: "like"; field: string; pattern: string; caseInsensitive: boolean }
  | { type: "is"; field: string; value: null | boolean }
  | { type: "gt" | "gte" | "lt" | "lte"; field: string; value: unknown }
  | { type: "contains"; field: string; values: unknown[] }
  | { type: "or"; filters: Filter[] }
  | { type: "and"; filters: Filter[] }
  | { type: "not"; filter: Filter };

/** Loose equality: Firestore stores typed values but PostgREST filters arrive as strings. */
export function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  }
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function likeToRegex(pattern: string, caseInsensitive: boolean): RegExp {
  const escaped = pattern
    .split("")
    .map((ch) => {
      if (ch === "%") return "[\\s\\S]*";
      if (ch === "_") return "[\\s\\S]";
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(`^${escaped}$`, caseInsensitive ? "i" : "");
}

export function matchesFilter(
  doc: Record<string, unknown>,
  filter: Filter,
): boolean {
  switch (filter.type) {
    case "eq":
      return looseEquals(doc[filter.field], filter.value);
    case "neq":
      return !looseEquals(doc[filter.field], filter.value);
    case "in":
      return filter.values.some((v) => looseEquals(doc[filter.field], v));
    case "like": {
      const value = doc[filter.field];
      if (value === null || value === undefined) return false;
      return likeToRegex(filter.pattern, filter.caseInsensitive).test(
        String(value),
      );
    }
    case "is": {
      const value = doc[filter.field];
      if (filter.value === null) return value === null || value === undefined;
      return value === filter.value;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const value = doc[filter.field];
      if (value === null || value === undefined) return false;
      const c = compare(value, filter.value);
      if (filter.type === "gt") return c > 0;
      if (filter.type === "gte") return c >= 0;
      if (filter.type === "lt") return c < 0;
      return c <= 0;
    }
    case "contains": {
      const value = doc[filter.field];
      if (!Array.isArray(value)) return false;
      return filter.values.every((v) => value.some((x) => looseEquals(x, v)));
    }
    case "or":
      return filter.filters.some((f) => matchesFilter(doc, f));
    case "and":
      return filter.filters.every((f) => matchesFilter(doc, f));
    case "not":
      return !matchesFilter(doc, filter.filter);
  }
}

/** Coerce a PostgREST literal (`true`, `null`, `42`, `abc`) to a JS value. */
export function coerceLiteral(raw: string): unknown {
  const value = raw.trim();
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

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

function parseListLiteral(raw: string): unknown[] {
  const inner = raw.trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!inner.trim()) return [];
  return splitTopLevel(inner).map(coerceLiteral);
}

/**
 * Parses a single PostgREST condition such as `status.eq.live`,
 * `full_name.ilike.%karan%`, `id.in.(a,b)`, `and(a.eq.1,b.eq.2)`.
 */
export function parseCondition(raw: string): Filter {
  const text = raw.trim();
  const group = /^(and|or)\(([\s\S]*)\)$/.exec(text);
  if (group) {
    const [, kind, inner] = group;
    const filters = splitTopLevel(inner!).map(parseCondition);
    return kind === "and" ? { type: "and", filters } : { type: "or", filters };
  }

  const negated = text.startsWith("not.");
  const body = negated ? text.slice(4) : text;
  const firstDot = body.indexOf(".");
  const secondDot = body.indexOf(".", firstDot + 1);
  if (firstDot === -1 || secondDot === -1) {
    throw new Error(`Unsupported filter expression: "${raw}"`);
  }
  const field = body.slice(0, firstDot);
  const op = body.slice(firstDot + 1, secondDot);
  const valueRaw = body.slice(secondDot + 1);

  let filter: Filter;
  switch (op) {
    case "eq":
      filter = { type: "eq", field, value: coerceLiteral(valueRaw) };
      break;
    case "neq":
      filter = { type: "neq", field, value: coerceLiteral(valueRaw) };
      break;
    case "in":
      filter = { type: "in", field, values: parseListLiteral(valueRaw) };
      break;
    case "ilike":
      filter = {
        type: "like",
        field,
        pattern: valueRaw,
        caseInsensitive: true,
      };
      break;
    case "like":
      filter = {
        type: "like",
        field,
        pattern: valueRaw,
        caseInsensitive: false,
      };
      break;
    case "is":
      filter = {
        type: "is",
        field,
        value: coerceLiteral(valueRaw) as null | boolean,
      };
      break;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      filter = { type: op, field, value: coerceLiteral(valueRaw) };
      break;
    case "cs":
      filter = {
        type: "contains",
        field,
        values: parseListLiteral(
          valueRaw.replace(/^\{/, "(").replace(/\}$/, ")"),
        ),
      };
      break;
    default:
      throw new Error(`Unsupported filter operator "${op}" in "${raw}"`);
  }
  return negated ? { type: "not", filter } : filter;
}

/** Parses the argument of `.or("a.eq.1,b.eq.2")`. */
export function parseOrExpression(raw: string): Filter {
  const filters = splitTopLevel(raw).map(parseCondition);
  if (filters.length === 1) return filters[0]!;
  return { type: "or", filters };
}

export interface OrderSpec {
  field: string;
  ascending: boolean;
  nullsFirst: boolean;
}

/** Stable multi-key sort with Postgres null placement semantics. */
export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  orders: OrderSpec[],
): T[] {
  if (orders.length === 0) return rows;
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((a, b) => {
    for (const order of orders) {
      const av = a.row[order.field];
      const bv = b.row[order.field];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) continue;
      if (aNull) return order.nullsFirst ? -1 : 1;
      if (bNull) return order.nullsFirst ? 1 : -1;
      const c = compare(av, bv);
      if (c !== 0) return order.ascending ? c : -c;
    }
    return a.index - b.index;
  });
  return indexed.map((x) => x.row);
}
