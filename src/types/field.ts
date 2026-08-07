/**
 * Field Types for Orbital Units
 *
 * Extracted from schema/data-entities.ts for the orbitals module.
 * These types define the field structure within orbital entities.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { EntityId } from './identity.js';
import { EntityIdSchema } from './identity.js';
import type { JsonValue, RuntimeValue } from './json.js';
import { JsonValueSchema } from './json.js';

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
    // Semantic string domains. `.lolo` already types `date`/`datetime` rather
    // than annotating them, so these belong in the type system for the same
    // reason: a field's domain is a declared fact, not a decoration. They
    // replaced the optional `format` property, which had zero producers.
    | 'email'
    | 'url'
    | 'phone'
    | 'uuid'
    | 'image'
    | 'array'
    | 'object'
    | 'enum'
    | 'relation'
    | 'trait'
    | 'slot'
    | 'pattern';

/** Every `FieldType`, as a runtime array. Downstream imports this instead of
 *  re-listing the union — five copies had already drifted apart. */
export const FIELD_TYPES = [
    'string',
    'number',
    'boolean',
    'date',
    'timestamp',
    'datetime',
    'email',
    'url',
    'phone',
    'uuid',
    'image',
    'array',
    'object',
    'enum',
    'relation',
    'trait',
    'slot',
    'pattern',
] as const satisfies readonly FieldType[];

/** The semantic string domains — constrained strings, validatable by value. */
export const SEMANTIC_STRING_TYPES = ['email', 'url', 'phone', 'uuid', 'image'] as const;

export type SemanticStringType = (typeof SEMANTIC_STRING_TYPES)[number];

/** Is this a semantic string domain (as opposed to a bare `string`)? */
export function isSemanticStringType(type: FieldType): type is SemanticStringType {
    return (SEMANTIC_STRING_TYPES as readonly string[]).includes(type);
}

export const FieldTypeSchema = z.enum(FIELD_TYPES);

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
export type RelationConfig = {
    /** Target entity name (e.g., 'User', 'Task') - matches Rust's `entity` field */
    entity: string;
    /** V4 dual-carry id sibling of `entity` — optional until the Phase-7 flip. */
    entityId?: EntityId;
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
};

export const RelationConfigSchema = z.object({
    entity: z.string().min(1, 'Target entity is required'),
    entityId: EntityIdSchema.optional(),
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
        entityId: data.entityId,
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
 * Value rules for the semantic string domains — one owner, so the seeders, the
 * validators and the verifiers cannot drift apart on what counts as valid.
 *
 * These replaced the old optional `format` property, which had zero producers
 * anywhere in the repo and no Rust counterpart at all: `format` was unreachable
 * from `.lolo`, so every consumer fell back to guessing from field names.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{7,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEmailValue(value: string): boolean {
    return EMAIL_RE.test(value);
}

export function isUrlValue(value: string): boolean {
    return URL_RE.test(value);
}

export function isPhoneValue(value: string): boolean {
    return PHONE_RE.test(value);
}

export function isUuidValue(value: string): boolean {
    return UUID_RE.test(value);
}

/** Does `value` satisfy the declared semantic domain? `image` is a URL. */
export function isSemanticStringValue(type: SemanticStringType, value: string): boolean {
    switch (type) {
        case 'email':
            return isEmailValue(value);
        case 'url':
        case 'image':
            return isUrlValue(value);
        case 'phone':
            return isPhoneValue(value);
        case 'uuid':
            return isUuidValue(value);
    }
}

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
    | 'email'
    | 'url'
    | 'phone'
    | 'uuid'
    | 'image'
    | 'trait'
    | 'slot'
    | 'pattern';

/** Fields shared across every variant. */
type EntityFieldBase = {
    /**
     * Field name (camelCase). Optional for nested item/property descriptors
     * where the name is implied by the parent (`items`, `properties[k]`).
     * Mirrors Rust's `FieldDefinition.name: Option<String>`.
     */
    name?: string;
    /** Whether the field is required */
    required?: boolean;
    /** Primary-key marker. Mirrors Rust's `FieldDefinition.primary_key`
     *  (serde `primaryKey`). */
    primaryKey?: boolean;
    /** Default value — parsed from `.orb`, always JSON-shaped. */
    default?: JsonValue;
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
    /** Runtime-managed widget state (authored `@intrinsic` in `.lolo`). Exempt
     *  from the explicit-binding rule and never a domain-data bind target. */
    intrinsic?: boolean;
    /** Human/semantic description (authored `@description "..."` in `.lolo`).
     *  Authoring/build-time metadata — factory-signature catalog, embeddings,
     *  curation field-matching; the runtime ignores it. */
    description?: string;
    /** User-vocabulary synonyms (authored `@synonyms "..."` in `.lolo`).
     *  Free text feeding catalog search / curation field-matching. */
    synonyms?: string;
};

/**
 * Scalar / structural fields — no type-dependent payload required.
 * `values?` is permitted as an OPTIONAL UI/validation hint (e.g. lolo's
 * `'a' | 'b' | 'c'` string-union sugar lowers to `type: 'string', values:
 * [...]`). Only `EnumEntityField` MANDATES values.
 */
export type ScalarEntityField = EntityFieldBase & {
    type: ScalarFieldType;
    /** Optional vocabulary hint for scalar fields (e.g. string unions
     *  authored as `'a'|'b'|'c'` in lolo). Not required at this variant. */
    values?: string[];
};

/** `type: 'enum'` REQUIRES the closed vocabulary in `values`. */
export type EnumEntityField = EntityFieldBase & {
    type: 'enum';
    /** Closed string vocabulary the field accepts. */
    values: string[];
};

/** `type: 'relation'` REQUIRES the relation target binding. */
export type RelationEntityField = EntityFieldBase & {
    type: 'relation';
    /** Relation target binding (entity + cardinality). */
    relation: RelationConfig;
};

/** `type: 'array'` — element schema in `items` strongly preferred but
 *  optional for legacy compatibility with codegen-emitted scalar-array
 *  fields (e.g. `{type: 'array', default: []}`). The lolo lowerer + Rust
 *  validator catch typed-element-required cases downstream. */
export type ArrayEntityField = EntityFieldBase & {
    type: 'array';
    /** Element schema for the array. */
    items?: EntityField;
};

/**
 * `type: 'object'` — a fixed-key struct (fields in `properties`) OR a
 * dynamic-key map (`Map K V` in `.lolo`; the uniform value schema lives in
 * `items`, mirroring an array's element schema). A distinct variant so `items`
 * is statically allowed only on object/array fields, never on scalars.
 */
export type ObjectEntityField = EntityFieldBase & {
    type: 'object';
    /** Uniform value schema for a dynamic-key map (`Map K V`). */
    items?: EntityField;
};

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
    | ArrayEntityField
    | ObjectEntityField;

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
// The third type param stays `unknown`: zod v3 bakes `unknown` into
// `z.preprocess`'s input type, and the recursion needs the explicit annotation.
export const EntityFieldSchema: z.ZodType<EntityField, z.ZodTypeDef, unknown> = z.lazy(() => {
    const baseFieldShape = {
        name: z.string().min(1, 'Field name is required').optional(),
        required: z.boolean().optional(),
        primaryKey: z.boolean().optional(),
        default: JsonValueSchema.optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        properties: z.record(EntityFieldSchema).optional(),
        intrinsic: z.boolean().optional(),
        description: z.string().optional(),
        synonyms: z.string().optional(),
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
                typeof (input as { type?: RuntimeValue }).type !== 'string'
            ) {
                return input;
            }
            const obj = input as { type: string; enum?: RuntimeValue; values?: RuntimeValue };
            const next: { type: string; enum?: RuntimeValue; values?: RuntimeValue } = { ...obj };
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
            scalarVariant('email'),
            scalarVariant('url'),
            scalarVariant('phone'),
            scalarVariant('uuid'),
            scalarVariant('image'),
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
            // Object variant — fixed-key struct (`properties`) or dynamic-key
            // map (`Map K V`, uniform value schema in `items`).
            z.object({
                ...baseFieldShape,
                type: z.literal('object'),
                items: EntityFieldSchema.optional(),
                values: z.array(z.string()).optional(),
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
