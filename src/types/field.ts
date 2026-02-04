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
 * Configuration for relation fields (foreign keys).
 */
export interface RelationConfig {
    /** Target entity name (e.g., 'User', 'Task') */
    entity: string;
    /** Field on target entity (defaults to 'id') */
    field?: string;
    /** Cardinality: one-to-one or one-to-many */
    cardinality?: 'one' | 'many';
    /** Delete behavior */
    onDelete?: 'cascade' | 'nullify' | 'restrict';
}

export const RelationConfigSchema = z.object({
    entity: z.string().min(1, 'Target entity is required'),
    field: z.string().optional(),
    cardinality: z.enum(['one', 'many']).optional(),
    onDelete: z.enum(['cascade', 'nullify', 'restrict']).optional(),
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
