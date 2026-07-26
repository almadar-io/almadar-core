/**
 * The mock-seed policy, pinned before any call site moves onto it.
 *
 * Five synthesizers held four different `default` policies, so the same entity
 * seeded differently depending on which path rendered it. Everything here is
 * asserted under BOTH entropy strategies because the policy is strategy-invariant
 * — only the value generators differ.
 */

import { describe, it, expect } from 'vitest';
import type { EntityField } from '../src/types/field.js';
import {
  IMAGE_FIELD_NAMES,
  isDeclaredDefaultHonored,
  sampleFieldValue,
  sampleRowCount,
  sampleRows,
  seedRandom,
  type SampleContext,
  type SampleEntity,
  type SampleStrategy,
} from '../src/mock/index.js';

const STRATEGIES: SampleStrategy[] = ['seeded', 'index'];

function ctx(strategy: SampleStrategy, index = 1, persistence?: 'persistent' | 'runtime'): SampleContext {
  return { entityName: 'Member', index, strategy, persistence };
}

function entity(fields: EntityField[], persistence?: 'persistent' | 'runtime'): SampleEntity {
  return { name: 'Member', persistence, fields };
}

describe.each(STRATEGIES)('mock-seed policy [%s]', (strategy) => {
  describe('declared defaults that must be honored verbatim', () => {
    it('honors a non-empty string default when the field has no vocabulary', () => {
      const f: EntityField = { name: 'title', type: 'string', default: 'Title' };
      expect(sampleFieldValue(f, ctx(strategy))).toBe('Title');
    });

    it('honors 0 and false — the falsy traps the numeric-only gate existed for', () => {
      expect(sampleFieldValue({ name: 'tokenCount', type: 'number', default: 0 }, ctx(strategy))).toBe(0);
      expect(sampleFieldValue({ name: 'enabled', type: 'boolean', default: false }, ctx(strategy))).toBe(false);
    });

    it('honors empty collection defaults', () => {
      expect(sampleFieldValue({ name: 'tags', type: 'array', default: [] }, ctx(strategy))).toEqual([]);
      expect(sampleFieldValue({ name: 'meta', type: 'object', default: {} }, ctx(strategy))).toEqual({});
    });

    it('honors authored ui-factory content verbatim', () => {
      const features: EntityField = {
        name: 'features',
        type: 'array',
        default: ['Item', 'Item 2'],
      };
      expect(sampleFieldValue(features, ctx(strategy))).toEqual(['Item', 'Item 2']);

      const hero: EntityField = {
        name: 'hero',
        type: 'object',
        default: { title: 'Title', action: { label: 'Label', href: 'Href' } },
      };
      expect(sampleFieldValue(hero, ctx(strategy))).toEqual({
        title: 'Title',
        action: { label: 'Label', href: 'Href' },
      });
    });
  });

  describe('placeholders that must be synthesized instead', () => {
    it('treats an empty-string default as absent', () => {
      const f: EntityField = { name: 'email', type: 'string', default: '' };
      const value = sampleFieldValue(f, ctx(strategy));
      expect(value).not.toBe('');
      expect(typeof value).toBe('string');
    });

    it('treats a null default as absent', () => {
      const f: EntityField = { name: 'note', type: 'string', default: null };
      expect(sampleFieldValue(f, ctx(strategy))).not.toBeNull();
    });

    it('gate 3: honors "" when the field\'s own vocabulary declares it', () => {
      const f: EntityField = {
        name: 'finalStatus',
        type: 'string',
        values: ['approved', 'rejected', 'escalated', ''],
        default: '',
      };
      expect(isDeclaredDefaultHonored(f)).toBe(true);
      expect(sampleFieldValue(f, ctx(strategy))).toBe('');
    });
  });

  describe('the row cycle over a declared vocabulary', () => {
    // .lolo unions lower to type:'string' WITH values, not type:'enum' — a
    // policy that only covered 'enum' would be a no-op on the real corpus.
    const asString: EntityField = {
      name: 'membershipTier',
      type: 'string',
      values: ['basic', 'premium', 'unlimited'],
      default: 'basic',
    };
    const asEnum: EntityField = {
      name: 'membershipTier',
      type: 'enum',
      values: ['basic', 'premium', 'unlimited'],
      default: 'basic',
    };

    it.each([
      ['string + values (the .lolo shape)', asString],
      ['enum', asEnum],
    ])('cycles 1-based over %s', (_label, field) => {
      const got = [1, 2, 3, 4].map((i) => sampleFieldValue(field, ctx(strategy, i)));
      expect(got).toEqual(['basic', 'premium', 'unlimited', 'basic']);
    });

    it('anchors row 1 to values[0], preserving the declared default', () => {
      expect(sampleFieldValue(asString, ctx(strategy, 1))).toBe('basic');
    });

    it('wraps cleanly past the vocabulary length', () => {
      const got = [1, 2, 3, 4, 5, 6, 7].map((i) => sampleFieldValue(asString, ctx(strategy, i)));
      expect(got).toEqual(['basic', 'premium', 'unlimited', 'basic', 'premium', 'unlimited', 'basic']);
    });
  });

  describe('gate 1 — runtime singletons', () => {
    const boardResult: EntityField = {
      name: 'result',
      type: 'string',
      values: ['none', 'victory', 'defeat'],
      default: 'none',
    };

    it('seeds exactly one row for a runtime entity', () => {
      expect(sampleRowCount(entity([boardResult], 'runtime'), 6)).toBe(1);
      expect(sampleRows(entity([boardResult], 'runtime'), 6, strategy)).toHaveLength(1);
    });

    it('seeds the requested count for a persistent entity', () => {
      expect(sampleRowCount(entity([boardResult], 'persistent'), 6)).toBe(6);
      expect(sampleRows(entity([boardResult], 'persistent'), 6, strategy)).toHaveLength(6);
    });

    it('C-MOCK-SEED-STRING-DEFAULT-IGNORED: a board never boots into game-over', () => {
      const rows = sampleRows(entity([boardResult], 'runtime'), 6, strategy);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.result).toBe('none');
    });

    it('the same field on a collection does cycle', () => {
      const rows = sampleRows(entity([boardResult], 'persistent'), 3, strategy);
      expect(rows.map((r) => r.result)).toEqual(['none', 'victory', 'defeat']);
    });
  });

  describe('gate 2 — intrinsic fields belong to the owning trait', () => {
    it('returns the default when one is declared', () => {
      const f: EntityField = { name: 'currentStepIndex', type: 'number', intrinsic: true, default: 0 };
      expect(sampleFieldValue(f, ctx(strategy))).toBe(0);
    });

    it('omits the key entirely when no default is declared', () => {
      const f: EntityField = { name: 'boards', type: 'array', intrinsic: true };
      expect(sampleFieldValue(f, ctx(strategy))).toBeUndefined();
      expect(sampleRows(entity([f]), 2, strategy)[0]).not.toHaveProperty('boards');
    });
  });

  describe('per-type synthesis', () => {
    it('leaves relation placeholders for the caller to link', () => {
      const one: EntityField = { name: 'owner', type: 'relation', relation: { entity: 'User', cardinality: 'one' } };
      const many: EntityField = { name: 'tags', type: 'relation', relation: { entity: 'Tag', cardinality: 'many' } };
      expect(sampleFieldValue(one, ctx(strategy))).toBe('');
      expect(sampleFieldValue(many, ctx(strategy))).toEqual([]);
    });

    it('omits trait, slot and pattern fields', () => {
      for (const type of ['trait', 'slot', 'pattern'] as const) {
        expect(sampleFieldValue({ name: 'x', type }, ctx(strategy))).toBeUndefined();
      }
    });

    it('populates every declared property of an object field', () => {
      const f: EntityField = {
        name: 'position',
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' } },
      };
      expect(sampleFieldValue(f, ctx(strategy))).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    });

    it('terminates on a self-referential array instead of blowing the stack', () => {
      const comment: EntityField = { name: 'replies', type: 'array' };
      comment.items = comment;
      expect(() => sampleFieldValue(comment, ctx(strategy))).not.toThrow();
    });

    it('honors a declared numeric range in both strategies', () => {
      const f: EntityField = { name: 'rating', type: 'number', min: 1, max: 5 };
      for (const i of [1, 2, 3, 4, 5, 6]) {
        const v = sampleFieldValue(f, ctx(strategy, i));
        expect(typeof v).toBe('number');
        expect(v as number).toBeGreaterThanOrEqual(1);
        expect(v as number).toBeLessThanOrEqual(5);
      }
    });

    it('renders a date as date-only and a datetime with time', () => {
      expect(sampleFieldValue({ name: 'joinedAt', type: 'date' }, ctx(strategy))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(sampleFieldValue({ name: 'seenAt', type: 'datetime' }, ctx(strategy))).toMatch(/T/);
    });

    it('keeps the image-name stopgap alive until a real image type exists', () => {
      expect(IMAGE_FIELD_NAMES.has('imageurl')).toBe(true);
      const f: EntityField = { name: 'imageUrl', type: 'string' };
      expect(sampleFieldValue(f, ctx(strategy))).toContain('picsum.photos');
    });

    it('documents how narrow the stopgap actually is — compound names miss it', () => {
      // `coverImage`/`profileImage` are NOT in the list (only `cover`/`coverurl`
      // are), so they already render as text today. Pinned so the reach of the
      // list is a measured fact rather than an assumption when it is retired.
      expect(IMAGE_FIELD_NAMES.has('coverimage')).toBe(false);
      const f: EntityField = { name: 'coverImage', type: 'string' };
      expect(sampleFieldValue(f, ctx(strategy))).not.toContain('picsum.photos');
    });
  });
});

describe('entropy is a parameter, not part of the policy', () => {
  it('seeded is stable under the same seed', () => {
    const e = entity([{ name: 'name', type: 'string' }, { name: 'score', type: 'number' }]);
    seedRandom(42);
    const first = sampleRows(e, 4, 'seeded');
    seedRandom(42);
    expect(sampleRows(e, 4, 'seeded')).toEqual(first);
  });

  it('index is referentially transparent — the parity-testable strategy', () => {
    const f: EntityField = { name: 'name', type: 'string' };
    const results = Array.from({ length: 5 }, () => sampleFieldValue(f, ctx('index', 3)));
    expect(new Set(results).size).toBe(1);
  });

  it('index never consults the PRNG, so an interleaved reseed cannot move it', () => {
    const f: EntityField = { name: 'score', type: 'number' };
    const before = sampleFieldValue(f, ctx('index', 7));
    seedRandom(999);
    expect(sampleFieldValue(f, ctx('index', 7))).toBe(before);
  });
});

describe('reserved keys are the caller\'s to stamp', () => {
  it('never synthesizes id, createdAt or updatedAt', () => {
    const e = entity([
      { name: 'id', type: 'string' },
      { name: 'createdAt', type: 'datetime' },
      { name: 'updatedAt', type: 'datetime' },
      { name: 'name', type: 'string' },
    ]);
    const row = sampleRows(e, 1, 'index')[0]!;
    expect(row).not.toHaveProperty('id');
    expect(row).not.toHaveProperty('createdAt');
    expect(row).not.toHaveProperty('updatedAt');
    expect(row).toHaveProperty('name');
  });
});
