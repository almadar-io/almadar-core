import { describe, expect, it } from 'vitest';

import { deriveExpectations } from '../src/derive-expectations.js';
import type { OrbitalSchema } from '../src/types/schema.js';
import type { Trait } from '../src/types/trait.js';

/**
 * Derivation fixtures: a 4-orbital schema mirroring the std-ecommerce shape —
 * an identity provider (Customer), a policy-bearing orbital (Product), a
 * cross-orbital writer (Checkout → OrderRecord), a pure provider
 * (OrderRecord), plus a fully self-contained orbital (Standalone).
 */
const customerFields = [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'role', type: 'enum', values: ['customer', 'store-manager'], default: 'customer' },
] as const;

const orderRecordFields = [
    { name: 'id', type: 'string', required: true },
    { name: 'status', type: 'enum', values: ['placed', 'shipped'] },
    { name: 'totalAmount', type: 'number' },
    { name: 'customer', type: 'relation', relation: { entity: 'Customer', cardinality: 'one' } },
] as const;

function buildSchema(): OrbitalSchema {
    const checkoutTrait: Trait = {
        name: 'CheckoutWizard',
        scope: 'instance',
        linkedEntity: 'Checkout',
        stateMachine: {
            states: [{ name: 'editing', isInitial: true }, { name: 'done' }],
            events: [{ key: 'COMPLETE', name: 'Complete' }],
            transitions: [
                {
                    from: 'editing',
                    to: 'done',
                    event: 'COMPLETE',
                    guard: ['=', '@user.id', '@entity.customer'],
                    effects: [
                        ['persist', 'create', 'OrderRecord', { status: 'placed', totalAmount: '@payload.total' }],
                        ['fetch', 'OrderRecord', { include: ['customer'] }],
                        ['persist', 'update', 'Checkout', { done: true }],
                    ],
                },
            ],
        },
    };

    return {
        name: 'fixture-shop',
        orbitals: [
            {
                name: 'CustomerOrbital',
                entity: {
                    name: 'Customer',
                    identity: true,
                    fields: customerFields.map((f) => ({ ...f })),
                },
                traits: [],
                pages: [],
            },
            {
                name: 'ProductOrbital',
                entity: {
                    name: 'Product',
                    fields: [
                        { name: 'id', type: 'string', required: true },
                        { name: 'title', type: 'string' },
                        { name: 'owner', type: 'relation', relation: { entity: 'Customer', cardinality: 'one' } },
                    ],
                    create_policy: ['=', '@user.role', 'store-manager'],
                },
                traits: [],
                pages: [],
            },
            {
                name: 'CheckoutOrbital',
                entity: {
                    name: 'Checkout',
                    fields: [
                        { name: 'id', type: 'string', required: true },
                        { name: 'customer', type: 'string' },
                    ],
                },
                traits: [checkoutTrait],
                pages: [],
            },
            {
                name: 'OrderRecordOrbital',
                entity: {
                    name: 'OrderRecord',
                    fields: orderRecordFields.map((f) => ({ ...f })),
                    read_policy: ['=', '@user.role', 'store-manager'],
                },
                traits: [],
                pages: [],
            },
            {
                name: 'StandaloneOrbital',
                entity: {
                    name: 'Note',
                    fields: [
                        { name: 'id', type: 'string', required: true },
                        { name: 'text', type: 'string' },
                    ],
                },
                traits: [],
                pages: [],
            },
        ],
    };
}

describe('deriveExpectations', () => {
    it('derives an identity expectation from a policy `@user.role` read, field copied verbatim', () => {
        const { expectations, diagnostics } = deriveExpectations(buildSchema(), 'ProductOrbital');
        expect(diagnostics).toEqual([]);

        const identity = expectations.find((e) => e.kind === 'identity');
        expect(identity).toBeDefined();
        expect(identity?.kind === 'identity' && identity.name).toBe('Customer');
        const shape = identity?.kind === 'identity' ? identity.shape : undefined;
        expect(shape).toEqual([
            { name: 'role', type: 'enum', values: ['customer', 'store-manager'], default: 'customer' },
        ]);
    });

    it('derives an existence-only entity expectation from an opaque relation field', () => {
        const { expectations } = deriveExpectations(buildSchema(), 'ProductOrbital');
        const customer = expectations.find((e) => e.kind === 'entity' && e.name === 'Customer');
        expect(customer).toBeDefined();
        expect(customer?.kind === 'entity' && 'shape' in customer && customer.shape !== undefined).toBe(false);
    });

    it('copies persist payload + fetch include field types from the provider, and reads @user in guards', () => {
        const { expectations, diagnostics } = deriveExpectations(buildSchema(), 'CheckoutOrbital');
        expect(diagnostics).toEqual([]);

        const identity = expectations.find((e) => e.kind === 'identity');
        expect(identity?.kind === 'identity' && identity.name).toBe('Customer');
        expect(identity?.kind === 'identity' && identity.shape).toEqual([
            { name: 'id', type: 'string', required: true },
        ]);

        const order = expectations.find((e) => e.kind === 'entity' && e.name === 'OrderRecord');
        expect(order?.kind === 'entity' && order.shape).toEqual([
            { name: 'customer', type: 'relation', relation: { entity: 'Customer', cardinality: 'one' } },
            { name: 'status', type: 'enum', values: ['placed', 'shipped'] },
            { name: 'totalAmount', type: 'number' },
        ]);
    });

    it('never emits an expectation for the orbital’s own entity', () => {
        const { expectations } = deriveExpectations(buildSchema(), 'CheckoutOrbital');
        expect(expectations.some((e) => e.kind === 'entity' && e.name === 'Checkout')).toBe(false);
    });

    it('emits nothing for an orbital with no cross-boundary usage', () => {
        const { expectations, diagnostics } = deriveExpectations(buildSchema(), 'StandaloneOrbital');
        expect(expectations).toEqual([]);
        expect(diagnostics).toEqual([]);
    });

    it('OrderRecordOrbital reads @user.role in a policy but holds no sibling usage besides its relation', () => {
        const { expectations } = deriveExpectations(buildSchema(), 'OrderRecordOrbital');
        const kinds = expectations.map((e) => (e.kind === 'entity' ? `entity:${e.name}` : 'identity'));
        expect(kinds).toEqual(['identity', 'entity:Customer']);
    });

    it('reports a diagnostic and omits the shape entry when the provider does not declare the field', () => {
        const schema = buildSchema();
        const checkout = schema.orbitals.find((o) => o.name === 'CheckoutOrbital');
        const trait = checkout?.traits[0];
        if (trait === undefined || typeof trait === 'string' || !('stateMachine' in trait)) {
            throw new Error('fixture broken');
        }
        trait.stateMachine?.transitions[0].effects?.push(
            ['persist', 'create', 'OrderRecord', { bogusField: 1 }],
            ['set', '@entity.customer', '@user.avatar'],
        );

        const { expectations, diagnostics } = deriveExpectations(schema, 'CheckoutOrbital');

        const order = expectations.find((e) => e.kind === 'entity' && e.name === 'OrderRecord');
        const orderFields = order?.kind === 'entity' ? order.shape?.map((f) => f.name) : undefined;
        expect(orderFields).not.toContain('bogusField');

        const identity = expectations.find((e) => e.kind === 'identity');
        const identityFields = identity?.kind === 'identity' ? identity.shape?.map((f) => f.name) : undefined;
        expect(identityFields).not.toContain('avatar');

        expect(diagnostics).toEqual([
            { kind: 'identity-field-not-declared', orbital: 'CheckoutOrbital', entity: 'Customer', field: 'avatar' },
            { kind: 'entity-field-not-declared', orbital: 'CheckoutOrbital', entity: 'OrderRecord', field: 'bogusField' },
        ]);
    });

    it('derives an existence-only entity expectation from a cross-orbital linkedEntity', () => {
        const schema = buildSchema();
        const standalone = schema.orbitals.find((o) => o.name === 'StandaloneOrbital');
        standalone?.traits.push({
            name: 'NoteOnCustomer',
            scope: 'instance',
            linkedEntity: 'Customer',
        });

        const { expectations } = deriveExpectations(schema, 'StandaloneOrbital');
        expect(expectations).toEqual([{ kind: 'entity', name: 'Customer' }]);
    });

    it('returns an unknown-orbital diagnostic for a name not in the schema', () => {
        const { expectations, diagnostics } = deriveExpectations(buildSchema(), 'NoSuchOrbital');
        expect(expectations).toEqual([]);
        expect(diagnostics).toEqual([{ kind: 'unknown-orbital', orbital: 'NoSuchOrbital' }]);
    });

    it('derives an identity expectation from a `@user.*` config default on a trait (G-EXPECT-DERIVE-CONFIG)', () => {
        const schema = buildSchema();
        const product = schema.orbitals.find((o) => o.name === 'ProductOrbital');
        product?.traits.push({
            name: 'ProductAppLayout',
            scope: 'instance',
            linkedEntity: 'Product',
            config: {
                viewerName: { type: 'string', default: '@user.name' },
                appName: { type: 'string', default: 'Shop' },
            },
        });

        const { expectations, diagnostics } = deriveExpectations(schema, 'ProductOrbital');
        expect(diagnostics).toEqual([]);
        const identity = expectations.find((e) => e.kind === 'identity');
        const fields = identity?.kind === 'identity' ? identity.shape?.map((f) => f.name) : undefined;
        expect(fields).toEqual(['name', 'role']);
    });

    it('does not mutate the schema and copies shape fields by value', () => {
        const schema = buildSchema();
        const { expectations } = deriveExpectations(schema, 'ProductOrbital');
        const identity = expectations.find((e) => e.kind === 'identity');
        if (identity?.kind === 'identity' && identity.shape !== undefined) {
            identity.shape[0].name = 'MUTATED';
        }
        const customer = schema.orbitals.find((o) => o.name === 'CustomerOrbital');
        const roleField =
            typeof customer?.entity === 'object' && 'fields' in customer.entity
                ? customer.entity.fields.find((f) => f.type === 'enum')
                : undefined;
        expect(roleField?.name).toBe('role');
    });
});
