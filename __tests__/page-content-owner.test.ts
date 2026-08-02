import { describe, it, expect } from 'vitest';
import { collectTraitConfigRefAdjacency } from '../src/embedded-trait-config';
import { isContentMainWriter, resolvePageContentOwner } from '../src/page-content-owner';
import type { OrbitalDefinition, OrbitalPage, Trait } from '../src/types/index';

/**
 * The slot-outlet contract pinned against the four shapes the corpus actually
 * has. Ownership must come from what the page DECLARES — never from a trait's
 * name — because the three `viewer-stranded` drafts that guessed produced 832,
 * 672 and 135 findings respectively, the last still flagging the finished
 * exemplar.
 */

const list = (name: string): Trait => ({
  name,
  stateMachine: {
    initial: 'browsing',
    states: ['browsing'],
    transitions: [
      { from: 'browsing', event: 'INIT', to: 'browsing', effects: [['render-ui', 'main', { type: 'data-grid', entity: '?data' }]] },
    ],
  },
} as unknown as Trait);

const chrome = (name: string, config?: Record<string, unknown>): Trait => ({
  name,
  ...(config ? { config } : {}),
  stateMachine: {
    initial: 'idle',
    states: ['idle'],
    transitions: [
      { from: 'idle', event: 'INIT', to: 'idle', effects: [['render-ui', 'modal', null]] },
    ],
  },
} as unknown as Trait);

function orbitalOf(traits: Trait[]): OrbitalDefinition {
  return { name: 'O', traits } as unknown as OrbitalDefinition;
}

function pageOf(...refs: string[]): OrbitalPage {
  return { name: 'P', path: '/p', traits: refs.map((ref) => ({ ref })) } as unknown as OrbitalPage;
}

function resolve(traits: Trait[], page: OrbitalPage) {
  const orbital = orbitalOf(traits);
  const byName = new Map(traits.map((t) => [t.name, t]));
  return resolvePageContentOwner(page, byName, collectTraitConfigRefAdjacency(orbital));
}

describe('isContentMainWriter', () => {
  it('is true for a content-grade main render and false for a modal-only trait', () => {
    expect(isContentMainWriter(list('Browse'))).toBe(true);
    expect(isContentMainWriter(chrome('Overlay'))).toBe(false);
  });
});

describe('resolvePageContentOwner', () => {
  it('prefers the CHANNEL — the shell designating a body through config', () => {
    // The shell writes nothing itself; it names Catalog via `contentTrait`.
    const shell = chrome('AppLayout', { contentTrait: { default: '@trait.Catalog' } });
    const owner = resolve([shell, list('Catalog')], pageOf('AppLayout', 'Catalog'));
    expect(owner).toEqual({ kind: 'channel', trait: 'Catalog' });
  });

  it('falls back to SOLE-WRITER when no channel designates a body', () => {
    const owner = resolve([chrome('Overlay'), list('Catalog')], pageOf('Overlay', 'Catalog'));
    expect(owner).toEqual({ kind: 'sole-writer', trait: 'Catalog' });
  });

  it('reports AMBIGUOUS rather than picking when two bodies share a page', () => {
    // The `/x/:id` shape: a catalog and a detail view both paint main. Two
    // content bodies on one page is the `unclaimed-main-writer` class — the
    // contract names it and refuses to choose.
    const owner = resolve([list('Catalog'), list('Detail')], pageOf('Catalog', 'Detail'));
    expect(owner).toEqual({ kind: 'ambiguous', candidates: ['Catalog', 'Detail'] });
  });

  it('reports NONE for a page that paints no content body', () => {
    expect(resolve([chrome('Overlay')], pageOf('Overlay'))).toEqual({ kind: 'none' });
  });

  it('reports NONE for a page with no declared traits', () => {
    const page = { name: 'P', path: '/p', traits: [] } as unknown as OrbitalPage;
    expect(resolve([list('Catalog')], page)).toEqual({ kind: 'none' });
  });

  it('follows the channel transitively through a wrapper', () => {
    const shell = chrome('AppLayout', { contentTrait: { default: '@trait.Wrapper' } });
    const wrapper = chrome('Wrapper', { body: { default: '@trait.Catalog' } });
    const owner = resolve([shell, wrapper, list('Catalog')], pageOf('AppLayout'));
    expect(owner).toEqual({ kind: 'channel', trait: 'Catalog' });
  });
});
