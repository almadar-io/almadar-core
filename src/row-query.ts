/**
 * The one TypeScript definition of `RowPredicate` / `RowQuery` semantics. Every store that runs a
 * query in process (the memory adapter, the IndexedDB cursor pass, test oracles) goes through here;
 * stores that translate the query (SQL, Mango, Firestore) are tested against the same shared cases.
 */
import { z } from 'zod';
import { EntityRowSchema, FieldValueSchema, type EntityRow, type FieldValue } from './types/entity.js';
import type { QueryCapabilities, RowOrder, RowPredicate, RowQuery, RowQueryPage } from './service-types.js';

const CompareOpSchema = z.enum(['==', '!=', '<', '<=', '>', '>=']);

export const RowPredicateSchema: z.ZodType<RowPredicate> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('compare'), field: z.string(), op: CompareOpSchema, value: FieldValueSchema }),
    z.object({ kind: z.literal('member'), field: z.string(), values: z.array(FieldValueSchema) }),
    z.object({ kind: z.literal('hasElement'), field: z.string(), value: FieldValueSchema }),
    z.object({ kind: z.literal('contains'), field: z.string(), text: z.string(), caseSensitive: z.boolean() }),
    z.object({ kind: z.literal('isNull'), field: z.string(), isNull: z.boolean() }),
    z.object({ kind: z.literal('all'), of: z.array(RowPredicateSchema) }),
    z.object({ kind: z.literal('any'), of: z.array(RowPredicateSchema) }),
    z.object({ kind: z.literal('not'), of: RowPredicateSchema }),
    z.object({ kind: z.literal('const'), value: z.boolean() }),
  ]),
);

export const RowQuerySchema: z.ZodType<RowQuery> = z.object({
  policy: RowPredicateSchema.optional(),
  filter: RowPredicateSchema.optional(),
  order: z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) }).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
});

export const RowQueryPageSchema: z.ZodType<RowQueryPage> = z.object({
  rows: z.array(EntityRowSchema),
  total: z.number().int().nonnegative(),
});

type Comparable = string | number | boolean | Date;

function isMissing(value: FieldValue | undefined): value is null | undefined {
  return value === null || value === undefined;
}

function comparable(value: FieldValue | undefined): value is Comparable {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date;
}

function codePointOrder(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const cx = x[i].codePointAt(0) ?? 0;
    const cy = y[i].codePointAt(0) ?? 0;
    if (cx !== cy) return cx < cy ? -1 : 1;
  }
  return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
}

/** Order of two present values of one kind (binary order for strings); null when the kinds differ. */
function orderValues(a: Comparable, b: Comparable): number | null {
  if (typeof a === 'string' && typeof b === 'string') return codePointOrder(a, b);
  if (typeof a === 'number' && typeof b === 'number') return a === b ? 0 : a < b ? -1 : 1;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
  if (a instanceof Date && b instanceof Date) {
    const x = a.getTime();
    const y = b.getTime();
    return x === y ? 0 : x < y ? -1 : 1;
  }
  return null;
}

function sameValue(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function compareLeaf(value: FieldValue | undefined, op: RowPredicate & { kind: 'compare' }): boolean {
  const target = op.value;
  if (isMissing(value)) return op.op === '!=' && !isMissing(target);
  switch (op.op) {
    case '==': return sameValue(value, target);
    case '!=': return !sameValue(value, target);
    default: {
      if (!comparable(value) || !comparable(target)) return false;
      const c = orderValues(value, target);
      if (c === null) return false;
      if (op.op === '<') return c < 0;
      if (op.op === '<=') return c <= 0;
      if (op.op === '>') return c > 0;
      return c >= 0;
    }
  }
}

export function rowMatchesPredicate(row: EntityRow, predicate: RowPredicate): boolean {
  switch (predicate.kind) {
    case 'const': return predicate.value;
    case 'all': return predicate.of.every((p) => rowMatchesPredicate(row, p));
    case 'any': return predicate.of.some((p) => rowMatchesPredicate(row, p));
    case 'not': return !rowMatchesPredicate(row, predicate.of);
    case 'compare': return compareLeaf(row[predicate.field], predicate);
    case 'isNull': return isMissing(row[predicate.field]) === predicate.isNull;
    case 'member': {
      const value = row[predicate.field];
      return !isMissing(value) && predicate.values.some((v) => sameValue(v, value));
    }
    case 'hasElement': {
      const value = row[predicate.field];
      return Array.isArray(value) && value.some((v) => sameValue(v, predicate.value));
    }
    case 'contains': {
      const value = row[predicate.field];
      if (typeof value !== 'string') return false;
      return predicate.caseSensitive
        ? value.includes(predicate.text)
        : value.toLowerCase().includes(predicate.text.toLowerCase());
    }
  }
}

/** Comparator for one sort key: missing and null last in both directions, no tie-break. */
export function compareByField(field: string, direction: RowOrder['direction']): (a: EntityRow, b: EntityRow) => number {
  return (a, b) => {
    const x = a[field];
    const y = b[field];
    const xMissing = isMissing(x);
    const yMissing = isMissing(y);
    if (xMissing || yMissing) return xMissing === yMissing ? 0 : xMissing ? 1 : -1;
    if (!comparable(x) || !comparable(y)) return 0;
    const c = orderValues(x, y);
    if (c === null) return 0;
    return direction === 'asc' ? c : -c;
  };
}

/** Rows ordered by `order` (when given), ties by `id` ascending; the input is not mutated. */
export function orderRows(rows: readonly EntityRow[], order: RowOrder | undefined): EntityRow[] {
  const byId = compareByField('id', 'asc');
  const byKey = order ? compareByField(order.field, order.direction) : null;
  return [...rows].sort((a, b) => (byKey ? byKey(a, b) : 0) || byId(a, b));
}

/** The reference run of a `RowQuery` over a full row set. */
export function runRowQuery(rows: readonly EntityRow[], query: RowQuery): RowQueryPage {
  const matched = rows.filter(
    (row) =>
      (query.policy === undefined || rowMatchesPredicate(row, query.policy)) &&
      (query.filter === undefined || rowMatchesPredicate(row, query.filter)),
  );
  const ordered = orderRows(matched, query.order);
  const start = query.offset ?? 0;
  const end = query.limit === undefined ? undefined : start + query.limit;
  return { rows: ordered.slice(start, end), total: ordered.length };
}

/** Capabilities of a store that runs every query form: the memory adapters, IndexedDB and Postgres. */
export const FULL_QUERY_CAPABILITIES: QueryCapabilities = {
  leaves: ['compare', 'member', 'hasElement', 'contains', 'isNull'],
  combinators: ['all', 'any', 'not'],
  compareOps: ['==', '!=', '<', '<=', '>', '>='],
  orderableFields: { kind: 'every-field' },
  window: true,
  exactTotal: true,
};

export type QueryUnsupportedReason = 'leaf-unsupported' | 'combinator-unsupported' | 'order-field' | 'window' | 'exact-total';

function predicateUnsupported(capabilities: QueryCapabilities, predicate: RowPredicate): QueryUnsupportedReason | null {
  switch (predicate.kind) {
    case 'const': return null;
    case 'compare':
      return capabilities.leaves.includes('compare') && capabilities.compareOps.includes(predicate.op) ? null : 'leaf-unsupported';
    case 'member':
    case 'hasElement':
    case 'contains':
    case 'isNull':
      return capabilities.leaves.includes(predicate.kind) ? null : 'leaf-unsupported';
    case 'all':
    case 'any': {
      if (!capabilities.combinators.includes(predicate.kind)) return 'combinator-unsupported';
      for (const child of predicate.of) {
        const reason = predicateUnsupported(capabilities, child);
        if (reason) return reason;
      }
      return null;
    }
    case 'not':
      return capabilities.combinators.includes('not') ? predicateUnsupported(capabilities, predicate.of) : 'combinator-unsupported';
  }
}

/**
 * Why a host with `capabilities` cannot run `query` as a push-down, or null when it can. The first
 * failing check wins: leaves, combinators, order field, window, exact total.
 */
export function queryUnsupportedReason(capabilities: QueryCapabilities, query: RowQuery): QueryUnsupportedReason | null {
  const used: RowPredicate[] = [];
  if (query.policy) used.push(query.policy);
  if (query.filter) used.push(query.filter);
  // leaf checks across both predicates first, then combinators: a leaf failure outranks a combinator one
  for (const predicate of used) {
    const reason = leafUnsupported(capabilities, predicate);
    if (reason) return reason;
  }
  for (const predicate of used) {
    const reason = predicateUnsupported(capabilities, predicate);
    if (reason) return reason;
  }
  if (query.order && capabilities.orderableFields.kind === 'listed' && !capabilities.orderableFields.fields.includes(query.order.field)) {
    return 'order-field';
  }
  if ((query.offset !== undefined || query.limit !== undefined) && !capabilities.window) return 'window';
  if (!capabilities.exactTotal) return 'exact-total';
  return null;
}

function leafUnsupported(capabilities: QueryCapabilities, predicate: RowPredicate): 'leaf-unsupported' | null {
  switch (predicate.kind) {
    case 'all':
    case 'any':
      for (const child of predicate.of) {
        if (leafUnsupported(capabilities, child)) return 'leaf-unsupported';
      }
      return null;
    case 'not': return leafUnsupported(capabilities, predicate.of);
    default: return predicateUnsupported(capabilities, predicate) === null ? null : 'leaf-unsupported';
  }
}
