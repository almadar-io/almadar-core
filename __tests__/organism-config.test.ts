/**
 * Organism-scope config across per-orbital files: an app is stored as one
 * `.orb` per orbital, and a trait's `@config.<knob>` forward reads the
 * organism's declared `config` — so each file keeps the knobs its own traits
 * forward, and composing the files back unions them.
 */
import { describe, it, expect } from 'vitest';
import type { DeclaredTraitConfig, OrbitalSchema, TraitRef } from '../src/types/index.js';
import { collectForwardedConfigKeys, filterConfigToForwardedKeys, unionOrganismConfigs } from '../src/embedded-trait-config.js';

const nav = [{ href: '/contacts', label: 'Contacts' }];
const organism: DeclaredTraitConfig = {
  appName: { type: 'string', default: 'CRM' },
  navItems: { type: '[NavItem]', default: nav },
  footer: { type: 'string', default: 'x' },
};

const layout: TraitRef = {
  ref: 'AppShell.traits.AppLayout',
  name: 'ContactAppLayout',
  config: {
    navItems: { type: 'unknown', default: '@config.navItems' },
    appName: { type: 'string', default: 'CRM', forwardedFrom: '@config.appName' },
    searchEvent: { type: 'unknown', default: 'CONTACT_SEARCH' },
  },
};

describe('collectForwardedConfigKeys', () => {
  it('collects the knobs a trait forwards through its default or forwardedFrom', () => {
    expect([...collectForwardedConfigKeys([layout])].sort()).toEqual(['appName', 'navItems']);
  });

  it('ignores literals, nested paths and other bindings', () => {
    const t: TraitRef = { ref: 'A.traits.B', name: 'X', config: {
      a: { type: 'string', default: 'plain' },
      b: { type: 'string', default: '@config.deep.path' },
      c: { type: 'string', default: '@entity.name' },
    } };
    expect([...collectForwardedConfigKeys([t])]).toEqual([]);
  });

  it('ignores string refs and traits without config', () => {
    expect([...collectForwardedConfigKeys(['Plain', { ref: 'A.traits.B', name: 'Y' }])]).toEqual([]);
  });
});

describe('filterConfigToForwardedKeys', () => {
  it('keeps only the forwarded knobs', () => {
    expect(filterConfigToForwardedKeys(organism, new Set(['navItems']))).toEqual({ navItems: organism.navItems });
  });

  it('is undefined when nothing is forwarded', () => {
    expect(filterConfigToForwardedKeys(organism, new Set(['missing']))).toBeUndefined();
  });
});

describe('unionOrganismConfigs', () => {
  const file = (config?: DeclaredTraitConfig): OrbitalSchema => ({ name: 'f', version: '1.0.0', orbitals: [], ...(config ? { config } : {}) });

  it('unions every file\'s config; the first declaration of a knob wins', () => {
    const merged = unionOrganismConfigs([
      file({ navItems: organism.navItems }),
      file({ navItems: { type: '[NavItem]', default: [] }, appName: organism.appName }),
    ]);
    expect(merged).toEqual({ navItems: organism.navItems, appName: organism.appName });
  });

  it('is undefined when no file declares config', () => {
    expect(unionOrganismConfigs([file(), file()])).toBeUndefined();
  });
});
