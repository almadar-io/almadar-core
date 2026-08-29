import { describe, it, expect } from 'vitest';
import { getOrbAllowedPatterns } from '../src/patterns/helpers/prompt-helpers.js';

// Free-Compose Quality Program (docs/Almadar_Free_Compose_Quality.md):
// the free-mode allowed vocabulary is the single source of truth for the
// rabit FC-2 coherence filter. These pins guard the two user-approved
// widenings: four extra entity-aware exceptions, and the 2D game category.
describe('getOrbAllowedPatterns — free-mode vocabulary', () => {
  const grouped = getOrbAllowedPatterns();
  const names = Object.values(grouped)
    .flat()
    .map((p) => p.name);

  it('includes the four added entity-aware exceptions', () => {
    for (const name of ['table-view', 'filter-group', 'timeline', 'media-gallery']) {
      expect(names).toContain(name);
    }
  });

  it('still includes the original entity-aware exceptions', () => {
    for (const name of ['data-list', 'data-grid', 'search-input', 'form-section', 'meter']) {
      expect(names).toContain(name);
    }
  });

  it('admits the 2D game category (game-shell present, 34 entries)', () => {
    expect(grouped.game).toBeDefined();
    expect(grouped.game.map((p) => p.name)).toContain('game-shell');
    expect(grouped.game.length).toBe(34);
  });

  it('excludes debug and template categories', () => {
    expect(grouped.debug).toBeUndefined();
    expect(grouped.template).toBeUndefined();
  });

  it('excludes any 3D-named pattern', () => {
    for (const name of names) {
      expect(name.includes('3d') || name.includes('3-d')).toBe(false);
    }
  });

  // Re-pinned 2026-08-01 from 100/31/233. The six patterns that drifted, named
  // (registry diff against the commit that wrote the previous pins):
  //   game      +2  draw-group, draw-mesh                  (the draw-mesh 3D substrate)
  //   component +4  emoji-picker, import-preview-tree,
  //                 import-progress, import-source-picker
  // Re-pinned 2026-08-19 from 239:
  //   learning  +1  algo-graph-canvas                      (the algo substrate)
  // Re-pinned 2026-08-21 from 240:
  //   game      +1  draw-fx-layer                          (the fx substrate)
  //   container +1  fx-overlay
  // Nothing was removed or recategorised. A pin bumped without naming the drift
  // is how a real regression gets papered over — keep this list current.
  // Re-pinned 2026-08-29 from 104/40/242 — drift verified PRE-EXISTING at
  // HEAD (identical counts with the HEAD registry), introduced by the
  // 2026-08-28 document-look pass without a pin bump:
  //   component +2  document-panel, rich-text-editor   (the writing surface)
  //   display   -1  document-details                   (left the allowed
  //                 display set when it gained its entity binding)
  it('pins the per-category allowed counts', () => {
    const counts = Object.fromEntries(
      Object.entries(grouped).map(([cat, items]) => [cat, items.length]),
    );
    expect(counts).toMatchObject({
      component: 106,
      display: 39,
      filter: 4,
      form: 10,
      game: 34,
      media: 1,
    });
    expect(names.length).toBe(243);
  });

  it('admits the drifted patterns by name, not just by count', () => {
    for (const name of ['draw-group', 'draw-mesh']) {
      expect(grouped.game.map((p) => p.name)).toContain(name);
    }
    for (const name of [
      'emoji-picker',
      'import-preview-tree',
      'import-progress',
      'import-source-picker',
    ]) {
      expect(grouped.component.map((p) => p.name)).toContain(name);
    }
  });
});
