import { describe, expect, it } from 'vitest';
import { isBrowserOnlyService } from '../src/patterns/index.js';

describe('isBrowserOnlyService', () => {
  it('is true for a service whose only declared runtime is the browser', () => {
    expect(isBrowserOnlyService('analytics')).toBe(true);
    expect(isBrowserOnlyService('page')).toBe(true);
  });

  it('is false for a service that also runs on node, or only on node', () => {
    expect(isBrowserOnlyService('llm')).toBe(false);
    expect(isBrowserOnlyService('knowledge')).toBe(false);
    expect(isBrowserOnlyService('github')).toBe(false);
  });

  it('is false for a name the registry does not declare, or a binding', () => {
    expect(isBrowserOnlyService('no-such-service')).toBe(false);
    expect(isBrowserOnlyService('@config.service')).toBe(false);
    expect(isBrowserOnlyService('')).toBe(false);
  });
});
