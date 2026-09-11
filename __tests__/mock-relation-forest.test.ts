/**
 * One self-relation seeding policy shared by every mock seeder — see
 * docs/Almadar_Runtime_Gaps.md R-MOCK-SELF-RELATION-MANY-RANDOM-LINKING.
 */
import { describe, it, expect } from 'vitest';
import { linkSelfRelationField, selfRelationForest } from '../src/mock/relationForest.js';
import type { EntityRow } from '../src/types/entity.js';

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Row-${i}`);
}

describe('selfRelationForest', () => {
  it('is deterministic across runs', () => {
    const rowIds = ids(9);
    const a = selfRelationForest(rowIds);
    const b = selfRelationForest(rowIds);
    for (let i = 0; i < rowIds.length; i++) {
      expect(a.parentOf(i)).toBe(b.parentOf(i));
      expect(a.childrenOf(i)).toEqual(b.childrenOf(i));
    }
  });

  it('root (row 0) is never referenced as a parent or a child', () => {
    const rowIds = ids(9);
    const forest = selfRelationForest(rowIds);
    expect(forest.parentOf(0)).toBe('');
    for (let i = 1; i < rowIds.length; i++) {
      expect(forest.childrenOf(i)).not.toContain(rowIds[0]);
    }
  });

  it('is acyclic: every non-root parent index is strictly smaller', () => {
    const rowIds = ids(20);
    const forest = selfRelationForest(rowIds);
    for (let i = 1; i < rowIds.length; i++) {
      const parentId = forest.parentOf(i);
      const parentIndex = rowIds.indexOf(parentId);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(i);
    }
  });

  it('scalar and list forms agree — a child lists its parent, its parent lists it', () => {
    const rowIds = ids(11);
    const forest = selfRelationForest(rowIds);
    for (let i = 1; i < rowIds.length; i++) {
      const parentId = forest.parentOf(i);
      const parentIndex = rowIds.indexOf(parentId);
      expect(forest.childrenOf(parentIndex)).toContain(rowIds[i]);
    }
  });
});

describe('linkSelfRelationField', () => {
  function rows(count: number): EntityRow[] {
    return ids(count).map((id) => ({ id }));
  }

  it('writes the scalar parent id for one/many-to-one', () => {
    const data = rows(5);
    linkSelfRelationField(data, { name: 'parentId', cardinality: 'one' });
    expect(data[0]!['parentId']).toBe('');
    expect(data[1]!['parentId']).toBe('Row-0');
    expect(data[2]!['parentId']).toBe('Row-0');
    expect(data[3]!['parentId']).toBe('Row-1');
  });

  it('writes the children-id list for many/one-to-many/many-to-many', () => {
    const data = rows(5);
    linkSelfRelationField(data, { name: 'replies', cardinality: 'many' });
    expect(data[0]!['replies']).toEqual(['Row-1', 'Row-2']);
    expect(data[1]!['replies']).toEqual(['Row-3', 'Row-4']);
    expect(data[4]!['replies']).toEqual([]);
  });

  it('honours a caller-supplied exclusion instead of overwriting stamped cells', () => {
    const data = rows(4);
    data[1]!['parentId'] = 'deliberately-stamped';
    linkSelfRelationField(data, { name: 'parentId', cardinality: 'one' }, (_row, i) => i === 1);
    expect(data[1]!['parentId']).toBe('deliberately-stamped');
    expect(data[0]!['parentId']).toBe('');
    expect(data[2]!['parentId']).toBe('Row-0');
  });
});
