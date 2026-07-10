import { describe, it, expect } from 'vitest';
import { mergeCallSiteConfigOverrides } from '../src/factory-runtime/apply-params-to-orb.js';
import { isCallSiteConfigDeclaration } from '../src/types/index.js';

// RABIT-BUG-2 — trait-slot objectification. A trait-typed config slot
// (e.g. `toolbar1Trait`) must always resolve to a plain `@trait.<Name>`
// string default, never the annotated `{ type, default }` declaration
// object itself. Reported symptom: `orb validate` rejecting factory
// candidates with `ORB_T_CONFIG_SHAPE_MISMATCH: expected string, got
// object` / `ORB_BINDING_TRAIT_INVALID_FORMAT` on std-embedded-dashboard's
// DashboardOrbital, dispatched with empty params (`{}`). Root-caused to an
// orbital-rust inline-fold bug (fixed by `dbd419e fix(inline): defer
// @config fold on import-load so consumer overrides reach guards`) — this
// pins the JS-side merge (the layer this bug's fix was suspected to live
// in) so a future regression here is caught without needing the Rust
// resolve+validate round trip.
describe('mergeCallSiteConfigOverrides — no double-wrapping', () => {
  it('never double-wraps a declared base entry when the override is a plain string (trait-typed slot)', () => {
    const base = { toolbar1Trait: { type: 'unknown', default: '@trait.InlineExportMenu1' } };
    const overrides = { toolbar1Trait: '@trait.InlineDateRangeFilter2' };
    const merged = mergeCallSiteConfigOverrides(base, overrides);

    expect(isCallSiteConfigDeclaration(merged['toolbar1Trait']!)).toBe(true);
    const entry = merged['toolbar1Trait'] as { type: string; default: unknown };
    expect(typeof entry.default).toBe('string');
    expect(entry.default).toBe('@trait.InlineDateRangeFilter2');
  });

  it('never double-wraps a declared base entry when the override is a plain scalar', () => {
    const base = { period: { type: 'unknown', default: 'quarter' } };
    const overrides = { period: 'month' };
    const merged = mergeCallSiteConfigOverrides(base, overrides);

    const entry = merged['period'] as { type: string; default: unknown };
    expect(typeof entry.default).toBe('string');
    expect(entry.default).toBe('month');
  });

  it('leaves fields absent from overrides exactly as declared on the base', () => {
    const base = { showLegend: { type: 'unknown', default: false } };
    const merged = mergeCallSiteConfigOverrides(base, {});

    expect(merged['showLegend']).toEqual({ type: 'unknown', default: false });
  });

  it('wraps a plain-value base entry (no prior declaration) into a fresh unknown-typed declaration', () => {
    const base = { minTileWidth: 320 };
    const overrides = { minTileWidth: 400 };
    const merged = mergeCallSiteConfigOverrides(base, overrides);

    expect(merged['minTileWidth']).toEqual({ type: 'unknown', default: 400 });
  });

  it('an override that is itself a full declaration replaces the base outright (not nested under it)', () => {
    const base = { title: { type: 'unknown', default: 'Revenue by Quarter' } };
    const overrides = { title: { type: 'string', default: 'Q Revenue', label: 'Title' } };
    const merged = mergeCallSiteConfigOverrides(base, overrides);

    expect(merged['title']).toEqual({ type: 'string', default: 'Q Revenue', label: 'Title' });
  });
});
