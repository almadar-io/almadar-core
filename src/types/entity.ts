/**
 * Entity Types for Orbital Units
 *
 * Defines the OrbitalEntity type - the nucleus of an Orbital Unit.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { EntityFieldSchema, type EntityField } from './field.js';
import { SemanticAssetRefSchema, type SemanticAssetRef } from './asset.js';

// ============================================================================
// Entity Persistence
// ============================================================================

/**
 * Entity persistence types.
 *
 * - persistent: Stored in database (has collection)
 * - runtime: Exists only at runtime (not persisted)
 * - singleton: Single global instance
 * - instance: Static data (read-only instances)
 */
export type EntityPersistence = 'persistent' | 'runtime' | 'singleton' | 'instance' | 'local';

export const EntityPersistenceSchema = z.enum([
    'persistent',
    'runtime',
    'singleton',
    'instance',
    'local',
]);

// ============================================================================
// Orbital Entity
// ============================================================================

/**
 * OrbitalEntity - the nucleus of an Orbital Unit.
 *
 * This is a simplified entity definition optimized for orbital composition.
 * Collection names are derived automatically from persistence type if not provided.
 */
export interface OrbitalEntity {
    /** Entity name (PascalCase, e.g., "Task", "User") */
    name: string;

    /** Entity persistence type (defaults to 'persistent' if not specified) */
    persistence?: EntityPersistence;

    /** Collection name (auto-derived if not provided for persistent entities) */
    collection?: string;

    /** Entity fields */
    fields: EntityField[];

    /** Pre-authored instances (seed data or static reference data) */
    instances?: EntityRow[];

    /** Auto-add createdAt/updatedAt timestamps */
    timestamps?: boolean;

    /** Soft delete support */
    softDelete?: boolean;

    /** Human-readable description */
    description?: string;

    /** Visual prompt for AI generation */
    visual_prompt?: string;

    /** Semantic asset reference for visual representation (games) */
    assetRef?: SemanticAssetRef;
}

export const OrbitalEntitySchema = z.object({
    name: z.string().min(1, 'Entity name is required'),
    persistence: EntityPersistenceSchema.default('persistent'),
    collection: z.string().optional(),
    fields: z.array(EntityFieldSchema).min(1, 'At least one field is required'),
    instances: z.array(z.record(z.unknown())).optional(),
    timestamps: z.boolean().optional(),
    softDelete: z.boolean().optional(),
    description: z.string().optional(),
    visual_prompt: z.string().optional(),
    assetRef: SemanticAssetRefSchema.optional(),
});

export type OrbitalEntityInput = z.input<typeof OrbitalEntitySchema>;

// ============================================================================
// Type Aliases (for cleaner imports)
// ============================================================================

/** Alias for OrbitalEntity - preferred name */
export type Entity = OrbitalEntity;

/** Alias for OrbitalEntitySchema - preferred name */
export const EntitySchema = OrbitalEntitySchema;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Derives the collection name for a persistent entity.
 * 
 * Generates the database collection name by converting the entity name
 * to lowercase and adding an 's' suffix (simple pluralization).
 * Returns undefined for non-persistent entities (runtime/singleton).
 * 
 * @param {OrbitalEntity} entity - Entity to derive collection name for
 * @returns {string | undefined} Collection name or undefined for non-persistent entities
 * 
 * @example
 * deriveCollection({ name: 'User', persistence: 'persistent' }); // returns 'users'
 * deriveCollection({ name: 'Task', persistence: 'runtime' }); // returns undefined
 */
export function deriveCollection(entity: OrbitalEntity): string | undefined {
    if (entity.persistence !== 'persistent') {
        return undefined;
    }
    // Lowercase + 's' suffix (simple pluralization)
    return entity.name.toLowerCase() + 's';
}

/**
 * Checks if an entity is runtime-only (not persisted).
 * 
 * Type guard to determine if an entity exists only at runtime
 * and is not stored in the database.
 * 
 * @param {OrbitalEntity} entity - Entity to check
 * @returns {boolean} True if entity is runtime-only, false otherwise
 * 
 * @example
 * isRuntimeEntity({ persistence: 'runtime' }); // returns true
 * isRuntimeEntity({ persistence: 'persistent' }); // returns false
 */
export function isRuntimeEntity(entity: OrbitalEntity): boolean {
    return entity.persistence === 'runtime';
}

/**
 * Checks if an entity is a singleton.
 * 
 * Type guard to determine if an entity has a single global instance
 * rather than multiple records in a collection.
 * 
 * @param {OrbitalEntity} entity - Entity to check
 * @returns {boolean} True if entity is a singleton, false otherwise
 * 
 * @example
 * isSingletonEntity({ persistence: 'singleton' }); // returns true
 * isSingletonEntity({ persistence: 'persistent' }); // returns false
 */
export function isSingletonEntity(entity: OrbitalEntity): boolean {
    return entity.persistence === 'singleton';
}

/**
 * Checks whether an entity's persistence mode allows `persistence` /
 * `collection` overrides at the factory call site.
 *
 * Only `persistent` entities (explicit or default) support these overrides.
 * Runtime, singleton, instance, and local entities are fixed; callers must
 * not expose `persistence` or `collection` params for them.
 *
 * @param persistence - The entity persistence mode (undefined = default persistent)
 * @returns True when overrides are allowed, false otherwise
 *
 * @example
 * persistenceModeAllowsOverrides('persistent'); // returns true
 * persistenceModeAllowsOverrides('runtime');    // returns false
 * persistenceModeAllowsOverrides(undefined);    // returns true (default persistent)
 */
export function persistenceModeAllowsOverrides(
    persistence: EntityPersistence | undefined,
): boolean {
    return persistence === 'persistent' || persistence === undefined;
}

// ============================================================================
// Entity Instance Data (Runtime)
// ============================================================================

/**
 * A single field value at runtime.
 * Union of all possible types from FieldType: string, number, boolean, date, array, nested.
 * The nested-record branch's index signature tolerates `undefined` so that
 * TypeScript optional properties (`x?: string`, carrying `string | undefined`)
 * on EntityRow extenders typecheck without ceremony. At JSON serialization
 * time `undefined` is equivalent to "key absent" and never appears on the
 * wire; the inclusion here is a pure type-surface accommodation.
 */
export type FieldValue = string | number | boolean | Date | null | string[] | FieldValue[] | { [key: string]: FieldValue | undefined };

/**
 * One instance of an entity with actual field values.
 * The shape is determined by the Entity definition at schema time.
 *
 * @example
 * // Entity defines: Patient { fullName: string, age: number, active: boolean }
 * // EntityRow is: { id: "p1", fullName: "Sarah", age: 34, active: true }
 */
export type EntityRow = { id?: string } & Record<string, FieldValue | undefined>;

/**
 * A field-TYPED `EntityRow` — the SINGLE entity type, refined with a concrete
 * field SHAPE `S`. Non-optional members of `S` are REQUIRED, each with its real
 * type; the result stays `& EntityRow`, so the index signature is intact and
 * every other field is still field-open — any domain entity that provides those
 * fields satisfies it.
 *
 * One declaration, two jobs: (1) TypeScript enforces the bound entity has the
 * fields WITH their types (a behavior binding a thinner/mistyped entity fails to
 * typecheck); and (2) pattern-sync reads the same type and writes the entity
 * prop's field shape (`properties` + `requiredFields`) onto the registry, so
 * lolo-ui emits a COMPLETE `entity { … }` (every field, typed + demo-seeded) and
 * the `ORB_X_ENTITY_PROP_CONTRACT` validator rejects an incompatible bind at
 * `orbital validate`. (A raw `EntityRow & { rating: number }` intersection is
 * equivalent for one-off shapes.)
 *
 * @example
 * // HeroOrganism renders entity.title / entity.subtitle:
 * entity?: EntityWith<{ title: string; subtitle?: string }>;
 * //   entity.title    → string                  (required)
 * //   entity.subtitle → string | undefined      (optional)
 * //   entity.other    → FieldValue | undefined  (still field-open)
 */
// `S extends object` (not `Record<string, FieldValue>`) so a plain `interface`
// row shape satisfies it — interfaces lack the implicit index signature `Record`
// requires. FieldValue-compatibility is still enforced structurally: `& EntityRow`
// intersects every field with the `FieldValue | undefined` index signature, so a
// non-FieldValue field (e.g. a React `LucideIcon`) collapses to `never` at use.
export type EntityWith<S extends object> = EntityRow & S;

/**
 * Collection of entity instances keyed by entity name.
 * Used by OrbPreview mockData, OrbitalServerRuntime state, data grids, etc.
 *
 * @example
 * const data: EntityData = {
 *   Patient: [{ id: "1", fullName: "Sarah", age: 34 }],
 *   QueueEntry: [{ id: "1", patientName: "Sarah", waitMinutes: 12 }],
 * };
 */
export type EntityData = Record<string, EntityRow[]>;
