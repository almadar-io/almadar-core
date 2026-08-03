import { describe, expect, it } from 'vitest';

import { identityEntityName, ownerFieldsFromSchema } from '../src/mock/identityOwners.js';
import type { OrbitalEntity } from '../src/types/entity.js';
import type { EntityField } from '../src/types/field.js';
import type { Orbital } from '../src/types/orbital.js';
import type { OrbitalSchema } from '../src/types/schema.js';

/**
 * The JS half of the identity seeder. Its Rust twin is
 * `orbital-core/src/runtime/seed.rs::owner_fields_from_schema`; the two must
 * agree, or an app's ownership-scoped views work compiled and silently show
 * nothing interpreted — the exact silent-empty class the identity work exists
 * to kill.
 */

const ID_FIELD: EntityField = { name: 'id', type: 'string', required: true };

const relation = (name: string, target: string): EntityField => ({
    name,
    type: 'relation',
    relation: { entity: target, cardinality: 'one' },
});

const entity = (name: string, fields: EntityField[]): OrbitalEntity => ({ name, fields });

const identityEntity = (name: string, fields: EntityField[]): OrbitalEntity => ({
    name,
    identity: true,
    fields,
});

const orbital = (name: string, primary: OrbitalEntity, auxiliary?: OrbitalEntity[]): Orbital =>
    auxiliary
        ? { name, entity: primary, auxiliaryEntities: auxiliary, traits: [], pages: [] }
        : { name, entity: primary, traits: [], pages: [] };

const schemaOf = (orbitals: Orbital[]): OrbitalSchema => ({
    name: 'test-app',
    version: '1.0.0',
    orbitals,
});

const personOrbital = (fields: EntityField[] = [ID_FIELD]): Orbital =>
    orbital('PersonOrbital', identityEntity('Person', fields));

describe('ownerFieldsFromSchema', () => {
    it('returns nothing when no entity is tagged [identity]', () => {
        const schema = schemaOf([
            orbital('MessageOrbital', entity('Message', [relation('sender', 'Person')])),
        ]);

        expect(identityEntityName(schema)).toBeUndefined();
        // The no-op guarantee: every unmigrated app must seed exactly as before.
        expect(ownerFieldsFromSchema(schema)).toEqual([]);
    });

    it('derives owner columns ACROSS orbitals, not just the declaring one', () => {
        const schema = schemaOf([
            orbital('MessageOrbital', entity('Message', [relation('sender', 'Person')])),
            personOrbital(),
        ]);

        expect(identityEntityName(schema)).toBe('Person');
        expect(ownerFieldsFromSchema(schema)).toEqual(['Message.sender']);
    });

    it('ignores relations pointing at a NON-identity entity', () => {
        const schema = schemaOf([
            orbital(
                'MessageOrbital',
                entity('Message', [relation('sender', 'Person'), relation('channel', 'Channel')]),
            ),
            personOrbital(),
        ]);

        expect(ownerFieldsFromSchema(schema)).toEqual(['Message.sender']);
    });

    it('never guesses from a field NAME — an untyped id column is not an owner', () => {
        const schema = schemaOf([
            // Named exactly like an owner column, but still a bare string.
            orbital('MessageOrbital', entity('Message', [{ name: 'personId', type: 'string' }])),
            personOrbital(),
        ]);

        expect(ownerFieldsFromSchema(schema)).toEqual([]);
    });

    it('walks auxiliary entities, not only each orbital primary', () => {
        const schema = schemaOf([
            orbital('MessageOrbital', entity('Message', []), [
                entity('Draft', [relation('owner', 'Person')]),
            ]),
            personOrbital(),
        ]);

        expect(ownerFieldsFromSchema(schema)).toEqual(['Draft.owner']);
    });

    it('a same-collection sibling inherits a declared owner column by name; a different collection does not', () => {
        // Mirror of entityAccessTable's policy inheritance: a composed atom's
        // entity shares the collection (and therefore the @read scope) of the
        // organism's declaring entity, but structurally cannot declare the
        // identity relation itself.
        const declaring: OrbitalEntity = {
            ...entity('RenewalRiskSearch', [relation('assignedCsm', 'Person')]),
            collection: 'renewalrisks',
        };
        const atomView: OrbitalEntity = {
            ...entity('RenewalRisk', [{ name: 'assignedCsm', type: 'string' }]),
            collection: 'renewalrisks',
        };
        const otherCollection: OrbitalEntity = {
            ...entity('Invoice', [{ name: 'assignedCsm', type: 'string' }]),
            collection: 'invoices',
        };
        const schema = schemaOf([
            orbital('RiskOrbital', declaring, [atomView, otherCollection]),
            personOrbital(),
        ]);

        expect(ownerFieldsFromSchema(schema)).toEqual([
            'RenewalRiskSearch.assignedCsm',
            'RenewalRisk.assignedCsm',
        ]);
    });
});
