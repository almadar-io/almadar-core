/**
 * Coverage of `buildResolvedTraitConfigs` forward chaining — in particular
 * the deep-resolution fix: a `@config.<key>` forward nested inside an array
 * or object value (std-service-email's `EmailComposerSlot { children:
 * [@config.uiTrait] }`) must chain to the embedder's config exactly like a
 * top-level string forward. Pre-fix only top-level strings were chained, so
 * the vessel's `children` kept the literal string and the standalone
 * default form never rendered (blank boot).
 */

import { describe, it, expect } from 'vitest';
import { buildResolvedTraitConfigs } from '../src/embedded-trait-config.js';
import type { OrbitalSchema } from '../src/types/index.js';

// Host embeds Slot via `@trait.Slot` in its state machine; Slot forwards
// `@config.uiTrait` from inside a children array.
const schema = {
  orbitals: [
    {
      name: 'ServiceEmailOrbital',
      traits: [
        {
          name: 'Host',
          config: { uiTrait: 'DefaultForm', title: 'Send' },
          stateMachine: {
            transitions: [
              {
                from: 'idle',
                event: 'INIT',
                to: 'idle',
                effects: [['render-ui', 'main', { children: ['@trait.Slot'], type: 'box' }]],
              },
            ],
          },
        },
        {
          name: 'Slot',
          config: {
            children: ['@config.uiTrait'],
            gap: 'md',
            nested: { label: '@config.title', keep: '@config.absent' },
            plain: '@config.title',
          },
          stateMachine: { transitions: [] },
        },
      ],
    },
  ],
} as unknown as OrbitalSchema;

describe('buildResolvedTraitConfigs — deep forward chaining', () => {
  const resolved = buildResolvedTraitConfigs(schema);

  it('chains a forward nested inside an array (the EmailComposerSlot shape)', () => {
    expect(resolved['Slot'].children).toEqual(['DefaultForm']);
  });

  it('chains a forward nested inside an object', () => {
    expect((resolved['Slot'].nested as Record<string, unknown>).label).toBe('Send');
  });

  it('still chains top-level string forwards', () => {
    expect(resolved['Slot'].plain).toBe('Send');
  });

  it('keeps the literal when the referrer lacks the key', () => {
    expect((resolved['Slot'].nested as Record<string, unknown>).keep).toBe('@config.absent');
  });

  it('leaves non-forward values untouched', () => {
    expect(resolved['Slot'].gap).toBe('md');
    expect(resolved['Host'].uiTrait).toBe('DefaultForm');
  });
});
