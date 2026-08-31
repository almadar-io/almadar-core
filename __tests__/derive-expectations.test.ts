import { describe, expect, it } from 'vitest';

import { deriveExpectations } from '../src/derive-expectations.js';
import type { OrbitalSchema } from '../src/types/schema.js';
import type { EntityField } from '../src/types/field.js';
import type { Trait } from '../src/types/trait.js';

/**
 * Derivation fixtures: a 4-orbital schema mirroring the std-ecommerce shape —
 * an identity provider (Customer), a policy-bearing orbital (Product), a
 * cross-orbital writer (Checkout → OrderRecord), a pure provider
 * (OrderRecord), plus a fully self-contained orbital (Standalone).
 */
const customerFields: EntityField[] = [
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'role', type: 'enum', values: ['customer', 'store-manager'], default: 'customer' },
];

const orderRecordFields: EntityField[] = [
    { name: 'id', type: 'string', required: true },
    { name: 'status', type: 'enum', values: ['placed', 'shipped'] },
    { name: 'totalAmount', type: 'number' },
    { name: 'customer', type: 'relation', relation: { entity: 'Customer', cardinality: 'one' } },
];

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

    it('folds a relation ref targeting the [identity] entity into the identity expectation — never a duplicate declaration', () => {
        // ProductOrbital reads `@user.role` (identity) AND its `owner` field is
        // a relation to Customer, the [identity] entity. One name gets ONE
        // declaration: the relation ref merges into `expects identity Customer`
        // (duplicates are ELOLO_DUPLICATE_EXPECTATION downstream, and the named
        // identity declaration carries relation-target resolution — §5.1).
        const { expectations } = deriveExpectations(buildSchema(), 'ProductOrbital');
        expect(expectations.some((e) => e.kind === 'entity' && e.name === 'Customer')).toBe(false);
        const identity = expectations.find((e) => e.kind === 'identity');
        expect(identity?.kind === 'identity' && identity.name).toBe('Customer');
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
        // The `customer` relation targets the [identity] entity, so it merges
        // into the identity expectation rather than a second declaration.
        expect(kinds).toEqual(['identity']);
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
                ? customer.entity.fields?.find((f) => f.type === 'enum')
                : undefined;
        expect(roleField?.name).toBe('role');
    });
    // `expects page` — the route arm. Derivation is the only place with both
    // halves: the consumer's navigate PREFIX and the provider's page PATTERN.
    describe('page expectations', () => {
        function schemaWithRoutes(navTarget: unknown): OrbitalSchema {
            const schema = buildSchema();
            const orderRecord = schema.orbitals.find((o) => o.name === 'OrderRecordOrbital');
            const checkout = schema.orbitals.find((o) => o.name === 'CheckoutOrbital');
            if (orderRecord === undefined || checkout === undefined) throw new Error('fixture');
            orderRecord.pages = [{ name: 'OrderDetailPage', path: '/orders/:id', traits: [] }];
            checkout.pages = [{ name: 'CheckoutPage', path: '/checkout', traits: [] }];
            const trait = checkout.traits[0];
            if (trait === undefined || typeof trait === 'string' || !('stateMachine' in trait)) {
                throw new Error('fixture must carry an inline trait');
            }
            const transition = trait.stateMachine?.transitions?.[0];
            if (transition === undefined) throw new Error('fixture must carry a transition');
            transition.effects = [['navigate', navTarget] as never];
            return schema;
        }

        function pagePaths(schema: OrbitalSchema, orbital: string): string[] {
            return deriveExpectations(schema, orbital)
                .expectations.filter((e) => e.kind === 'page')
                .map((e) => (e.kind === 'page' ? e.path : ''));
        }

        it("resolves a dynamic navigate's static prefix to the sibling's route pattern", () => {
            // `/orders/` is all the effect carries; `/orders/:id` is what the
            // provider declares. Supplying the pattern is the whole point.
            const schema = schemaWithRoutes(['str/concat', '/orders/', '@payload.data.id']);
            expect(pagePaths(schema, 'CheckoutOrbital')).toEqual(['/orders/:id']);
        });

        it('prefers the parameterised route over its collection page', () => {
            // Both `/orders` and `/orders/:id` are declared and both satisfy the
            // compiler (its matcher drops empty segments, so `/orders/` and
            // `/orders` look identical). Only `/orders/:id` is the route the
            // navigate actually reaches, and a declaration that names the wrong
            // route is worse than useless.
            const schema = schemaWithRoutes(['str/concat', '/orders/', '@payload.data.id']);
            const orderRecord = schema.orbitals.find((o) => o.name === 'OrderRecordOrbital');
            if (orderRecord === undefined) throw new Error('fixture');
            orderRecord.pages = [
                { name: 'OrdersPage', path: '/orders', traits: [] },
                { name: 'OrderDetailPage', path: '/orders/:id', traits: [] },
            ];
            expect(pagePaths(schema, 'CheckoutOrbital')).toEqual(['/orders/:id']);
        });

        it('derives nothing for a route the organism does not declare', () => {
            // Keeps a genuine typo an error rather than laundering it into a
            // deferral.
            const schema = schemaWithRoutes(['str/concat', '/ordrs/', '@payload.data.id']);
            expect(pagePaths(schema, 'CheckoutOrbital')).toEqual([]);
        });

        it('derives nothing for a route the orbital declares itself', () => {
            const schema = schemaWithRoutes('/checkout');
            expect(pagePaths(schema, 'CheckoutOrbital')).toEqual([]);
        });

        it('derives nothing for a fully dynamic target', () => {
            // `@payload.href` is runtime data — undecidable statically, and the
            // compiler skips it too.
            const schema = schemaWithRoutes('@payload.href');
            expect(pagePaths(schema, 'CheckoutOrbital')).toEqual([]);
        });
    });
});

/**
 * Atom-contributed entities (SCAN-FETCH-INVALID-ENTITY-1).
 *
 * An imported atom's entity is a real entity of the COMPOSED program — the
 * compiler surfaces it into the composing orbital's `auxiliaryEntities` during
 * inline (Gap #22, `inline/mod.rs:863-894`) — but it is absent from the
 * pre-inline schema. A sibling that persists/fetches one must still be able to
 * declare the dependency, or its slice cannot validate alone.
 */
describe('deriveExpectations — atom-contributed entities', () => {
    /** A stand-in for `std-mod-queue`: one orbital, one trait, one aux entity. */
    const modQueueBehavior: OrbitalSchema = {
        name: 'std-mod-queue',
        orbitals: [
            {
                name: 'ModQueueItemOrbital',
                entity: {
                    name: 'ModQueueItem',
                    fields: [{ name: 'id', type: 'string', required: true }],
                },
                auxiliaryEntities: [
                    { name: 'ModQueueAudit', fields: [{ name: 'id', type: 'string', required: true }] },
                ],
                traits: [
                    {
                        name: 'ModQueueItemReview',
                        scope: 'instance',
                        linkedEntity: 'ModQueueItem',
                        stateMachine: {
                            states: [{ name: 'idle', isInitial: true }],
                            events: [{ key: 'OPEN', name: 'Open' }],
                            transitions: [{ from: 'idle', to: 'idle', event: 'OPEN' }],
                        },
                    },
                ],
                pages: [],
            },
        ],
    };

    const loadBehavior = (name: string): OrbitalSchema | null =>
        name === 'std-mod-queue' ? modQueueBehavior : null;

    /**
     * `WriterOrbital` persists `ModQueueItem` but declares no such entity.
     * `HostOrbital` composes the atom's trait — `rebindTo` decides whether it
     * rebinds `linkedEntity`, which is the exact gate `inline/mod.rs:872` uses.
     */
    function schemaComposing(rebindTo?: string): OrbitalSchema {
        return {
            name: 'fixture-forum',
            orbitals: [
                {
                    name: 'WriterOrbital',
                    entity: { name: 'Thread', fields: [{ name: 'id', type: 'string', required: true }] },
                    traits: [
                        {
                            name: 'FlagBridge',
                            scope: 'instance',
                            linkedEntity: 'Thread',
                            stateMachine: {
                                states: [{ name: 'idle', isInitial: true }],
                                events: [{ key: 'FLAG', name: 'Flag' }],
                                transitions: [
                                    {
                                        from: 'idle',
                                        to: 'idle',
                                        event: 'FLAG',
                                        effects: [['persist', 'create', 'ModQueueItem', { status: 'pending' }]],
                                    },
                                ],
                            },
                        },
                    ],
                    pages: [],
                },
                {
                    name: 'HostOrbital',
                    entity: { name: 'Decision', fields: [{ name: 'id', type: 'string', required: true }] },
                    uses: [{ as: 'ModQueue', from: 'std/behaviors/std-mod-queue' }],
                    traits: [
                        {
                            ref: 'ModQueue.traits.ModQueueItemReview',
                            name: 'ThreadModQueue',
                            ...(rebindTo !== undefined ? { linkedEntity: rebindTo } : {}),
                        },
                    ],
                    pages: [],
                },
            ],
        };
    }

    const entityNames = (schema: OrbitalSchema, orbital: string, opts = {}): string[] =>
        deriveExpectations(schema, orbital, opts)
            .expectations.filter((e) => e.kind === 'entity')
            .map((e) => (e.kind === 'entity' ? e.name : ''))
            .sort();

    it('derives an expectation for an entity a BARE-composed atom contributes', () => {
        expect(entityNames(schemaComposing(), 'WriterOrbital', { loadBehavior })).toContain('ModQueueItem');
    });

    it('does NOT contribute the bound entity when the call site rebinds linkedEntity', () => {
        // Mirrors `inline/mod.rs:872` — a rebind merges the atom's FIELDS into
        // the rebind target instead of surfacing its entity.
        expect(entityNames(schemaComposing('Decision'), 'WriterOrbital', { loadBehavior })).not.toContain(
            'ModQueueItem',
        );
    });

    it("carries the imported orbital's OWN auxiliary entities whether or not the call site rebinds", () => {
        // `inline/mod.rs:888-894` — a multi-entity atom's trait body fetches its
        // sibling entities by name, so those travel unconditionally. Prove it by
        // having the WRITER fetch the aux entity: it must become expectable in
        // BOTH the bare and the rebound case, unlike the bound entity above.
        const fetchingAux = (rebindTo?: string): OrbitalSchema => {
            const schema = schemaComposing(rebindTo);
            const t = schema.orbitals[0].traits[0];
            if (typeof t === 'object' && 'stateMachine' in t && t.stateMachine) {
                t.stateMachine.transitions[0].effects = [['fetch', 'ModQueueAudit']];
            }
            return schema;
        };
        expect(entityNames(fetchingAux(), 'WriterOrbital', { loadBehavior })).toContain('ModQueueAudit');
        expect(entityNames(fetchingAux('Decision'), 'WriterOrbital', { loadBehavior })).toContain('ModQueueAudit');
    });

    it('is inert without a loader — byte-identical to the pre-change behavior', () => {
        expect(entityNames(schemaComposing(), 'WriterOrbital')).not.toContain('ModQueueItem');
    });

    it('emits the expectation EXISTENCE-ONLY, with no shape and no field diagnostics', () => {
        // A shape would opt the expectation into payload checking against a
        // provider the slice cannot see (`expectations_validation.rs:280-282`),
        // and the atom's declared shape legitimately differs from what the
        // consumer delivers.
        const result = deriveExpectations(schemaComposing(), 'WriterOrbital', { loadBehavior });
        const decl = result.expectations.find((e) => e.kind === 'entity' && e.name === 'ModQueueItem');
        expect(decl).toBeDefined();
        expect(decl && 'shape' in decl ? decl.shape : undefined).toBeUndefined();
        expect(result.diagnostics.filter((d) => d.entity === 'ModQueueItem')).toEqual([]);
    });

    it('never lets a contributed name outrank a real declaration', () => {
        // The ordering invariant the compiled path learned the hard way in
        // `collect_names`: all real declarations, THEN anything derived.
        const schema = schemaComposing();
        schema.orbitals[0].auxiliaryEntities = [
            { name: 'ModQueueItem', fields: [{ name: 'id', type: 'string', required: true }] },
        ];
        // WriterOrbital now declares it itself → never expect your own entity.
        expect(entityNames(schema, 'WriterOrbital', { loadBehavior })).not.toContain('ModQueueItem');
    });

    it('leaves a name nothing declares and no atom contributes underivable', () => {
        // A genuine typo must stay an error, not be laundered into a deferral.
        const schema = schemaComposing();
        const t = schema.orbitals[0].traits[0];
        if (typeof t === 'object' && 'stateMachine' in t && t.stateMachine) {
            t.stateMachine.transitions[0].effects = [['persist', 'create', 'ModQueueItm', { status: 'pending' }]];
        }
        expect(entityNames(schema, 'WriterOrbital', { loadBehavior })).not.toContain('ModQueueItm');
    });
});
