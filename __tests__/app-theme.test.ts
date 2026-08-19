import { describe, it, expect } from 'vitest';
import { parseOrbitalSchema } from '../src/types/schema.js';

describe('app-level schema theme', () => {
  const base = {
    name: 'ThemedApp',
    orbitals: [
      {
        name: 'FooOrbital',
        entity: { name: 'Foo', fields: [{ name: 'id', type: 'string', required: true }] },
        traits: [],
        pages: [],
      },
    ],
  };

  it('survives parseOrbitalSchema round-trip (zod must not strip it)', () => {
    const parsed = parseOrbitalSchema({ ...base, theme: 'linear-clean-light' });
    expect(parsed.theme).toBe('linear-clean-light');
  });

  it('is absent when undeclared', () => {
    const parsed = parseOrbitalSchema(base);
    expect(parsed.theme).toBeUndefined();
  });

  it('accepts registry-key strings on per-orbital theme (the rabit-stamped form)', () => {
    const orbitals = [{ ...base.orbitals[0], theme: 'bloomberg-dense-dark' }];
    const parsed = parseOrbitalSchema({ ...base, orbitals });
    expect(parsed.orbitals[0]?.theme).toBe('bloomberg-dense-dark');
  });
});
