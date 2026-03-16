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
export type EntityPersistence = 'persistent' | 'runtime' | 'singleton' | 'instance';

export const EntityPersistenceSchema = z.enum([
    'persistent',
    'runtime',
    'singleton',
    'instance',
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
    instances?: Record<string, unknown>[];

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
