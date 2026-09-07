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

const noteEntity = { name: 'Note', persistence: 'runtime' as const, fields: [{ name: 'id', type: 'string' as const, required: true }] };
const emptyStateMachine = { states: [], events: [] };

// Host embeds Slot via `@trait.Slot` in its state machine; Slot forwards
// `@config.uiTrait` from inside a children array.
const schema: OrbitalSchema = {
  name: 'ServiceEmailApp',
  designTokens: {},
  customPatterns: {},
  orbitals: [
    {
      name: 'ServiceEmailOrbital',
      entity: noteEntity,
      pages: [],
      traits: [
        {
          name: 'Host',
          scope: 'instance',
          config: {
            uiTrait: { type: 'string', default: 'DefaultForm' },
            title: { type: 'string', default: 'Send' },
          },
          stateMachine: {
            ...emptyStateMachine,
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
          scope: 'instance',
          config: {
            children: { type: 'array', default: ['@config.uiTrait'] },
            gap: { type: 'string', default: 'md' },
            nested: { type: 'object', default: { label: '@config.title', keep: '@config.absent' } },
            plain: { type: 'string', default: '@config.title' },
          },
          stateMachine: { ...emptyStateMachine, transitions: [] },
        },
      ],
    },
  ],
};

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

// W2-J1: two rungs below the referrer chain — the trait's owning orbital's
// declared `config {}` defaults, then the schema's. Each rung only fires on
// a key the previous rung left as a literal `@config.<key>` forward.
describe('buildResolvedTraitConfigs — orbital + schema config rungs', () => {
  it('forwards to orbital.config when no referrer declares the knob', () => {
    const orbitalConfigSchema: OrbitalSchema = {
      name: 'OrbitalConfigApp',
      designTokens: {},
      customPatterns: {},
      orbitals: [
        {
          name: 'Orb',
          entity: noteEntity,
          pages: [],
          config: { title: { type: 'string', default: 'FromOrbital' } },
          traits: [
            {
              name: 'Lone',
              scope: 'instance',
              config: { plain: { type: 'string', default: '@config.title' } },
              stateMachine: { ...emptyStateMachine, transitions: [] },
            },
          ],
        },
      ],
    };

    const resolved = buildResolvedTraitConfigs(orbitalConfigSchema);
    expect(resolved['Lone'].plain).toBe('FromOrbital');
  });

  it('falls to schema.config when neither trait nor orbital declares the knob', () => {
    const schemaConfigSchema: OrbitalSchema = {
      name: 'SchemaConfigApp',
      designTokens: {},
      customPatterns: {},
      config: { title: { type: 'string', default: 'FromSchema' } },
      orbitals: [
        {
          name: 'Orb',
          entity: noteEntity,
          pages: [],
          traits: [
            {
              name: 'Lone',
              scope: 'instance',
              config: { plain: { type: 'string', default: '@config.title' } },
              stateMachine: { ...emptyStateMachine, transitions: [] },
            },
          ],
        },
      ],
    };

    const resolved = buildResolvedTraitConfigs(schemaConfigSchema);
    expect(resolved['Lone'].plain).toBe('FromSchema');
  });

  it('embedder rung still wins over orbital.config and schema.config', () => {
    const layeredSchema: OrbitalSchema = {
      name: 'LayeredConfigApp',
      designTokens: {},
      customPatterns: {},
      config: { title: { type: 'string', default: 'FromSchema' } },
      orbitals: [
        {
          name: 'Orb',
          entity: noteEntity,
          pages: [],
          config: { title: { type: 'string', default: 'FromOrbital' } },
          traits: [
            {
              name: 'Host',
              scope: 'instance',
              config: { title: { type: 'string', default: 'FromEmbedder' } },
              stateMachine: {
                ...emptyStateMachine,
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
              scope: 'instance',
              config: { plain: { type: 'string', default: '@config.title' } },
              stateMachine: { ...emptyStateMachine, transitions: [] },
            },
          ],
        },
      ],
    };

    const resolved = buildResolvedTraitConfigs(layeredSchema);
    expect(resolved['Slot'].plain).toBe('FromEmbedder');
  });
});
