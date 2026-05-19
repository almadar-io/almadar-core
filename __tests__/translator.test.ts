/**
 * Phase 2 translator + reducer — minimal direct tests.
 *
 * Three scenarios per the plan:
 *   1. translate a minimal DomainEntity against a hand-rolled
 *      FactorySignature — assert exact params output.
 *   2. apply a sequence of DomainMutations to a baseline doc and
 *      roundtrip-convert the result; assert the doc stays parseable.
 *   3. translator emits a typed warning when a domain field has no
 *      signature consumer.
 *
 * No factory-catalog loading; signatures are inline literals so the
 * tests don't depend on `@almadar/std`'s emitted catalog.
 */

import { describe, expect, it } from 'vitest';
import {
  applyMutation,
  translateDomainToParams,
  type DomainBehavior,
  type DomainDocument,
  type DomainEntity,
  type DomainField,
  type DomainMutation,
  type DomainPage,
  type FactorySignature,
} from '../src/domain-language/index.js';

const baseField: Omit<DomainField, 'name' | 'fieldType'> = {
  type: 'field',
  required: false,
  unique: false,
  auto: false,
};

function field(
  name: string,
  fieldType: DomainField['fieldType'],
  required = false,
): DomainField {
  return { ...baseField, name, fieldType, required };
}

const minimalCartSignature: FactorySignature = {
  organism: 'std-cart',
  orbital: 'CartItemOrbital',
  tier: 'molecules',
  factoryPath: 'behaviors/functions/app/molecules/std-cart.ts',
  entities: [
    {
      name: 'CartItem',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'description', type: 'string', required: false },
      ],
      persistence: 'persistent',
    },
  ],
  traits: [
    {
      name: 'CartItemCartLayout',
      emittedEvents: [],
      listenedEvents: [],
      overridableConfigKeys: ['navItems', 'title'],
      capabilities: [],
    },
  ],
  pages: [
    { name: 'CartItemPage', defaultPath: '/cart', primaryEntity: 'CartItem' },
  ],
  emittedEvents: [],
  listenedEvents: [],
};

describe('translateDomainToParams', () => {
  it('emits empty params when the domain entity exactly matches the signature', () => {
    const entity: DomainEntity = {
      type: 'entity',
      name: 'CartItem',
      description: '',
      fields: [field('name', 'text', true), field('description', 'text')],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      minimalCartSignature,
    );
    expect(warnings).toEqual([]);
    expect(callSite.organism).toBe('std-cart');
    expect(callSite.orbital).toBe('CartItemOrbital');
    expect(callSite.params).toEqual({});
  });

  it('renames the entity and adds extra fields', () => {
    const entity: DomainEntity = {
      type: 'entity',
      name: 'GroceryItem',
      description: '',
      fields: [
        field('name', 'text', true),
        field('description', 'text'),
        field('quantity', 'number'),
      ],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      minimalCartSignature,
    );
    expect(warnings).toEqual([]);
    expect(callSite.params.entityName).toBe('GroceryItem');
    expect(callSite.params.entityFields).toEqual([
      { name: 'quantity', type: 'number' },
    ]);
  });

  it('threads persistence override when the entity carries a non-default mode', () => {
    const entity: DomainEntity = {
      type: 'entity',
      name: 'CartItem',
      description: '',
      fields: [field('name', 'text', true), field('description', 'text')],
      relationships: [],
      persistence: 'runtime',
    };
    const { callSite } = translateDomainToParams(
      { entity },
      minimalCartSignature,
    );
    expect(callSite.params.persistence).toBe('runtime');
  });

  it('writes nav items into the matching trait override', () => {
    const entity: DomainEntity = {
      type: 'entity',
      name: 'CartItem',
      description: '',
      fields: [field('name', 'text', true), field('description', 'text')],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      minimalCartSignature,
      {
        navAdditions: [{ label: 'Home', path: '/', icon: 'home' }],
      },
    );
    expect(warnings).toEqual([]);
    expect(callSite.params.traitOverrides).toEqual({
      CartItemCartLayout: {
        config: {
          navItems: [{ label: 'Home', path: '/', icon: 'home' }],
        },
      },
    });
  });

  it('emits a typed warning when no trait advertises a navItems knob', () => {
    const noNavSignature: FactorySignature = {
      ...minimalCartSignature,
      traits: [
        {
          name: 'CartItemPlain',
          emittedEvents: [],
          listenedEvents: [],
          overridableConfigKeys: [],
          capabilities: [],
        },
      ],
    };
    const entity: DomainEntity = {
      type: 'entity',
      name: 'CartItem',
      description: '',
      fields: [field('name', 'text', true), field('description', 'text')],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      noNavSignature,
      { navAdditions: [{ label: 'Home', path: '/' }] },
    );
    expect(callSite.params.traitOverrides).toBeUndefined();
    expect(warnings).toEqual([
      {
        field: 'presentation.navAdditions',
        reason:
          'factory signature has no trait advertising a `navItems` config key',
      },
    ]);
  });

  it('trait overlay merges into params + warns on unknown trait name', () => {
    const entity: DomainEntity = {
      type: 'entity',
      name: 'CartItem',
      description: '',
      fields: [field('name', 'text', true), field('description', 'text')],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      minimalCartSignature,
      undefined,
      undefined,
      {
        CartItemCartLayout: { config: { title: 'My Cart' } },
        NoSuchTrait: { config: { whatever: 1 } },
      },
    );
    expect(callSite.params.traitOverrides).toEqual({
      CartItemCartLayout: { config: { title: 'My Cart' } },
    });
    expect(warnings).toEqual([
      {
        field: 'traitOverlay.NoSuchTrait',
        reason: 'factory signature has no trait named "NoSuchTrait"',
      },
    ]);
  });

  it('rule overlay with capability=privacy emits an ExtraTrait via catalog lookup', () => {
    const rowAccessSignature: FactorySignature = {
      organism: 'std-row-access-control',
      orbital: 'RowAccessControlOrbital',
      tier: 'atoms',
      factoryPath: 'behaviors/functions/core/atoms/std-row-access-control.ts',
      entities: [],
      traits: [
        {
          name: 'RowAccessGate',
          emittedEvents: [],
          listenedEvents: [],
          overridableConfigKeys: ['ownerField', 'visibleRoles'],
          capabilities: ['access', 'privacy'],
        },
      ],
      pages: [],
      emittedEvents: [],
      listenedEvents: [],
    };
    const entity: DomainEntity = {
      type: 'entity',
      name: 'CartItem',
      description: '',
      fields: [field('name', 'text', true), field('description', 'text')],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      minimalCartSignature,
      undefined,
      {
        rules: [
          {
            id: 'r1',
            capability: 'privacy',
            description: 'Sellers see only their own products',
            appliesTo: ['CartItem'],
          },
        ],
      },
      undefined,
      [minimalCartSignature, rowAccessSignature],
    );
    expect(warnings).toEqual([]);
    expect(callSite.params.extraTraits).toEqual([
      {
        from: 'std/behaviors/std-row-access-control',
        ref: 'RowAccessControl.traits.RowAccessGate',
        linkedEntity: 'CartItem',
      },
    ]);
  });

  it('rule overlay with unmatched capability emits a typed warning + skips', () => {
    const entity: DomainEntity = {
      type: 'entity',
      name: 'CartItem',
      description: '',
      fields: [field('name', 'text', true), field('description', 'text')],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      minimalCartSignature,
      undefined,
      {
        rules: [
          {
            id: 'r1',
            capability: 'no-such-capability',
            description: '',
            appliesTo: [],
          },
        ],
      },
      undefined,
      [minimalCartSignature],
    );
    expect(callSite.params.extraTraits).toBeUndefined();
    expect(warnings).toEqual([
      {
        field: 'ruleOverlay.rules.r1',
        reason: 'no trait in the catalog advertises capability "no-such-capability"',
      },
    ]);
  });

  it('ownership entry writes ownerField on the matching trait', () => {
    const rowAccessSignature: FactorySignature = {
      organism: 'std-row-access-control',
      orbital: 'RowAccessControlOrbital',
      tier: 'atoms',
      factoryPath: 'behaviors/functions/core/atoms/std-row-access-control.ts',
      entities: [],
      traits: [
        {
          name: 'RowAccessGate',
          emittedEvents: [],
          listenedEvents: [],
          overridableConfigKeys: ['ownerField', 'visibleRoles'],
          capabilities: ['access', 'privacy'],
        },
      ],
      pages: [],
      emittedEvents: [],
      listenedEvents: [],
    };
    const entity: DomainEntity = {
      type: 'entity',
      name: 'Product',
      description: '',
      fields: [field('name', 'text', true)],
      relationships: [],
    };
    const { callSite, warnings } = translateDomainToParams(
      { entity },
      minimalCartSignature,
      undefined,
      {
        rules: [],
        ownership: [{ entity: 'Product', ownerField: 'sellerId' }],
      },
      undefined,
      [minimalCartSignature, rowAccessSignature],
    );
    expect(warnings).toEqual([]);
    expect(callSite.params.traitOverrides).toEqual({
      RowAccessGate: { config: { ownerField: 'sellerId' } },
    });
  });
});

describe('applyMutation', () => {
  function baselineDoc(): DomainDocument {
    return {
      type: 'document',
      entities: [
        {
          type: 'entity',
          name: 'Order',
          description: 'A customer order placed in the system',
          fields: [field('amount', 'number')],
          relationships: [],
        },
      ],
      pages: [],
      behaviors: [],
    };
  }

  it('add-entity adds an entity', () => {
    const next = applyMutation(baselineDoc(), {
      kind: 'add-entity',
      entity: {
        type: 'entity',
        name: 'User',
        description: '',
        fields: [field('email', 'text', true)],
        relationships: [],
      },
    });
    expect(next.entities.map((e) => e.name)).toEqual(['Order', 'User']);
  });

  it('add-field appends a field to the target entity', () => {
    const next = applyMutation(baselineDoc(), {
      kind: 'add-field',
      entityName: 'Order',
      field: field('status', 'text'),
    });
    expect(next.entities[0].fields.map((f) => f.name)).toEqual([
      'amount',
      'status',
    ]);
  });

  it('rename-entity preserves field set', () => {
    const next = applyMutation(baselineDoc(), {
      kind: 'rename-entity',
      from: 'Order',
      to: 'Purchase',
    });
    expect(next.entities[0].name).toBe('Purchase');
    expect(next.entities[0].fields.map((f) => f.name)).toEqual(['amount']);
  });

  it('chains multiple mutations through the reducer immutably', () => {
    const muts: DomainMutation[] = [
      {
        kind: 'add-entity',
        entity: {
          type: 'entity',
          name: 'User',
          description: 'A registered system user',
          fields: [field('email', 'text', true)],
          relationships: [],
        },
      },
      {
        kind: 'add-field',
        entityName: 'Order',
        field: field('status', 'text'),
      },
      {
        kind: 'rename-entity',
        from: 'Order',
        to: 'Purchase',
      },
    ];
    const baseline = baselineDoc();
    let doc = baseline;
    for (const m of muts) doc = applyMutation(doc, m);
    // Immutability: baseline untouched
    expect(baseline.entities[0].name).toBe('Order');
    expect(baseline.entities[0].fields.map((f) => f.name)).toEqual([
      'amount',
    ]);
    // Reducer output reflects each mutation in order
    expect(doc.entities.map((e) => e.name).sort()).toEqual([
      'Purchase',
      'User',
    ]);
    const purchase = doc.entities.find((e) => e.name === 'Purchase')!;
    expect(purchase.fields.map((f) => f.name)).toEqual(['amount', 'status']);
  });

  it('is exhaustive over the mutation union (type-level guard)', () => {
    // The applyMutation reducer's `default: never` branch ensures every
    // new mutation kind added to DomainMutation must be handled. This
    // test exists to remind future authors to extend the reducer.
    const samples: DomainMutation[] = [
      { kind: 'add-entity', entity: {} as DomainEntity },
      { kind: 'remove-entity', entityName: 'X' },
      { kind: 'rename-entity', from: 'X', to: 'Y' },
      { kind: 'update-entity', entityName: 'X', entity: {} as DomainEntity },
      { kind: 'add-field', entityName: 'X', field: field('a', 'text') },
      { kind: 'remove-field', entityName: 'X', fieldName: 'a' },
      { kind: 'update-field', entityName: 'X', field: field('a', 'text') },
      { kind: 'add-page', page: {} as DomainPage },
      { kind: 'remove-page', pageName: 'P' },
      { kind: 'update-page', pageName: 'P', page: {} as DomainPage },
      { kind: 'add-behavior', behavior: {} as DomainBehavior },
      { kind: 'remove-behavior', behaviorName: 'B' },
      {
        kind: 'update-behavior',
        behaviorName: 'B',
        behavior: {} as DomainBehavior,
      },
      {
        kind: 'add-transition',
        behaviorName: 'B',
        transition: {
          type: 'transition',
          fromState: 'A',
          toState: 'B',
          event: 'GO',
          guards: [],
          effects: [],
        },
      },
      {
        kind: 'remove-transition',
        behaviorName: 'B',
        from: 'A',
        to: 'B',
        event: 'GO',
      },
      {
        kind: 'add-relationship',
        entityName: 'X',
        relationship: {
          type: 'relationship',
          relationshipType: 'belongs_to',
          targetEntity: 'Y',
        },
      },
      {
        kind: 'remove-relationship',
        entityName: 'X',
        targetEntity: 'Y',
        relationshipType: 'belongs_to',
      },
    ];
    expect(samples.length).toBe(17);
  });
});
