import { describe, it, expect } from 'vitest';
import { formatSExpr } from '../src/types/expression.js';

describe('formatSExpr — .lolo surface form of an S-expression', () => {
  it('prints a call as (op args…)', () => {
    expect(formatSExpr(['>', '@entity.qty', 0])).toBe('(> @entity.qty 0)');
  });

  it('nests calls', () => {
    expect(formatSExpr(['and', ['>', '@entity.qty', 0], ['=', '@user.role', 'admin']]))
      .toBe('(and (> @entity.qty 0) (= @user.role "admin"))');
  });

  it('keeps bindings bare and quotes plain strings (paired control)', () => {
    expect(formatSExpr('@payload.id')).toBe('@payload.id');
    expect(formatSExpr('admin')).toBe('"admin"');
    expect(formatSExpr('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('prints scalars and null', () => {
    expect(formatSExpr(3.5)).toBe('3.5');
    expect(formatSExpr(true)).toBe('true');
    expect(formatSExpr(null)).toBe('null');
  });

  it('prints object literals inline and literal (non-call) arrays in brackets', () => {
    expect(formatSExpr(['emit', 'SAVED', { id: '@entity.id', n: 1 }])).toBe('(emit "SAVED" { id: @entity.id, n: 1 })');
    expect(formatSExpr(['array/len', [1, 2, 3]])).toBe('(array/len [1 2 3])');
    expect(formatSExpr({})).toBe('{}');
    expect(formatSExpr([])).toBe('[]');
  });

  it('a string-headed array is a call, consistent with isSExpr', () => {
    expect(formatSExpr(['main'])).toBe('(main)');
  });
});
