import { describe, expect, it } from 'vitest';

import { OrbitalDefinitionSchema } from '../src/types/orbital.js';

/**
 * `z.object()` STRIPS unknown keys rather than rejecting them (the trap
 * documented in schema.ts), so `expects` must exist on BOTH the type and the
 * zod schema or it silently vanishes on the interpreter path. These tests are
 * the guard — the same pattern as identity-entity-tag.test.ts.
 * See docs/Almadar_LOLO_Expects_Proposal.md (E1).
 */
describe('orbital expects declarations survive the zod parse', () => {
    const base = {
        name: 'ProductOrbital',
        entity: { name: 'Product', fields: [{ name: 'id', type: 'string', required: true }] },
        traits: [],
        pages: [],
    };

    const expects = [
        {
            kind: 'identity',
            name: 'Customer',
            shape: [
                {
                    name: 'role',
                    type: 'enum',
                    values: ['store-manager', 'operations-director'],
                    required: true,
                },
            ],
        },
        {
            kind: 'entity',
            name: 'OrderRecord',
            shape: [
                { name: 'status', type: 'enum', values: ['placed', 'shipped', 'delivered'] },
                { name: 'totalAmount', type: 'number' },
            ],
        },
        { kind: 'entity', name: 'CartItem' },
        { kind: 'event', traitName: 'Checkout', event: 'ORDER_PLACED' },
    ];

    it('preserves all three kinds, typed shapes included', () => {
        const parsed = OrbitalDefinitionSchema.parse({ ...base, expects });
        expect(parsed.expects).toHaveLength(4);

        const [identity, order, cart, event] = parsed.expects!;
        expect(identity).toMatchObject({ kind: 'identity', name: 'Customer' });
        expect(identity.kind === 'identity' && identity.shape?.[0]).toMatchObject({
            name: 'role',
            type: 'enum',
            values: ['store-manager', 'operations-director'],
        });
        expect(order).toMatchObject({ kind: 'entity', name: 'OrderRecord' });
        expect(cart).toMatchObject({ kind: 'entity', name: 'CartItem' });
        expect('shape' in cart && cart.shape !== undefined).toBe(false);
        expect(event).toMatchObject({ kind: 'event', traitName: 'Checkout', event: 'ORDER_PLACED' });
    });

    it('leaves expects absent when not declared (no key invented)', () => {
        const parsed = OrbitalDefinitionSchema.parse(base);
        expect('expects' in parsed).toBe(false);
    });

    it('rejects a malformed declaration (unknown kind)', () => {
        expect(() =>
            OrbitalDefinitionSchema.parse({ ...base, expects: [{ kind: 'service', name: 'X' }] }),
        ).toThrow();
    });

    it('round-trips through JSON without loss', () => {
        const parsed = OrbitalDefinitionSchema.parse({ ...base, expects });
        const reparsed = OrbitalDefinitionSchema.parse(JSON.parse(JSON.stringify(parsed)));
        expect(reparsed.expects).toEqual(parsed.expects);
    });
});
