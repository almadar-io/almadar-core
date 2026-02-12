/**
 * Field Types for Orbital Units
 *
 * Extracted from schema/data-entities.ts for the orbitals module.
 * These types define the field structure within orbital entities.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Field Types
// ============================================================================

/**
 * Supported field types for entity fields.
 *
 * @example
 * { name: 'status', type: 'enum', values: ['draft', 'published'] }
 * { name: 'authorId', type: 'relation', relation: { entity: 'User', cardinality: 'one' } }
 */
export type FieldType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'timestamp'
    | 'datetime'
    | 'array'
    | 'object'
    | 'enum'
    | 'relation';

export const FieldTypeSchema = z.enum([
    'string',
    'number',
    'boolean',
    'date',
    'timestamp',
    'datetime',
    'array',
    'object',
    'enum',
    'relation',
]);

// ============================================================================
// Relation Configuration
// ============================================================================

/**
 * Cardinality for relation fields.
 * Matches Rust compiler's Cardinality enum.
 */
export type RelationCardinality = 
    | 'one' 
    | 'many' 
    | 'one-to-many' 
    | 'many-to-one' 
    | 'many-to-many';

export const RelationCardinalitySchema = z.enum([
    'one',
    'many',
    'one-to-many',
    'many-to-one',
    'many-to-many',
]);

/**
 * Configuration for relation fields (foreign keys).
 * Matches Rust compiler's RelationDefinition format.
 */
export interface RelationConfig {
    /** Target entity name (e.g., 'User', 'Task') - matches Rust's `entity` field */
    entity: string;
    /** Field on target entity (defaults to 'id') */
    field?: string;
    /** 
     * Cardinality: one, many, one-to-many, many-to-one, many-to-many
     * Matches Rust compiler's cardinality format
     */
    cardinality?: RelationCardinality;
    /** Delete behavior */
    onDelete?: 'cascade' | 'nullify' | 'restrict';
    /** 
     * Foreign key field name (for legacy compatibility).
     * @deprecated Use field instead
     */
    foreignKey?: string;
    /**
     * Target entity name (for legacy compatibility).
     * @deprecated Use entity instead
     */
    target?: string;
    /**
     * Cardinality type alias (for legacy compatibility).
     * @deprecated Use cardinality instead
     */
    type?: RelationCardinality;
}

export const RelationConfigSchema = z.object({
    entity: z.string().min(1, 'Target entity is required'),
    field: z.string().optional(),
    cardinality: RelationCardinalitySchema.optional(),
    onDelete: z.enum(['cascade', 'nullify', 'restrict']).optional(),
    // Legacy compatibility fields
    foreignKey: z.string().optional(),
    target: z.string().optional(),
    type: RelationCardinalitySchema.optional(),
}).transform((data) => {
    // Normalize legacy format to standard format
    const normalized: RelationConfig = {
        entity: data.entity || data.target || '',
        cardinality: data.cardinality || data.type,
        field: data.field,
        onDelete: data.onDelete,
    };
    return normalized;
});

export type RelationConfigInput = z.input<typeof RelationConfigSchema>;

// ============================================================================
// Field Format
// ============================================================================

/**
 * Field format validators for string fields.
 */
export type FieldFormat = 'email' | 'url' | 'phone' | 'date' | 'datetime' | 'uuid';

export const FieldFormatSchema = z.enum([
    'email',
    'url',
    'phone',
    'date',
    'datetime',
    'uuid',
]);

// ============================================================================
// Entity Field
// ============================================================================

/**
 * Entity field definition.
 */
export interface EntityField {
    /** Field name (camelCase) */
    name: string;
    /** Data type */
    type: FieldType;
    /** Whether the field is required */
    required?: boolean;
    /** Default value */
    default?: unknown;
    /** Allowed values for enum types */
    values?: string[];
    /** @deprecated Use 'values' instead */
    enum?: string[];
    /** Validation format */
    format?: FieldFormat;
    /** Minimum value (for number) or length (for string) */
    min?: number;
    /** Maximum value or length */
    max?: number;
    /** Array item schema (for array type) */
    items?: EntityField;
    /** Relation configuration (required when type is 'relation') */
    relation?: RelationConfig;
}

export const EntityFieldSchema: z.ZodType<EntityField> = z.lazy(() =>
    z.object({
        name: z.string().min(1, 'Field name is required'),
        type: FieldTypeSchema,
        required: z.boolean().optional(),
        default: z.unknown().optional(),
        values: z.array(z.string()).optional(),
        enum: z.array(z.string()).optional(),
        format: FieldFormatSchema.optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        items: EntityFieldSchema.optional(),
        relation: RelationConfigSchema.optional(),
    }).refine(
        (field) => field.type !== 'relation' || field.relation !== undefined,
        { message: 'Relation config is required when type is "relation"', path: ['relation'] }
    )
);

export type EntityFieldInput = z.input<typeof EntityFieldSchema>;

// ============================================================================
// Type Aliases (for cleaner imports)
// ============================================================================

/** Alias for EntityField - preferred name */
export type Field = EntityField;

/** Alias for EntityFieldSchema - preferred name */
export const FieldSchema = EntityFieldSchema;
