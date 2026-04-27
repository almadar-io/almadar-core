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
    /**
     * Field name (camelCase). Optional for nested item/property descriptors
     * where the name is implied by the parent (`items`, `properties[k]`).
     * Mirrors Rust's `FieldDefinition.name: Option<String>`.
     */
    name?: string;
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

/**
 * Alias map for legacy/loose field-type spellings. Preprocessed into the
 * canonical `FieldType` enum before zod validates. Without this, agent-produced
 * schemas using `text`/`int`/`float`/`ts` were rejected at parse time — this
 * normalizes them so the rest of the pipeline sees only canonical types.
 */
const FIELD_TYPE_ALIASES: Record<string, FieldType> = {
    text: 'string',
    int: 'number',
    float: 'number',
    ts: 'timestamp',
};

export const EntityFieldSchema: z.ZodType<EntityField, z.ZodTypeDef, unknown> = z.lazy(() =>
    z.preprocess(
        (input) => {
            if (
                input !== null &&
                typeof input === 'object' &&
                'type' in input &&
                typeof (input as { type: unknown }).type === 'string'
            ) {
                const raw = (input as { type: string }).type;
                const canonical = FIELD_TYPE_ALIASES[raw];
                if (canonical !== undefined) {
                    return { ...(input as object), type: canonical };
                }
            }
            return input;
        },
        z.object({
            name: z.string().min(1, 'Field name is required').optional(),
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
        ).refine(
            // Enum fields must carry their allowed values. Without this refine,
            // the type was lying about what's valid — bare `type: 'enum'` without
            // `values` passed zod but failed `orb validate` downstream with
            // ORB_E_EMPTY_ENUM_VALUES, stalling the agent pipeline for 20 minutes.
            // `enum` is the legacy field-name alias; accept either.
            (field) => {
                if (field.type !== 'enum') return true;
                const vals = field.values ?? field.enum;
                return Array.isArray(vals) && vals.length > 0;
            },
            { message: 'Enum field requires a non-empty `values` array', path: ['values'] }
        ).refine(
            // Array fields must describe their element shape. Bare `type: 'array'`
            // with no `items` forces downstream consumers (builders, UI renderers,
            // persistence) to guess, so reject it at the schema boundary.
            (field) => {
                if (field.type !== 'array') return true;
                return field.items !== undefined;
            },
            { message: 'Array field requires an `items` schema describing each element', path: ['items'] }
        )
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
