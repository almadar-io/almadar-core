import { describe, expect, it } from 'vitest';
import { SYSTEM_UI_EVENTS, isSystemUiEvent } from '../src/types/bus.js';

describe('isSystemUiEvent', () => {
  it('names NAVIGATE as host-level', () => {
    expect(SYSTEM_UI_EVENTS).toContain('NAVIGATE');
    expect(isSystemUiEvent('NAVIGATE')).toBe(true);
  });

  it('control: trait events and near-misses are not host-level', () => {
    expect(isSystemUiEvent('CREATE')).toBe(false);
    expect(isSystemUiEvent('navigate')).toBe(false);
    expect(isSystemUiEvent('NAVIGATE_BACK')).toBe(false);
    expect(isSystemUiEvent('')).toBe(false);
  });
});
