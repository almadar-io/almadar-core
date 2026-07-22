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

  it('admits the 2D game category (game-shell present, 31 entries)', () => {
    expect(grouped.game).toBeDefined();
    expect(grouped.game.map((p) => p.name)).toContain('game-shell');
    expect(grouped.game.length).toBe(31);
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

  it('pins the per-category allowed counts', () => {
    const counts = Object.fromEntries(
      Object.entries(grouped).map(([cat, items]) => [cat, items.length]),
    );
    expect(counts).toMatchObject({
      component: 100,
      display: 40,
      filter: 4,
      form: 10,
      game: 31,
      media: 1,
    });
    expect(names.length).toBe(233);
  });
});
