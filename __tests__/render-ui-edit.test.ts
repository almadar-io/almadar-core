/**
 * Coverage of the empty-transition anchoring fix in `findRenderUiRoot`
 * (gap CE-G1). Canvas selections at L1/INIT carry no `data-orb-transition`,
 * so a patch address arrives with `transition: ''`. Before the fix the
 * exact-match loop (`if (t.event !== address.transition) continue`) could
 * never match an empty string, the patch fell through to `stale`, and the
 * edit silently did not apply. The fix falls back to the first transition
 * whose effects render-ui on the addressed slot. These tests pin both the
 * empty-transition fallback and the preserved exact-match behavior.
 */

import { describe, it, expect } from 'vitest';

import {
  applyRenderOverlay,
  type PatternNode,
  type RenderUiPatch,
} from '../src/render-ui-edit.js';
import type { OrbitalDefinition } from '../src/types/orbital.js';
import type { Trait } from '../src/types/trait.js';
import type { Transition } from '../src/types/state-machine.js';
import type { Effect } from '../src/types/effect.js';

function chartEffect(slot: 'main' | 'sidebar', chartType: string): Effect {
  return ['render-ui', slot, { type: 'chart', chartType }];
}

function renderTransition(
  from: string,
  event: string,
  effects: Effect[],
): Transition {
  return { from, to: from, event, effects };
}

function trait(name: string, transitions: Transition[]): Trait {
  return {
    name,
    scope: 'instance',
    stateMachine: {
      states: Array.from(new Set(transitions.map((t) => t.from))).map((name) => ({ name })),
      events: Array.from(new Set(transitions.map((t) => t.event))).map((key) => ({
        key,
        name: key,
      })),
      transitions,
    },
  };
}

function orbital(traitDef: Trait): OrbitalDefinition {
  return {
    name: 'BurndownOrbital',
    entity: { name: 'Point', persistence: 'runtime', fields: [{ name: 'id', type: 'string' }] },
    traits: [traitDef],
    pages: [],
  };
}

/** The pattern config placed at index 2 of a render-ui effect (post-overlay). */
function renderedNode(t: Trait, transitionIndex: number, effectIndex = 0): unknown {
  return t.stateMachine?.transitions[transitionIndex].effects?.[effectIndex]?.[2];
}

const swapToBar: PatternNode = { type: 'chart', chartType: 'bar' };

describe('findRenderUiRoot empty-transition anchoring (CE-G1)', () => {
  it('anchors an empty-transition patch to the slot render-ui and applies it', () => {
    const t = trait('BurndownChart', [
      renderTransition('idle', 'INIT', [chartEffect('main', 'line')]),
    ]);
    const def = orbital(t);

    const patch: RenderUiPatch = {
      op: 'replace',
      address: { trait: 'BurndownChart', transition: '', slot: 'main', path: 'root' },
      node: swapToBar,
    };

    const result = applyRenderOverlay(def, [patch]);

    expect(result.applied).toBe(1);
    expect(result.stale).toHaveLength(0);
    expect(renderedNode(t, 0)).toMatchObject({ chartType: 'bar' });
  });

  it('falls back to the first slot render-ui when the transition is unknown', () => {
    const t = trait('BurndownChart', [
      renderTransition('loading', 'LOADED', [chartEffect('main', 'line')]),
      renderTransition('loading', 'REFRESH', [chartEffect('main', 'line')]),
    ]);
    const def = orbital(t);

    const result = applyRenderOverlay(def, [
      {
        op: 'replace',
        address: { trait: 'BurndownChart', transition: '', slot: 'main', path: 'root' },
        node: swapToBar,
      },
    ]);

    expect(result.applied).toBe(1);
    expect(renderedNode(t, 0)).toMatchObject({ chartType: 'bar' });
  });

  it('still prefers the EXACT transition match when transition is provided', () => {
    const t = trait('BurndownChart', [
      renderTransition('loading', 'LOADED', [chartEffect('main', 'line')]),
      renderTransition('loading', 'REFRESH', [chartEffect('main', 'area')]),
    ]);
    const def = orbital(t);

    const result = applyRenderOverlay(def, [
      {
        op: 'replace',
        address: { trait: 'BurndownChart', transition: 'REFRESH', slot: 'main', path: 'root' },
        node: swapToBar,
      },
    ]);

    expect(result.applied).toBe(1);
    expect(renderedNode(t, 0)).toMatchObject({ chartType: 'line' });
    expect(renderedNode(t, 1)).toMatchObject({ chartType: 'bar' });
  });

  it('respects the slot filter in the empty-transition fallback', () => {
    const t = trait('BurndownChart', [
      renderTransition('idle', 'INIT', [chartEffect('sidebar', 'legend')]),
      renderTransition('idle', 'INIT', [chartEffect('main', 'line')]),
    ]);
    const def = orbital(t);

    const result = applyRenderOverlay(def, [
      {
        op: 'replace',
        address: { trait: 'BurndownChart', transition: '', slot: 'main', path: 'root' },
        node: swapToBar,
      },
    ]);

    expect(result.applied).toBe(1);
    expect(renderedNode(t, 0)).toMatchObject({ chartType: 'legend' });
    expect(renderedNode(t, 1)).toMatchObject({ chartType: 'bar' });
  });

  it('respects a non-empty state filter alongside the empty-transition fallback', () => {
    const t = trait('BurndownChart', [
      renderTransition('error', 'INIT', [chartEffect('main', 'errorcard')]),
      renderTransition('idle', 'INIT', [chartEffect('main', 'line')]),
    ]);
    const def = orbital(t);

    const result = applyRenderOverlay(def, [
      {
        op: 'replace',
        address: { trait: 'BurndownChart', transition: '', state: 'idle', slot: 'main', path: 'root' },
        node: swapToBar,
      },
    ]);

    expect(result.applied).toBe(1);
    expect(renderedNode(t, 0)).toMatchObject({ chartType: 'errorcard' });
    expect(renderedNode(t, 1)).toMatchObject({ chartType: 'bar' });
  });

  it('reports stale when no slot render-ui exists for the trait', () => {
    const t = trait('BurndownChart', [
      renderTransition('idle', 'INIT', [chartEffect('main', 'line')]),
    ]);
    const def = orbital(t);

    const result = applyRenderOverlay(def, [
      {
        op: 'replace',
        address: { trait: 'BurndownChart', transition: '', slot: 'sidebar', path: 'root' },
        node: swapToBar,
      },
    ]);

    expect(result.applied).toBe(0);
    expect(result.stale).toHaveLength(1);
  });
});
