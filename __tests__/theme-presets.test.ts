import { describe, it, expect } from 'vitest';
import { THEME_PRESETS } from '../src/themes/index.js';
import { ThemeDefinitionSchema } from '../src/types/domain.js';

describe('THEME_PRESETS', () => {
  it('has one entry per migrated preset, keyed by its theme name', () => {
    expect(Object.keys(THEME_PRESETS).length).toBe(23);
    for (const [key, def] of Object.entries(THEME_PRESETS)) {
      expect(def.name).toBe(key);
    }
  });

  it('every preset validates against ThemeDefinitionSchema', () => {
    for (const [key, def] of Object.entries(THEME_PRESETS)) {
      const result = ThemeDefinitionSchema.safeParse(def);
      expect(result.success, `${key}: ${result.success ? '' : JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it('includes the well-known built-in presets', () => {
    for (const key of ['minimalist', 'clay', 'glass', 'wireframe', 'trait-wars']) {
      expect(THEME_PRESETS[key]).toBeDefined();
    }
  });

  it('dark-only game presets carry their tokens under variants.dark, not the base tokens', () => {
    for (const key of ['game-adventure', 'game-rpg', 'game-sci-fi', 'game-ui-pack']) {
      const def = THEME_PRESETS[key];
      expect(def, key).toBeDefined();
      expect(def!.tokens).toEqual({});
      expect(def!.variants?.dark).toBeDefined();
    }
  });

  it('light+dark presets carry populated colors on both tokens and variants.dark', () => {
    const def = THEME_PRESETS.minimalist!;
    expect(def.tokens.colors?.primary).toBeTruthy();
    expect(def.variants?.dark?.colors?.primary).toBeTruthy();
    expect(def.tokens.colors?.primary).not.toBe(def.variants?.dark?.colors?.primary);
  });
});
