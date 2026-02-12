/**
 * Tests for domain-language/registry.ts
 *
 * Pure logic tests for field type, effect, and guard registries.
 */
import { describe, it, expect } from 'vitest';
import {
    FIELD_TYPE_REGISTRY,
    EFFECT_REGISTRY,
    GUARD_REGISTRY,
    getRegistryStats,
} from '../src/domain-language/registry.js';

describe('FIELD_TYPE_REGISTRY', () => {
    it('contains expected field types', () => {
        const types = Object.keys(FIELD_TYPE_REGISTRY);
        expect(types).toContain('string');
        expect(types).toContain('number');
        expect(types).toContain('boolean');
        expect(types).toContain('date');
        expect(types).toContain('enum');
        expect(types).toContain('relation');
        expect(types).toContain('array');
    });

    it('each entry has schemaType, domainKeywords, format, and parse', () => {
        for (const [key, entry] of Object.entries(FIELD_TYPE_REGISTRY)) {
            expect(entry.schemaType).toBe(key);
            expect(Array.isArray(entry.domainKeywords)).toBe(true);
            expect(entry.domainKeywords.length).toBeGreaterThan(0);
            expect(typeof entry.format).toBe('function');
            expect(typeof entry.parse).toBe('function');
        }
    });

    it('format produces readable text for string type', () => {
        const result = FIELD_TYPE_REGISTRY['string'].format({ type: 'string' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('format handles enum with values', () => {
        const result = FIELD_TYPE_REGISTRY['enum'].format({
            type: 'enum',
            values: ['red', 'green', 'blue'],
        });
        expect(result).toContain('red');
        expect(result).toContain('green');
        expect(result).toContain('blue');
    });

    it('format handles relation with entity', () => {
        const result = FIELD_TYPE_REGISTRY['relation'].format({
            type: 'relation',
            relation: { entity: 'User' },
        });
        expect(result).toContain('User');
    });

    it('parse returns the schema type string', () => {
        expect(FIELD_TYPE_REGISTRY['string'].parse('text')).toBe('string');
        expect(FIELD_TYPE_REGISTRY['number'].parse('number')).toBe('number');
        expect(FIELD_TYPE_REGISTRY['boolean'].parse('yes/no')).toBe('boolean');
    });
});

describe('EFFECT_REGISTRY', () => {
    it('contains expected effects', () => {
        const effects = Object.keys(EFFECT_REGISTRY);
        expect(effects).toContain('set');
        expect(effects).toContain('emit');
        expect(effects).toContain('render-ui');
        expect(effects).toContain('persist');
        expect(effects).toContain('navigate');
    });

    it('each entry has operator, domainPatterns, description', () => {
        for (const [key, entry] of Object.entries(EFFECT_REGISTRY)) {
            expect(entry.operator).toBe(key);
            expect(Array.isArray(entry.domainPatterns)).toBe(true);
            expect(entry.domainPatterns.length).toBeGreaterThan(0);
            expect(typeof entry.description).toBe('string');
        }
    });
});

describe('GUARD_REGISTRY', () => {
    it('contains comparison operators', () => {
        const guards = Object.keys(GUARD_REGISTRY);
        expect(guards).toContain('=');
        expect(guards).toContain('!=');
        expect(guards).toContain('<');
        expect(guards).toContain('>');
    });

    it('contains logical operators', () => {
        const guards = Object.keys(GUARD_REGISTRY);
        expect(guards).toContain('and');
        expect(guards).toContain('or');
        expect(guards).toContain('not');
    });
});

describe('getRegistryStats', () => {
    it('returns counts for all registries', () => {
        const stats = getRegistryStats();
        expect(stats.fieldTypes).toBeGreaterThan(0);
        expect(stats.effects).toBeGreaterThan(0);
        expect(stats.guards).toBeGreaterThan(0);
    });
});
