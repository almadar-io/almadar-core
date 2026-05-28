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
    | 'relation'
    | 'trait'
    | 'slot'
    | 'pattern';

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
    'trait',
    'slot',
    'pattern',
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
export type FieldFormat =
    | 'email'
    | 'url'
    | 'phone'
    | 'date'
    | 'datetime'
    | 'uuid'
    /** Render hint: this string field stores an image URL. Mock adapters
     *  generate a deterministic picsum.photos URL; UI patterns can branch
     *  to an `<img>` instead of a `<typography>`. */
    | 'image'
    /** Render hint: avatar-shaped image (square, small). */
    | 'avatar'
    /** Render hint: thumbnail image (small landscape). */
    | 'thumbnail';

export const FieldFormatSchema = z.enum([
    'email',
    'url',
    'phone',
    'date',
    'datetime',
    'uuid',
    'image',
    'avatar',
    'thumbnail',
]);

// ============================================================================
// Entity Field — discriminated union by `type`
// ============================================================================

/**
 * Field-type tags that don't carry a type-dependent payload. The base
 * `EntityField` shape applies as-is.
 */
type ScalarFieldType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'timestamp'
    | 'datetime'
    | 'object'
    | 'trait'
    | 'slot'
    | 'pattern';

/** Fields shared across every variant. */
interface EntityFieldBase {
    /**
     * Field name (camelCase). Optional for nested item/property descriptors
     * where the name is implied by the parent (`items`, `properties[k]`).
     * Mirrors Rust's `FieldDefinition.name: Option<String>`.
     */
    name?: string;
    /** Whether the field is required */
    required?: boolean;
    /** Default value */
    default?: unknown;
    /** Validation format */
    format?: FieldFormat;
    /** Minimum value (for number) or length (for string) */
    min?: number;
    /** Maximum value or length */
    max?: number;
    /** Object property schemas keyed by property name (for object type).
     *  Mirrors Rust's `FieldDefinition.properties: Option<HashMap<String,
     *  FieldDefinition>>`. Populated by the lolo lowerer when a field /
     *  config slot's type expression resolves to a struct shape
     *  (`TypeExpr::Object`), including named-type aliases like `[MetricSpec]`. */
    properties?: Record<string, EntityField>;
}

/**
 * Scalar / structural fields — no type-dependent payload required.
 * `values?` is permitted as an OPTIONAL UI/validation hint (e.g. lolo's
 * `'a' | 'b' | 'c'` string-union sugar lowers to `type: 'string', values:
 * [...]`). Only `EnumEntityField` MANDATES values.
 */
export interface ScalarEntityField extends EntityFieldBase {
    type: ScalarFieldType;
    /** Optional vocabulary hint for scalar fields (e.g. string unions
     *  authored as `'a'|'b'|'c'` in lolo). Not required at this variant. */
    values?: string[];
}

/** `type: 'enum'` REQUIRES the closed vocabulary in `values`. */
export interface EnumEntityField extends EntityFieldBase {
    type: 'enum';
    /** Closed string vocabulary the field accepts. */
    values: string[];
}

/** `type: 'relation'` REQUIRES the relation target binding. */
export interface RelationEntityField extends EntityFieldBase {
    type: 'relation';
    /** Relation target binding (entity + cardinality). */
    relation: RelationConfig;
}

/** `type: 'array'` — element schema in `items` strongly preferred but
 *  optional for legacy compatibility with codegen-emitted scalar-array
 *  fields (e.g. `{type: 'array', default: []}`). The lolo lowerer + Rust
 *  validator catch typed-element-required cases downstream. */
export interface ArrayEntityField extends EntityFieldBase {
    type: 'array';
    /** Element schema for the array. */
    items?: EntityField;
}

/**
 * Entity field definition — discriminated union by `type`. Each variant
 * statically enforces its dependent payload (`values` for enum,
 * `relation` for relation, `items` for array) so TS / Zod / JSON Schema
 * consumers all agree on the dependency, not just the Rust validator.
 *
 * @example
 * { name: 'status', type: 'enum', values: ['draft', 'published'] }
 * { name: 'authorId', type: 'relation', relation: { entity: 'User', cardinality: 'one' } }
 * { name: 'tags', type: 'array', items: { type: 'string' } }
 */
export type EntityField =
    | ScalarEntityField
    | EnumEntityField
    | RelationEntityField
    | ArrayEntityField;

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

/**
 * Zod schema for `EntityField`. Preprocess normalizes:
 *   - legacy `type` aliases (text → string, int → number, etc.)
 *   - legacy `enum: string[]` alias → `values: string[]`
 *
 * Branches on `type` so TS narrows the parsed output to the matching
 * discriminated-union variant.
 */
export const EntityFieldSchema: z.ZodType<EntityField, z.ZodTypeDef, unknown> = z.lazy(() => {
    const baseFieldShape = {
        name: z.string().min(1, 'Field name is required').optional(),
        required: z.boolean().optional(),
        default: z.unknown().optional(),
        format: FieldFormatSchema.optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        properties: z.record(EntityFieldSchema).optional(),
    };

    /** Build a scalar variant schema. `values?` is permitted as a hint;
     *  only the enum variant mandates a non-empty values array. */
    function scalarVariant<T extends ScalarFieldType>(t: T) {
        return z.object({
            ...baseFieldShape,
            type: z.literal(t),
            values: z.array(z.string()).optional(),
        });
    }

    return z.preprocess(
        (input) => {
            if (
                input === null ||
                typeof input !== 'object' ||
                !('type' in input) ||
                typeof (input as { type: unknown }).type !== 'string'
            ) {
                return input;
            }
            const obj = input as { type: string; enum?: unknown; values?: unknown };
            const next: { type: string; enum?: unknown; values?: unknown } = { ...obj };
            const aliased = FIELD_TYPE_ALIASES[obj.type];
            if (aliased !== undefined) next.type = aliased;
            // Fold legacy `enum: string[]` into `values: string[]`.
            if (next.enum !== undefined && next.values === undefined) {
                next.values = next.enum;
            }
            delete next.enum;
            return next;
        },
        z.discriminatedUnion('type', [
            scalarVariant('string'),
            scalarVariant('number'),
            scalarVariant('boolean'),
            scalarVariant('date'),
            scalarVariant('timestamp'),
            scalarVariant('datetime'),
            scalarVariant('object'),
            scalarVariant('trait'),
            scalarVariant('slot'),
            scalarVariant('pattern'),
            // Enum variant — REQUIRES non-empty values.
            z.object({
                ...baseFieldShape,
                type: z.literal('enum'),
                values: z.array(z.string()).min(1, 'Enum field requires a non-empty `values` array'),
            }),
            // Relation variant — REQUIRES relation config.
            z.object({
                ...baseFieldShape,
                type: z.literal('relation'),
                relation: RelationConfigSchema,
            }),
            // Array variant — items optional to match relaxed TS shape.
            z.object({
                ...baseFieldShape,
                type: z.literal('array'),
                items: EntityFieldSchema.optional(),
            }),
        ]),
    );
});

export type EntityFieldInput = z.input<typeof EntityFieldSchema>;

// ============================================================================
// Type Aliases (for cleaner imports)
// ============================================================================

/** Alias for EntityField - preferred name */
export type Field = EntityField;

/** Alias for EntityFieldSchema - preferred name */
export const FieldSchema = EntityFieldSchema;
