import { describe, it, expect } from 'vitest';
import {
    // Zod schemas
    TraitSchema,
    EntitySchema,
    OrbitalSchemaSchema,
    PageSchema,
    FieldSchema,
    StateMachineSchema,
    EffectSchema,
    SExprSchema,
    TraitRefSchema,

    // Parse functions
    parseOrbitalSchema,
    safeParseOrbitalSchema,

    // Type guards

    isSExpr,
    isBinding,
    isSExprCall,
    isInlineTrait,
    getTraitName,
    normalizeTraitRef,

    // Resolver
    schemaToIR,
    clearSchemaCache,
} from '../index';

// ============================================================================
// Shared fixtures
// ============================================================================

/** A minimal valid orbital for use in OrbitalSchemaSchema tests */
const VALID_ORBITAL = {
    name: 'UserOrbital',
    entity: { name: 'User', fields: [{ name: 'name', type: 'string' }] },
    traits: [{ name: 'user-lifecycle' }],
    pages: [{ name: 'UserList', path: '/users' }],
};

// ============================================================================
// Entity Schema
// ============================================================================

describe('EntitySchema', () => {
    it('parses a valid entity', () => {
        const entity = {
            name: 'User',
            fields: [
                { name: 'email', type: 'string', required: true },
                { name: 'age', type: 'number' },
            ],
        };
        const result = EntitySchema.safeParse(entity);
        expect(result.success).toBe(true);
    });

    it('rejects entity without name', () => {
        const entity = { fields: [{ name: 'email', type: 'string' }] };
        const result = EntitySchema.safeParse(entity);
        expect(result.success).toBe(false);
    });

    it('rejects entity without fields', () => {
        const entity = { name: 'User' };
        const result = EntitySchema.safeParse(entity);
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// FieldSchema
// ============================================================================

describe('FieldSchema', () => {
    it('parses all valid field types', () => {
        const types = ['string', 'number', 'boolean', 'date', 'array', 'object', 'timestamp', 'datetime', 'enum'];
        for (const type of types) {
            const result = FieldSchema.safeParse({ name: 'testField', type });
            expect(result.success, `type "${type}" should be valid`).toBe(true);
        }
    });

    it('rejects invalid field type', () => {
        const result = FieldSchema.safeParse({ name: 'testField', type: 'invalid' });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// StateMachineSchema
// ============================================================================

describe('StateMachineSchema', () => {
    it('parses a valid state machine', () => {
        const sm = {
            states: [{ name: 'idle' }, { name: 'active' }],
            events: [{ key: 'START', name: 'Start' }],
            transitions: [{ from: 'idle', event: 'START', to: 'active' }],
        };
        const result = StateMachineSchema.safeParse(sm);
        expect(result.success).toBe(true);
    });

    it('rejects state machine with no states', () => {
        const sm = {
            states: [],
            events: [{ key: 'X', name: 'X' }],
            transitions: [],
        };
        const result = StateMachineSchema.safeParse(sm);
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// TraitSchema
// ============================================================================

describe('TraitSchema', () => {
    it('parses a minimal trait', () => {
        const trait = { name: 'my-trait' };
        const result = TraitSchema.safeParse(trait);
        expect(result.success).toBe(true);
    });

    it('parses a trait with full state machine', () => {
        const trait = {
            name: 'lifecycle',
            category: 'lifecycle',
            linkedEntity: 'User',
            stateMachine: {
                states: [{ name: 'idle' }, { name: 'loading' }],
                events: [{ key: 'FETCH', name: 'Fetch' }],
                transitions: [
                    {
                        from: 'idle',
                        event: 'FETCH',
                        to: 'loading',
                        effects: [['set', '@state.loading', true]],
                    },
                ],
            },
            emits: [{ event: 'DATA_LOADED', scope: 'external' }],
            listens: [{ event: 'REFRESH', triggers: 'FETCH' }],
        };
        const result = TraitSchema.safeParse(trait);
        expect(result.success).toBe(true);
    });

    it('rejects trait without name', () => {
        const result = TraitSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// TraitRef variants
// ============================================================================

describe('TraitRefSchema', () => {
    it('accepts a string ref', () => {
        expect(TraitRefSchema.safeParse('ListBehavior').success).toBe(true);
    });

    it('accepts an object ref', () => {
        expect(TraitRefSchema.safeParse({ ref: 'ListBehavior' }).success).toBe(true);
    });

    it('accepts an inline trait', () => {
        expect(TraitRefSchema.safeParse({ name: 'inline-trait' }).success).toBe(true);
    });

    it('rejects empty string', () => {
        expect(TraitRefSchema.safeParse('').success).toBe(false);
    });
});

// ============================================================================
// Trait helpers
// ============================================================================

describe('Trait helpers', () => {
    it('isInlineTrait identifies inline traits', () => {
        expect(isInlineTrait({ name: 'my-trait' })).toBe(true);
        expect(isInlineTrait({ ref: 'my-trait' })).toBe(false);
        expect(isInlineTrait('my-trait')).toBe(false);
    });

    it('getTraitName extracts name from all ref forms', () => {
        expect(getTraitName('ListBehavior')).toBe('ListBehavior');
        expect(getTraitName({ ref: 'ListBehavior' })).toBe('ListBehavior');
        expect(getTraitName({ name: 'InlineTrait' })).toBe('InlineTrait');
    });

    it('normalizeTraitRef converts all forms to object', () => {
        expect(normalizeTraitRef('List')).toEqual({ ref: 'List' });
        expect(normalizeTraitRef({ ref: 'List', config: { x: 1 } })).toEqual({ ref: 'List', config: { x: 1 } });
        expect(normalizeTraitRef({ name: 'Inline' })).toEqual({ ref: 'Inline' });
    });
});

// ============================================================================
// EffectSchema
// ============================================================================

describe('EffectSchema', () => {
    it('parses S-expression effects', () => {
        const effects = [
            ['set', '@state.loading', true],
            ['emit', 'DATA_LOADED'],
            ['navigate', '/home'],
        ];
        for (const effect of effects) {
            const result = EffectSchema.safeParse(effect);
            expect(result.success, `effect ${JSON.stringify(effect)} should be valid`).toBe(true);
        }
    });
});

// ============================================================================
// SExpr and expression type guards
// ============================================================================

describe('S-Expression type guards', () => {
    it('isSExpr identifies arrays', () => {
        expect(isSExpr(['add', 1, 2])).toBe(true);
        expect(isSExpr('not-an-sexpr')).toBe(false);
        expect(isSExpr(42)).toBe(false);
    });

    it('isBinding identifies @ bindings', () => {
        expect(isBinding('@state.count')).toBe(true);
        expect(isBinding('@entity.name')).toBe(true);
        expect(isBinding('not-a-binding')).toBe(false);
    });

    it('isSExprCall identifies function calls', () => {
        expect(isSExprCall(['add', 1, 2])).toBe(true);
        expect(isSExprCall([1, 2, 3])).toBe(false);
    });
});

// ============================================================================
// OrbitalSchema (top-level app definition)
// ============================================================================

describe('OrbitalSchemaSchema', () => {
    it('parses a minimal app schema', () => {
        const schema = {
            name: 'my-app',
            orbitals: [VALID_ORBITAL],
        };
        const result = OrbitalSchemaSchema.safeParse(schema);
        expect(result.success).toBe(true);
    });

    it('rejects schema with empty orbitals', () => {
        const result = safeParseOrbitalSchema({ name: 'empty', orbitals: [] });
        expect(result.success).toBe(false);
    });

    it('safeParseOrbitalSchema returns error for invalid input', () => {
        const result = safeParseOrbitalSchema({});
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// PageSchema
// ============================================================================

describe('PageSchema', () => {
    it('parses a valid page with minimal fields', () => {
        const page = {
            name: 'Dashboard',
            path: '/dashboard',
        };
        const result = PageSchema.safeParse(page);
        expect(result.success).toBe(true);
    });

    it('parses a page with viewType and traits', () => {
        const page = {
            name: 'Tasks',
            path: '/tasks',
            viewType: 'list',
            traits: [{ ref: 'ListBehavior' }],
        };
        const result = PageSchema.safeParse(page);
        expect(result.success).toBe(true);
    });

    it('rejects page with unknown keys', () => {
        const page = {
            name: 'Broken',
            path: '/broken',
            sections: [{ title: 'should fail' }], // strict rejects this
        };
        const result = PageSchema.safeParse(page);
        expect(result.success).toBe(false);
    });
});



// ============================================================================
// Schema resolver
// ============================================================================

describe('schemaToIR', () => {
    it('resolves a minimal schema to IR', () => {
        clearSchemaCache();
        const schema = {
            name: 'test-app',
            orbitals: [VALID_ORBITAL],
        };
        const ir = schemaToIR(schema as any);
        expect(ir).toBeDefined();
    });
});
