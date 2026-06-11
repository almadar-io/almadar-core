/**
 * Coverage of the `and`-handler bare-string sub-guard fix in
 * `buildGuardPayloads`. Before the fix the `and` branch ran
 * `filter(Array.isArray)` over its sub-guards, silently dropping
 * bare-binding existence guards like `"@payload.row"` from the pass
 * payload. The `or` branch already kept them. These tests pin that an
 * `and` over a mix of bare-string and array sub-guards seeds BOTH fields.
 */

import { describe, it, expect } from 'vitest';
import { buildGuardPayloads } from '../src/state-machine/guard-payloads.js';

describe('buildGuardPayloads — and-handler bare-string sub-guards', () => {
  it('seeds pass for BOTH a bare-string and an array sub-guard', () => {
    const { pass, fail } = buildGuardPayloads(['and', '@payload.a', ['not-nil', '@payload.b']]);
    expect(pass.a).toBeDefined();
    expect(pass.a).not.toBeNull();
    expect(pass.b).toBeDefined();
    expect(pass.b).not.toBeNull();
    // AND fails iff any sub-guard fails — first sub-guard's fail is sufficient.
    expect(fail.a).toBeNull();
  });

  it('preserves AND pass-merge semantics for two array sub-guards', () => {
    const { pass } = buildGuardPayloads([
      'and',
      ['not-nil', '@payload.id'],
      ['eq', '@payload.status', 'ready'],
    ]);
    expect(pass.id).toBe('mock-test-value');
    expect(pass.status).toBe('ready');
  });

  it('handles three sub-guards including a bare string', () => {
    const { pass } = buildGuardPayloads([
      'and',
      '@payload.row',
      ['not-nil', '@payload.id'],
      ['eq', '@payload.status', 'ready'],
    ]);
    expect(pass.row).toBeDefined();
    expect(pass.id).toBe('mock-test-value');
    expect(pass.status).toBe('ready');
  });
});
