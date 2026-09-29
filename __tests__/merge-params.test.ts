/**
 * Three-way merge of an orbital's factory params (base = the common ancestor, ours, theirs). Keys
 * merge one by one; a list of objects carrying `id` merges item by item; only a key both sides set
 * to different values, or an item one side deleted and the other edited, is a conflict.
 */
import { describe, it, expect } from 'vitest';
import type { JsonValue } from '../src/types/json.js';
import { mergeParams } from '../src/factory/merge.js';

const field = (id: string, name: string, type = 'string'): JsonValue => ({ id, name, type });

describe('mergeParams', () => {
  it('disjoint keys set on each side both land', () => {
    const r = mergeParams({ title: 'A', color: 'red' }, { title: 'B', color: 'red' }, { title: 'A', color: 'blue' });
    expect(r).toEqual({ merged: { title: 'B', color: 'blue' }, conflicts: [] });
  });

  it('the same key set to different values is a conflict, naming both values', () => {
    const r = mergeParams({ title: 'A' }, { title: 'B' }, { title: 'C' });
    expect(r.conflicts).toEqual([{ path: ['title'], kind: 'both-changed', base: 'A', ours: 'B', theirs: 'C' }]);
  });

  it('control: both sides setting the same value is no conflict', () => {
    expect(mergeParams({ title: 'A' }, { title: 'B' }, { title: 'B' })).toEqual({ merged: { title: 'B' }, conflicts: [] });
  });

  it('a field renamed on one side and retyped on the other merges into one field, by id', () => {
    const base = { fields: [field('f1', 'price', 'number')] };
    const ours = { fields: [field('f1', 'cost', 'number')] };
    const theirs = { fields: [field('f1', 'price', 'integer')] };
    expect(mergeParams(base, ours, theirs)).toEqual({ merged: { fields: [field('f1', 'cost', 'integer')] }, conflicts: [] });
  });

  it('a reorder on one side and an insert on the other both land', () => {
    const base = { fields: [field('a', 'a'), field('b', 'b'), field('c', 'c')] };
    const ours = { fields: [field('c', 'c'), field('a', 'a'), field('b', 'b')] };
    const theirs = { fields: [field('a', 'a'), field('b', 'b'), field('n', 'new'), field('c', 'c')] };
    const r = mergeParams(base, ours, theirs);
    expect(r.conflicts).toEqual([]);
    expect(r.merged).toEqual({ fields: [field('c', 'c'), field('a', 'a'), field('b', 'b'), field('n', 'new')] });
  });

  it('an item deleted on one side and edited on the other is a conflict', () => {
    const base = { fields: [field('a', 'a'), field('b', 'b')] };
    const ours = { fields: [field('a', 'a')] };
    const theirs = { fields: [field('a', 'a'), field('b', 'bee')] };
    expect(mergeParams(base, ours, theirs).conflicts).toEqual([{ path: ['fields', 'b'], kind: 'delete-vs-edit', base: field('b', 'b'), ours: null, theirs: field('b', 'bee') }]);
  });

  it('control: an item deleted on one side and untouched on the other is deleted', () => {
    const base = { fields: [field('a', 'a'), field('b', 'b')] };
    expect(mergeParams(base, { fields: [field('a', 'a')] }, base)).toEqual({ merged: { fields: [field('a', 'a')] }, conflicts: [] });
  });

  it('edge: a key removed on one side and changed on the other is a delete-vs-edit conflict', () => {
    const r = mergeParams({ pagePath: '/a' }, {}, { pagePath: '/b' });
    expect(r.conflicts).toEqual([{ path: ['pagePath'], kind: 'delete-vs-edit', base: '/a', ours: null, theirs: '/b' }]);
  });

  it('edge: a list without ids merges as one value', () => {
    expect(mergeParams({ tags: ['a'] }, { tags: ['a', 'b'] }, { tags: ['a'] }).merged).toEqual({ tags: ['a', 'b'] });
    expect(mergeParams({ tags: ['a'] }, { tags: ['b'] }, { tags: ['c'] }).conflicts).toHaveLength(1);
  });
});
