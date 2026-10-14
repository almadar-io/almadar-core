import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EntityRowSchema } from '../src/types/entity.js';
import type { EntityRow, QueryCapabilities, RowPredicate } from '../src/types/index.js';
import {
  RowPredicateSchema,
  RowQuerySchema,
  compareByField,
  FULL_QUERY_CAPABILITIES,
  queryUnsupportedReason,
  rowMatchesPredicate,
  runRowQuery,
} from '../src/row-query.js';

// Copied from packages/almadar-parity/fixtures/pushdown/query-cases.json (the shared push-down fixture); keep in sync.
const FixtureSchema = z.object({
  rows: z.array(EntityRowSchema),
  cases: z.array(
    z.object({
      name: z.string(),
      query: RowQuerySchema,
      expect: z.object({ ids: z.array(z.string()), total: z.number() }),
    }),
  ),
});
const fixture = FixtureSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures/pushdown/query-cases.json'), 'utf8')));

describe('runRowQuery over the shared push-down cases', () => {
  it('reads the 29 recorded cases', () => {
    expect(fixture.cases).toHaveLength(29);
  });
  for (const c of fixture.cases) {
    it(c.name, () => {
      const page = runRowQuery(fixture.rows, c.query);
      expect(page.rows.map((r) => r.id)).toEqual(c.expect.ids);
      expect(page.total).toBe(c.expect.total);
    });
  }
  it('control: a wrong expectation is detected', () => {
    const page = runRowQuery(fixture.rows, { filter: { kind: 'compare', field: 'status', op: '==', value: 'open' } });
    expect(page.rows.map((r) => r.id)).not.toEqual(['t01']);
  });
});

describe('rowMatchesPredicate edge cases', () => {
  const row: EntityRow = { id: 'x', n: 0, s: 'Ab', nil: null, tags: ['a'], d: new Date(5) };
  const m = (p: RowPredicate) => rowMatchesPredicate(row, p);
  it('empty all is true, empty any is false', () => {
    expect(m({ kind: 'all', of: [] })).toBe(true);
    expect(m({ kind: 'any', of: [] })).toBe(false);
  });
  it('zero is a value', () => {
    expect(m({ kind: 'compare', field: 'n', op: '==', value: 0 })).toBe(true);
    expect(m({ kind: 'isNull', field: 'n', isNull: true })).toBe(false);
  });
  it('null and missing behave the same', () => {
    for (const field of ['nil', 'absent']) {
      expect(m({ kind: 'isNull', field, isNull: true })).toBe(true);
      expect(m({ kind: 'compare', field, op: '!=', value: 'v' })).toBe(true);
      expect(m({ kind: 'compare', field, op: '!=', value: null })).toBe(false);
      expect(m({ kind: 'compare', field, op: '==', value: null })).toBe(false);
      expect(m({ kind: 'compare', field, op: '<', value: 1 })).toBe(false);
      expect(m({ kind: 'not', of: { kind: 'compare', field, op: '>', value: 1 } })).toBe(true);
    }
  });
  it('compares only values of one kind', () => {
    expect(m({ kind: 'compare', field: 'n', op: '<', value: 'z' })).toBe(false);
    expect(m({ kind: 'compare', field: 's', op: '>', value: 1 })).toBe(false);
    expect(m({ kind: 'compare', field: 'd', op: '>=', value: new Date(5) })).toBe(true);
    expect(m({ kind: 'compare', field: 'd', op: '==', value: new Date(5) })).toBe(true);
  });
  it('member and hasElement need a present value', () => {
    expect(m({ kind: 'member', field: 's', values: ['Ab'] })).toBe(true);
    expect(m({ kind: 'member', field: 'nil', values: [null] })).toBe(false);
    expect(m({ kind: 'hasElement', field: 'tags', value: 'a' })).toBe(true);
    expect(m({ kind: 'hasElement', field: 's', value: 'A' })).toBe(false);
  });
  it('contains on a non-string field fails', () => {
    expect(m({ kind: 'contains', field: 'n', text: '0', caseSensitive: true })).toBe(false);
    expect(m({ kind: 'contains', field: 's', text: 'AB', caseSensitive: false })).toBe(true);
    expect(m({ kind: 'contains', field: 's', text: 'AB', caseSensitive: true })).toBe(false);
  });
});

describe('ordering', () => {
  it('compares strings by code point, not UTF-16 unit', () => {
    const rows: EntityRow[] = [{ id: 'a', s: '\u{1F600}' }, { id: 'b', s: '￿' }];
    const page = runRowQuery(rows, { order: { field: 's', direction: 'asc' } });
    expect(page.rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
  it('desc keeps id ascending among ties and missing last', () => {
    const rows: EntityRow[] = [{ id: 'c', v: 1 }, { id: 'a', v: 1 }, { id: 'b' }, { id: 'd', v: 2 }];
    const page = runRowQuery(rows, { order: { field: 'v', direction: 'desc' } });
    expect(page.rows.map((r) => r.id)).toEqual(['d', 'a', 'c', 'b']);
  });
  it('compareByField alone does not break ties', () => {
    expect(compareByField('v', 'asc')({ id: 'a', v: 1 }, { id: 'b', v: 1 })).toBe(0);
  });
  it('does not mutate its input', () => {
    const rows: EntityRow[] = [{ id: 'b' }, { id: 'a' }];
    runRowQuery(rows, {});
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('schemas', () => {
  it('accepts a nested predicate and rejects an unknown kind', () => {
    const ok: RowPredicate = { kind: 'not', of: { kind: 'any', of: [{ kind: 'const', value: true }] } };
    expect(RowPredicateSchema.parse(ok)).toEqual(ok);
    expect(RowPredicateSchema.safeParse({ kind: 'like', field: 'a' }).success).toBe(false);
  });
  it('rejects a negative offset and a fractional limit', () => {
    expect(RowQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(RowQuerySchema.safeParse({ limit: 1.5 }).success).toBe(false);
  });
});

describe('queryUnsupportedReason', () => {
  const full: QueryCapabilities = FULL_QUERY_CAPABILITIES;
  const eq: RowPredicate = { kind: 'compare', field: 'a', op: '==', value: 1 };

  it('a full host accepts every recorded case', () => {
    for (const c of fixture.cases) expect(queryUnsupportedReason(full, c.query)).toBeNull();
  });
  it('names the first failing check, in the design order', () => {
    expect(queryUnsupportedReason({ ...full, leaves: ['member'] }, { filter: eq })).toBe('leaf-unsupported');
    expect(queryUnsupportedReason({ ...full, compareOps: ['=='] }, { policy: { kind: 'compare', field: 'a', op: '<', value: 1 } })).toBe('leaf-unsupported');
    expect(queryUnsupportedReason({ ...full, combinators: ['all'] }, { filter: { kind: 'not', of: eq } })).toBe('combinator-unsupported');
    expect(queryUnsupportedReason({ ...full, orderableFields: { kind: 'listed', fields: ['id'] } }, { order: { field: 'a', direction: 'asc' } })).toBe('order-field');
    expect(queryUnsupportedReason({ ...full, window: false }, { limit: 3 })).toBe('window');
    expect(queryUnsupportedReason({ ...full, exactTotal: false }, {})).toBe('exact-total');
  });
  it('controls: the same queries pass when the capability is present', () => {
    expect(queryUnsupportedReason({ ...full, orderableFields: { kind: 'listed', fields: ['a'] } }, { order: { field: 'a', direction: 'desc' } })).toBeNull();
    expect(queryUnsupportedReason({ ...full, window: false }, {})).toBeNull();
    expect(queryUnsupportedReason({ ...full, combinators: [] }, { filter: eq, policy: { kind: 'const', value: true } })).toBeNull();
  });
  it('checks leaves nested under combinators and in the policy', () => {
    const nested: RowPredicate = { kind: 'all', of: [{ kind: 'any', of: [{ kind: 'isNull', field: 'a', isNull: true }] }] };
    expect(queryUnsupportedReason({ ...full, leaves: ['compare'] }, { policy: nested })).toBe('leaf-unsupported');
  });
});
