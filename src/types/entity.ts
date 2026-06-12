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
 * A field-refined `EntityRow` — the SINGLE entity type, narrowed so a set of
 * named fields are REQUIRED (present, non-`undefined`). This is how an entity-
 * interacting component declares the fields it needs to function WITHOUT
 * introducing a separate per-component entity type: it stays structurally an
 * `EntityRow` (index signature intact, every other field still field-open), so
 * any domain entity that provides those fields satisfies it.
 *
 * One declaration, two jobs: (1) TypeScript enforces that the bound entity has
 * the fields (a behavior binding a thinner entity fails to typecheck); and
 * (2) pattern-sync reads the same type and writes `requiredFields` onto the
 * registry's entity prop, so the `ORB_X_ENTITY_PROP_CONTRACT` validator rule
 * rejects an incompatible bind at `orbital validate` (accounting for `.lolo`
 * field-remaps). Use a raw `EntityRow & { rating: number }` intersection when a
 * field needs a specific scalar type rather than mere presence.
 *
 * @example
 * // HeroOrganism renders entity.title / entity.subtitle:
 * entity?: EntityWith<'title' | 'subtitle'>;
 * //   entity.title  → FieldValue              (required)
 * //   entity.other  → FieldValue | undefined  (still field-open)
 */
export type EntityWith<K extends string> = EntityRow & {
  readonly [P in K]: FieldValue;
};

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
