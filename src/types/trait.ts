/**
 * Trait Types (Self-Contained)
 *
 * Defines trait types for behavioral patterns.
 * Self-contained - imports only from local orbital types.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { TraitId, EntityId, EventId, PageId, OrbitalId } from './identity.js';
import type { StateMachine } from './state-machine.js';
import { StateMachineSchema } from './state-machine.js';
import type { Effect } from './effect.js';
import { EffectSchema } from './effect.js';
import type { Entity } from './entity.js';
import { EntitySchema } from './entity.js';
import type { AnyPatternConfig } from '../patterns/index.js';
import type { Expression } from './expression.js';
import { ExpressionSchema } from './expression.js';

// ============================================================================
// Trait Configuration
// ============================================================================

/**
 * A single value in a trait's call-site `config: { ... }` block. Supports
 * scalars (string, number, boolean, null), arrays (e.g. `fields: ["name",
 * "description"]`), and nested objects. This is the authoring surface for
 * molecules to parameterize imported atoms: the atom's render-ui reads back
 * via `@config.<key>` bindings.
 */
export type TraitConfigValue =
    | string
    | number
    | boolean
    | null
    | ReadonlyArray<TraitConfigValue>
    | TraitConfigObject;

export interface TraitConfigObject {
    readonly [key: string]: TraitConfigValue;
}

export type TraitConfig = TraitConfigObject;

/** Zod schema for TraitConfig. Recursive via z.lazy to allow nested structures. */
export const TraitConfigValueSchema: z.ZodType<TraitConfigValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(TraitConfigValueSchema),
        z.record(TraitConfigValueSchema),
    ])
);

export const TraitConfigSchema: z.ZodType<TraitConfig> = z.record(TraitConfigValueSchema);

/**
 * A single entry in a call-site `config { }` override block. Either a plain
 * wiring value (`TraitConfigValue` — string, number, bool, array, object) or
 * a fully-annotated re-declaration (`ConfigFieldDeclaration` — carries `type`,
 * optional `label`/`description`/`synonyms`/`tier`). Disambiguated at runtime
 * by `isCallSiteConfigDeclaration`: the presence of a `"type"` string key
 * marks the annotated form.
 *
 * The `.orb` compiler emits plain values for wiring entries and
 * `{ type, default, ... }` objects for annotated entries. Consumers that only
 * need the value (e.g. `apply-params-to-orb.ts`) read `entry` directly for
 * primitives or `entry.default` for the declaration form.
 */
export type CallSiteConfigEntry = TraitConfigValue | ConfigFieldDeclaration;

/** Typed map of call-site config entries (one per knob). */
export type CallSiteConfig = Readonly<Record<string, CallSiteConfigEntry>>;

/**
 * Type guard: returns `true` when `entry` is an annotated `ConfigFieldDeclaration`
 * (a config-field SCHEMA: a `"type"` string key AND a `"default"` value slot)
 * rather than a plain wiring value or a render value object.
 *
 * The `"default"` requirement disambiguates a declaration from a `render-ui`
 * VALUE object (e.g. `{ type: "tabs", items: "@entity.items", ... }`) that
 * coincidentally carries a UI-component `type` key — such a value has no
 * `default` slot and is a `TraitConfigValue`, not a schema declaration. Every
 * annotated config field lowered from `.lolo` carries a `default`; misreading a
 * render value as a declaration drops it straight into the `config` map where
 * Rust's `serde` rejects its inner fields (e.g. `items` is a binding string,
 * not a `FieldDefinition`).
 */
export function isCallSiteConfigDeclaration(
    entry: CallSiteConfigEntry,
): entry is ConfigFieldDeclaration {
    return (
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        'type' in entry &&
        typeof entry.type === 'string' &&
        'default' in entry
    );
}

/** Metadata keys that only ever appear on a declared config-field SCHEMA
 *  (never on a render-value object that merely carries a UI `type` key). */
const CONFIG_DECLARATION_META_KEYS = ['label', 'description', 'tier', 'synonyms', 'values'] as const;

/**
 * Type guard: `entry` is a declared config-field SCHEMA — a string `type` plus
 * EITHER a `default` slot OR declaration metadata (`label`/`description`/
 * `tier`/`synonyms`/`values`). Broader than `isCallSiteConfigDeclaration`,
 * which requires a `default`: a field declared with no default (e.g.
 * `leftIcon : icon` → `{ type: "icon", label, description, tier }`) is still a
 * schema, and its runtime VALUE is its (absent → `undefined`) default, NOT the
 * schema object itself. A render-value object that coincidentally has a `type`
 * key (e.g. `{ type: "tabs", items: … }`) carries none of these metadata keys
 * and is therefore left untouched as a plain value.
 */
function isConfigFieldSchema(entry: CallSiteConfigEntry): entry is ConfigFieldDeclaration {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
    if (!('type' in entry) || typeof (entry as { type?: unknown }).type !== 'string') return false;
    return 'default' in entry || CONFIG_DECLARATION_META_KEYS.some((k) => k in entry);
}

/**
 * Convert a call-site config map into plain runtime values.
 *
 * A `CallSiteConfig` may contain either plain wiring values
 * (`TraitConfigValue`) or annotated `ConfigFieldDeclaration` objects
 * (`{ type, default, label, ... }`). Both the JS interpreter
 * (`@almadar/runtime`) and the render substrate (`@almadar/ui`) need this
 * extraction, so it lives here — the most-upstream package they share —
 * rather than being duplicated in each.
 *
 * A declared field with no `default` yields no value (dropped) — mirroring
 * `collectDeclaredConfigDefaults`. Leaking such a schema object through as a
 * value made `@config.leftIcon` resolve to `{ type: "icon", … }`, which the
 * render substrate then mounted as an element and passed to `Input`'s icon
 * slot → "Element type is invalid: got <SlotContentRenderer />".
 */
export function normalizeCallSiteConfigToValues(
    config: CallSiteConfig | undefined,
): TraitConfig | undefined {
    if (config === undefined) {
        return undefined;
    }

    const out: Record<string, TraitConfigValue> = {};
    let hasAny = false;
    for (const [key, entry] of Object.entries(config)) {
        const value = isConfigFieldSchema(entry)
            ? entry.default
            : entry;
        if (value !== undefined) {
            out[key] = value;
            hasAny = true;
        }
    }

    return hasAny ? out : undefined;
}

/**
 * Per-field entry in a trait's DECLARED `config { }` schema as it lives
 * on the `.orb` JSON: `{ type: "string" | "[string]" | "object" | ...,
 * default?: <value> }`. Distinct from `TraitConfigValue` (which is the
 * resolved runtime value). The runtime reads `default` to seed the
 * `@config.X` binding context when no call-site override is supplied.
 *
 * Authored as `config { foo : string = "bar" }` in `.lolo`; lowered to
 * `{ foo: { type: "string", default: "bar" } }` in `.orb`. The optional
 * metadata fields below (`label`/`description`/`tier`/`values`/`synonyms`)
 * carry the `.lolo` `@label`/`@description`/`@tier`/`@synonyms` annotations and
 * the enum member list through lowering — consumed by config-driven UI
 * (e.g. the playground property inspector) to render typed controls.
 */
export interface ConfigFieldDeclaration {
    readonly type: string;
    readonly default?: TraitConfigValue;
    /** Marks the knob as mandatory at every call site (own-page binding exempt). `required` + `default` may coexist — the default only serves the trait's own demo page. */
    readonly required?: boolean;
    /** `@label` — human-readable control label. */
    readonly label?: string;
    /** `@description` — help/tooltip text for the field. */
    readonly description?: string;
    /** `@tier` — disclosure tier: `presentation`|`domain`|`policy`|`infra`|`internal`. */
    readonly tier?: string;
    /** Enum members when the field's type is a string union — drives a select control. */
    readonly values?: ReadonlyArray<string>;
    /** `@synonyms` — comma-separated vocabulary synonyms (metadata). */
    readonly synonyms?: string;
    /** Structured per-item schema for array-of-object fields — `edges : [{from: string!, …}]` in `.lolo` lowers to `{ type: "object", properties: {…} }`. */
    readonly items?: ConfigFieldItemsDeclaration;
    /** Structured property schema for object-typed config fields (no items wrapper). */
    readonly properties?: Readonly<Record<string, TraitEntityField>>;
}

export interface ConfigFieldItemsDeclaration {
    readonly type?: string;
    /** Absent for arrays of scalars (`items: { type: "string" }`). */
    readonly properties?: Readonly<Record<string, TraitEntityField>>;
    /** Nested per-item schema for arrays of arrays (recursive). */
    readonly items?: ConfigFieldItemsDeclaration;
}

export const ConfigFieldItemsDeclarationSchema: z.ZodType<ConfigFieldItemsDeclaration> = z.lazy(() =>
    z.object({
        type: z.string().optional(),
        properties: z.record(TraitEntityFieldSchema).optional(),
        items: ConfigFieldItemsDeclarationSchema.optional(),
    }),
);

export const ConfigFieldDeclarationSchema: z.ZodType<ConfigFieldDeclaration> = z.object({
    type: z.string(),
    default: TraitConfigValueSchema.optional(),
    required: z.boolean().optional(),
    label: z.string().optional(),
    description: z.string().optional(),
    tier: z.string().optional(),
    values: z.array(z.string()).optional(),
    synonyms: z.string().optional(),
    items: ConfigFieldItemsDeclarationSchema.optional(),
    properties: z.lazy(() => z.record(TraitEntityFieldSchema)).optional(),
});

/**
 * Map of declared config fields keyed by name. Lives on `Trait.config`
 * and `ResolvedTrait.config` for atoms/molecules that expose typed
 * configuration to consumers.
 */
export type DeclaredTraitConfig = Readonly<Record<string, ConfigFieldDeclaration>>;

export const DeclaredTraitConfigSchema: z.ZodType<DeclaredTraitConfig> = z.record(
    ConfigFieldDeclarationSchema,
);

// ============================================================================
// Trait Categories
// ============================================================================

/**
 * Categories for organizing traits
 */
export type TraitCategory =
    | 'lifecycle'
    | 'temporal'
    | 'validation'
    | 'notification'
    | 'integration'
    | 'interaction'
    | 'agent'
    | 'game-core'
    | 'game-character'
    | 'game-ai'
    | 'game-combat'
    | 'game-items'
    | 'game-cards'
    | 'game-board'
    | 'game-puzzle';

export const TraitCategorySchema = z.enum([
    'lifecycle',
    'temporal',
    'validation',
    'notification',
    'integration',
    'interaction',
    'agent',
    'game-core',
    'game-character',
    'game-ai',
    'game-combat',
    'game-items',
    'game-cards',
    'game-board',
    'game-puzzle',
]);

// ============================================================================
// Trait Entity Field (simplified)
// ============================================================================

/**
 * Field types for trait data entities
 */
export type TraitFieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'timestamp' | 'datetime' | 'enum';

/**
 * Simplified field for trait data entities
 */
export interface TraitEntityField {
    name: string;
    type: TraitFieldType;
    required?: boolean;
    default?: unknown;
    values?: string[];
    /** Structured per-item schema for array-of-object fields (recursive). */
    items?: ConfigFieldItemsDeclaration;
    /** Structured property schema for object-typed entity fields. */
    properties?: Readonly<Record<string, TraitEntityField>>;
}

export const TraitEntityFieldSchema: z.ZodType<TraitEntityField> = z.object({
    name: z.string().min(1),
    type: z.enum([
        'string',
        'number',
        'boolean',
        'date',
        'array',
        'object',
        'timestamp',
        'datetime',
        'enum',
    ]),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    values: z.array(z.string()).optional(),
    items: ConfigFieldItemsDeclarationSchema.optional(),
    properties: z.lazy(() => z.record(TraitEntityFieldSchema)).optional(),
});

// ============================================================================
// Trait Data Entity
// ============================================================================

/**
 * Simplified data entity for traits
 */
export interface TraitDataEntity {
    name: string;
    collection?: string;
    fields: TraitEntityField[];
    timestamps?: boolean;
    description?: string;
    runtime?: boolean;
    singleton?: boolean;
    pages?: string[];
}

export const TraitDataEntitySchema = z.object({
    name: z.string().min(1),
    collection: z.string().optional(),
    fields: z.array(TraitEntityFieldSchema).min(1),
    timestamps: z.boolean().optional(),
    description: z.string().optional(),
    runtime: z.boolean().optional(),
    singleton: z.boolean().optional(),
    pages: z.array(z.string()).optional(),
});

// ============================================================================
// Trait Tick
// ============================================================================

/**
 * Tick rule for traits.
 * Guards can be legacy strings or S-expressions.
 * Effects can be typed Effect objects or S-expressions.
 */
export interface TraitTick {
    name: string;
    description?: string;
    priority?: number;
    interval: string | number;
    appliesTo?: string[];
    pages?: string[];
    /** V4 dual-carry id sibling of `pages` — optional until the Phase-7 flip. */
    pageIds?: PageId[];
    /** Guard expression - string (legacy) or S-expression array */
    guard?: Expression;
    /** Effects to execute (S-expressions) */
    effects: Effect[];
    /**
     * Events this tick emits.
     * Must reference events defined in trait's emits array.
     * Used for validation and documentation.
     */
    emits?: string[];
    /** V4 dual-carry id sibling of `emits` — optional until the Phase-7 flip. */
    emitIds?: EventId[];
}

export const TraitTickSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    priority: z.number().optional(),
    interval: z.union([z.literal('frame'), z.number().positive()]),
    appliesTo: z.array(z.string()).optional(),
    pages: z.array(z.string()).optional(),
    guard: ExpressionSchema.optional(),
    effects: z.array(EffectSchema).min(1),
    emits: z.array(z.string()).optional(),
});

// ============================================================================
// Event Scope
// ============================================================================

/**
 * Event scope determines visibility:
 * - 'internal': Trait-to-trait within same orbital (default)
 * - 'external': Exposed for cross-orbital communication
 */
export type EventScope = 'internal' | 'external';

export const EventScopeSchema = z.enum(['internal', 'external']);

// ============================================================================
// Event Payload Field
// ============================================================================

/**
 * Payload field definition for events.
 * Defines the structure of data carried by events.
 */
export interface EventPayloadField {
    /** Field name */
    name: string;
    /**
     * Field type. Any non-empty string, mirroring the Rust validator's
     * acceptance (Zod schema below uses `z.string().min(1)`). Well-known
     * values include the primitives (`string`, `number`, `boolean`,
     * `object`, `array`, `entity`), date variants (`date`, `datetime`,
     * `timestamp`), entity-name references (`User`), and array-of-entity
     * shorthand (`[User]`). Narrowing happens at the call sites that care
     * (e.g. `orbital-compiler/phases/validation/emit_payload.rs`), not at
     * the structural type level — this keeps `.orb`-emitted payloads
     * round-trippable through TypeScript without losing precision.
     */
    type: string;
    /** Whether field is required in payload */
    required?: boolean;
    /** Human-readable description */
    description?: string;
    /** For 'entity' type: the entity type name */
    entityType?: string;
    /** Structured property schema for object-typed payload fields (recursive). */
    properties?: ReadonlyArray<EventPayloadField>;
}

export const EventPayloadFieldSchema: z.ZodType<EventPayloadField> = z.object({
    name: z.string().min(1),
    /**
     * Field type. Mirrors the Rust validator's acceptance: any non-empty
     * string. Primitives ('string' | 'number' | 'boolean' | 'object' |
     * 'array') are the canonical values; entity-name references like
     * 'ModalRecord' and array-of-entity references like '[ModalRecord]'
     * are also valid because the Rust IR's PayloadField.field_type is
     * just a String. Only enforced narrowly at the call site (e.g.
     * emit-literal type-mismatch warnings in
     * orbital-compiler/phases/validation/emit_payload.rs) — not here.
     */
    type: z.string().min(1),
    required: z.boolean().optional(),
    description: z.string().optional(),
    entityType: z.string().optional(),
    properties: z.lazy(() => z.array(EventPayloadFieldSchema)).optional(),
});

// ============================================================================
// Trait Event Contract
// ============================================================================

/**
 * Event contract for events a trait emits.
 * Declares the event name, scope, and payload schema.
 */
export interface TraitEventContract {
    /** Event name (UPPER_SNAKE_CASE) */
    event: string;
    /** V4 dual-carry id sibling of `event` — optional until the Phase-7 flip. */
    eventId?: EventId;
    /** Human-readable description */
    description?: string;
    /** User-vocabulary synonyms (comma-separated) — the per-event analogue of a
     *  field/config `@synonyms`. Feeds the curation event matcher. */
    synonyms?: string;
    /** Authoring tier (`essential`/`customization`/`advanced`/`internal`). */
    tier?: string;
    /** Payload schema — declarative type info for the event's payload.
     *  Distinct from the runtime payload value (`@payload.X` bindings,
     *  `EventPayload`) which is a separate concept. */
    payloadSchema?: EventPayloadField[];
    /**
     * Event scope:
     * - 'internal': Trait-to-trait within same orbital (default)
     * - 'external': Exposed for cross-orbital communication
     */
    scope?: EventScope;
}

/**
 * `@config.<knob>` is the only legal reference form for an emit/listen
 * event name (Option B — the declared event name resolves to a
 * string-typed config knob's value at inline/resolve time). Matches the
 * Rust lexer's dotted-sigil body (`config.<ident>`, no further dots).
 */
export const CONFIG_REF_EVENT_PATTERN = /^@config\.[A-Za-z_][A-Za-z0-9_]*$/;

/** Returns the knob identifier when `event` is a `@config.<knob>` reference, else `undefined`. */
export function configRefEventKnob(event: string): string | undefined {
    return CONFIG_REF_EVENT_PATTERN.test(event) ? event.slice('@config.'.length) : undefined;
}

/** Why a `@config.<knob>` emit/listen event-name reference failed to resolve. */
export type ConfigRefEventError = 'unknown-knob' | 'not-string' | 'no-default';

/**
 * Resolve a `@config.<knob>` emit/listen event-name reference to its
 * concrete literal, given the trait's declared config schema and the
 * effective config value map (call-site override folded over declared
 * default — same precedence the Rust inline phase's `effective_config`
 * uses). The single JS-side owner of this resolution rule; mirrors
 * `resolve_config_ref_event_name` in `orbital-core::schema` (Rust).
 * Returns the resolved literal, or the specific contract clause that failed.
 */
export function resolveConfigRefEventName(
    event: string,
    declaredConfig: DeclaredTraitConfig | undefined,
    effectiveConfig: Readonly<Record<string, TraitConfigValue>>,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: ConfigRefEventError } {
    const knob = configRefEventKnob(event);
    if (knob === undefined) return { ok: false, error: 'unknown-knob' };
    const field = declaredConfig?.[knob];
    if (field === undefined) return { ok: false, error: 'unknown-knob' };
    if (field.type !== 'string') return { ok: false, error: 'not-string' };
    if (field.default === undefined) return { ok: false, error: 'no-default' };
    const value = effectiveConfig[knob];
    if (typeof value !== 'string') return { ok: false, error: 'not-string' };
    return { ok: true, value };
}

export const TraitEventContractSchema = z.object({
    /**
     * Event name. Mirrors the Rust validator's `is_valid_event_identifier`:
     * starts with a letter, then any letters / digits / underscores. Both
     * UPPER_SNAKE_CASE and PascalCase shapes are valid identifiers in the
     * post-Phase 2.5 nominal-event type system (events declared via
     * `type X = Event<T>`). A pre-resolution `@config.<knob>` reference
     * (Option B) is also legal — inline/resolve substitutes it with the
     * knob's effective literal before codegen/runtime consume it.
     */
    event: z.string().min(1).regex(
        /^([A-Za-z][A-Za-z0-9_]*|@config\.[A-Za-z_][A-Za-z0-9_]*)$/,
        'Event name must start with a letter and contain only letters, digits, and underscores, or be a `@config.<knob>` reference'
    ),
    description: z.string().optional(),
    synonyms: z.string().optional(),
    tier: z.string().optional(),
    payloadSchema: z.array(EventPayloadFieldSchema).optional(),
    scope: EventScopeSchema.optional(),
});

// ============================================================================
// Trait Event Listener
// ============================================================================

/**
 * Event listener for trait communication.
 * Guards can be legacy strings or S-expressions.
 * Enhanced with scope and payloadMapping for cross-orbital communication.
 */
/**
 * Source-scoping for a `listens {}` entry. Determines which emitters the
 * listener responds to.
 *
 * - `{ kind: "any" }`: wildcard (`* EVENT -> TRIGGER`). Any trait, any orbital.
 * - `{ kind: "trait", trait: "X" }`: intra-orbital (`X EVENT -> TRIGGER`).
 *   Only emits from the same orbital's trait `X`.
 * - `{ kind: "orbital", orbital: "O", trait: "X" }`: cross-orbital
 *   (`O.X EVENT -> TRIGGER`). Only emits from orbital `O`'s trait `X`.
 *
 * Absent (undefined) means the listener is a local payload-declaration only
 * — pure type metadata, no bus subscription.
 */
export type ListenSource =
    | { kind: 'any' }
    | {
        kind: 'trait';
        trait: string;
        /** V4 dual-carry id sibling of `trait` — optional until the Phase-7 flip. */
        traitId?: TraitId;
      }
    | {
        kind: 'orbital';
        orbital: string;
        trait: string;
        /** V4 dual-carry id sibling of `orbital` — optional until the Phase-7 flip. */
        orbitalId?: OrbitalId;
        /** V4 dual-carry id sibling of `trait` — optional until the Phase-7 flip. */
        traitId?: TraitId;
      };

export const ListenSourceSchema = z.union([
    z.object({ kind: z.literal('any') }),
    z.object({ kind: z.literal('trait'), trait: z.string().min(1) }),
    z.object({
        kind: z.literal('orbital'),
        orbital: z.string().min(1),
        trait: z.string().min(1),
    }),
]);

export interface TraitEventListener {
    /** Event key to listen for (bare event name, no source prefix in the new shape) */
    event: string;
    /** V4 dual-carry id sibling of `event` — optional until the Phase-7 flip. */
    eventId?: EventId;
    /** State machine event to trigger */
    triggers: string;
    /** V4 dual-carry id sibling of `triggers` — optional until the Phase-7 flip. */
    triggersId?: EventId;
    /** Human-readable description (authored `@description` on the listen). */
    description?: string;
    /** User-vocabulary synonyms (comma-separated). */
    synonyms?: string;
    /** Authoring tier (`essential`/`customization`/`advanced`/`internal`). */
    tier?: string;
    /** Guard expression - string (legacy) or S-expression array */
    guard?: Expression;
    /**
     * Listener scope:
     * - 'internal': Listen to events within same orbital (default)
     * - 'external': Listen to events from other orbitals
     */
    scope?: EventScope;
    /** Map event payload fields to transition payload */
    payloadMapping?: Record<string, string>;
    /**
     * Source scoping (see `ListenSource`). Undefined when the listen entry is
     * a local payload declaration rather than a bus subscription.
     */
    source?: ListenSource;
}

export const TraitEventListenerSchema = z.object({
    event: z.string().min(1),
    triggers: z.string().min(1),
    description: z.string().optional(),
    synonyms: z.string().optional(),
    tier: z.string().optional(),
    guard: ExpressionSchema.optional(),
    scope: EventScopeSchema.optional(),
    payloadMapping: z.record(z.string()).optional(),
    source: ListenSourceSchema.optional(),
});

// ============================================================================
// Required Field
// ============================================================================

/**
 * Field required by a trait from its linkedEntity
 */
export interface RequiredField {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'timestamp' | 'datetime' | 'enum';
    description?: string;
}

export const RequiredFieldSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object', 'timestamp', 'datetime', 'enum']),
    description: z.string().optional(),
});

// ============================================================================
// Trait Reference
// ============================================================================

/**
 * Reference to a trait from an entity or page.
 *
 * Phase F treats a trait reference as a function call: `ref` names the
 * imported trait and the sibling fields are arguments. The compiler's
 * identifier-substitution pass uses these arguments to rewrite the
 * inlined trait clone before lowering.
 */
export interface TraitReference {
    ref: string;
    /** V4 dual-carry id sibling of `ref` — optional until the Phase-7 flip. */
    refId?: TraitId;
    /**
     * Phase 1.2: optional registry path disambiguator. Pairs with `ref` to
     * explicitly name which `uses` entry the alias was imported from
     * (e.g. "std/behaviors/atoms/std-browse"). Helpful for programmatic
     * descriptor construction and inline-phase disambiguation when multiple
     * registries expose the same alias prefix.
     */
    from?: string;
    linkedEntity?: string;
    /** V4 dual-carry id sibling of `linkedEntity` — optional until the Phase-7 flip. */
    linkedEntityId?: EntityId;
    /** Phase F: rename the inlined trait at the call site */
    name?: string;
    /** Phase F: rename atom event keys at the call site, e.g. {OPEN: "ADD_ITEM"} */
    events?: Record<string, string>;
    /** V4 dual-carry id sibling of `events` (keys = baked event names resolved to ids) — optional until the Phase-7 flip. */
    eventIds?: Record<string, EventId>;
    /**
     * Entity-field remap: rewrite the inlined trait's canonical `@entity.X` /
     * `@payload.row.X` field references to the consumer entity's field names,
     * e.g. `{ name: "title", folder: "parentId" }`. Mirrors `events` for
     * fields. Applied during inline substitution alongside `linkedEntity`.
     */
    fields?: Record<string, string>;
    /**
     * Call-site config overrides. Each entry is either a plain wiring value
     * (`TraitConfigValue`) or a fully-annotated re-declaration
     * (`ConfigFieldDeclaration` with `type`, optional `label`/`description`/
     * `synonyms`/`tier`). Use `isCallSiteConfigDeclaration` to discriminate.
     *
     * Plain wiring (existing callers): `config: { icon: "star", count: 5 }`.
     * Annotated (new): `config: { icon: { type: "string", default: "star",
     *   label: "Icon", tier: "presentation" } }`.
     */
    config?: CallSiteConfig;
    appliesTo?: string[];
    /**
     * Phase F.7: replace the imported trait's `listens` array with the
     * caller-supplied list. Empty array clears all upstream listens. The
     * inliner applies this AFTER substitution, overwriting whatever the
     * upstream declared. Use sparingly: this drops external event wiring.
     */
    listens?: TraitEventListener[];
    /**
     * Phase F.7: set every emit's `scope` to the caller-supplied value.
     * `'internal'` confines emits to the orbital's internal bus; `'external'`
     * broadcasts them. Applied after substitution and listens replacement.
     */
    emitsScope?: 'internal' | 'external';
    /**
     * Phase F.8: per-transition effects override. The map's keys are event
     * names (the transition triggers, AFTER any rename via `events`). The
     * values are the SExpression effect lists that REPLACE the matching
     * transitions' `effects[]` arrays.
     *
     * This is the unified content + effect override mechanism. Whether the
     * override list contains `["render-ui", ...]` (visual content),
     * `["fetch", ...]` (data load), `["persist", ...]` (mutation), or any
     * combination, the inliner just substitutes the whole list. Identifier
     * substitution (entity refs, event refs) still runs over the merged
     * trait body, so override effects can use either upstream or caller
     * identifiers and the F.3 walker will rewrite them consistently.
     *
     * Example:
     * ```json
     * "effects": {
     *   "ADD_ITEM": [
     *     ["fetch", "CartItem"],
     *     ["render-ui", "main", { ... }]
     *   ],
     *   "SAVE": [
     *     ["persist", "create", "CartItem", "@payload.data"]
     *   ]
     * }
     * ```
     */
    effects?: Record<string, unknown[]>;
}

export const TraitReferenceSchema = z
    .object({
        ref: z.string().min(1),
        // Phase 1.2: optional registry path disambiguator, pairs with `ref`.
        from: z.string().optional(),
        linkedEntity: z.string().optional(),
        name: z.string().optional(),
        events: z
            .record(
                z.string().min(1, "events key (atom event name) must be non-empty"),
                z.string().min(1, "events value (caller event name) must be non-empty"),
            )
            .optional(),
        fields: z
            .record(
                z.string().min(1, "fields key (canonical field name) must be non-empty"),
                z.string().min(1, "fields value (consumer field name) must be non-empty"),
            )
            .optional(),
        // Each value is either a plain wiring value (TraitConfigValue) or an
        // annotated ConfigFieldDeclaration. Declaration form is tried first
        // (it's more specific — has a `"type"` string key); plain values fall
        // through to the recursive TraitConfigValue union.
        config: z.record(z.union([ConfigFieldDeclarationSchema, TraitConfigValueSchema])).optional(),
        appliesTo: z.array(z.string()).optional(),
        // Phase F.7: zod accepts an array (the inliner validates element
        // shape). The full ListenDefinition shape isn't recursively encoded
        // here because TraitReference is the call-site form — listen entries
        // pasted in are already-resolved structured definitions, not nested
        // overrides.
        listens: z.array(z.unknown()).optional(),
        emitsScope: z.enum(['internal', 'external']).optional(),
        // Phase F.8: per-transition effects override. The keys are event
        // names (the transition triggers AFTER renames). Values are arrays
        // of SExpression-shaped data; the inliner validates the SExpression
        // shape during application, so the schema accepts loose `unknown[]`.
        effects: z
            .record(
                z.string().min(1, "effects override key (event name) must be non-empty"),
                z.array(z.unknown()),
            )
            .optional(),
    })
    .refine(
        (ref) => {
            if (!ref.events) return true;
            // Phase F.4: reject empty event-name strings on either side of
            // every entry. The substitution pass treats empty strings as
            // no-ops at runtime, but accepting them at the schema boundary
            // hides authoring errors. The per-entry .min(1) above already
            // rejects most cases; this refine is the belt-and-braces check
            // that survives any future relaxation of the inner validators.
            for (const [from, to] of Object.entries(ref.events)) {
                if (from.length === 0 || to.length === 0) return false;
            }
            return true;
        },
        {
            message:
                'TraitReference "events" entries must have non-empty atom and caller event names',
            path: ["events"],
        },
    );

/**
 * Simplified trait reference - supports string, reference object, or inline Trait definition
 * - string: "TraitName" - reference to a trait by name
 * - { ref: "TraitName" }: reference object with optional config / overrides
 * - { name: "TraitName", stateMachine: {...} }: inline trait definition
 *
 * Phase F adds `name` and `events` to the reference object form so callers
 * can rename the trait and remap atom event keys.
 */
export type TraitRef =
    | string
    | {
        ref: string;
        config?: CallSiteConfig;
        linkedEntity?: string;
        name?: string;
        events?: Record<string, string>;
    }
    | Trait;

// TraitRefSchema is defined after TraitSchema (see below) to avoid forward reference

// ============================================================================
// Trait UI Binding
// ============================================================================

export type PresentationType = 'modal' | 'drawer' | 'popover' | 'inline' | 'confirm-dialog';

export interface TraitUIBinding {
    [stateName: string]: {
        presentation: PresentationType;
        content: AnyPatternConfig | AnyPatternConfig[];
        props?: {
            size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
            position?: 'left' | 'right' | 'top' | 'bottom' | 'center';
            title?: string;
            closable?: boolean;
            width?: string;
            showProgress?: boolean;
            step?: number;
            totalSteps?: number;
        };
    };
}

// ============================================================================
// Trait Definition
// ============================================================================

/**
 * A Trait is a reusable behavioral module with state machine.
 *
 * Traits declare their event contracts via `emits` and `listens`:
 * - `emits`: Events this trait can emit (with scope and payload schema)
 * - `listens`: Events this trait listens for (with optional payloadMapping)
 */
/**
 * Instance vs collection scope for a trait.
 *
 * Mirrors the `.lolo` trait modifier list (`[interaction, instance]` /
 * `[interaction, collection]`). Instance traits own a single entity record
 * (typed by `linkedEntity`) and read/write `@entity.field`. Collection
 * traits render records of `linkedEntity` without owning any one; data flows
 * through `@payload.data` typed as `Array<linkedEntity>`.
 *
 * Optional today. A future phase (Almadar_Entity_V2_Plan.md Phase 4) makes
 * it required and adds static checks in the compiler.
 */
export type TraitScope = 'instance' | 'collection';

export const TraitScopeSchema = z.enum(['instance', 'collection']);

/**
 * Inferred field contract for a `@rebindable` trait binding. `requires` =
 * entity fields the trait READS via `@entity.<field>`; `provides` = fields it
 * WRITES via `(set @entity.<field> ...)`. A consumer that rebinds the trait
 * (`linkedEntity`) must point at an entity whose fields ⊇ `requires`. Inferred
 * by the lolo lowerer from the trait's own SExpr usage; the orbital-rust L2
 * validator enforces it (`ORB_T_REBIND_MISSING_FIELDS`). Mirrors the Rust
 * `EntityFieldContract` serde shape exactly.
 */
export interface EntityFieldContract {
    requires: string[];
    provides: string[];
}

export const EntityFieldContractSchema = z.object({
    requires: z.array(z.string()),
    provides: z.array(z.string()),
});

export interface Trait {
    /** V4 dual-carry id sibling of `name` — optional until the Phase-7 flip. */
    id?: TraitId;
    name: string;
    description?: string;
    description_visual_prompt?: string;
    category?: TraitCategory;
    /**
     * Opt-in marker authored as `-> @rebindable Entity` in `.lolo`. When
     * `true`, a consuming molecule/organism may rebind this trait's entity via
     * `linkedEntity`; otherwise the binding is fixed and the validator rejects
     * any rebind (`ORB_T_ENTITY_NOT_REBINDABLE`). Absent on traits that don't
     * bind an entity.
     */
    entityRebindable?: boolean;
    /**
     * Inferred field contract a rebind target must satisfy. Emitted only
     * alongside `entityRebindable: true`. See {@link EntityFieldContract}.
     */
    entityContract?: EntityFieldContract;
    /**
     * `@description "..."` authored on the `@rebindable` binding in `.lolo`.
     * Surfaced to catalog prose + knob-embeddings so the LLM can reach for the
     * binding from intent vocabulary (binding-discovery). Absent when unmarked.
     */
    entityBindingDescription?: string;
    /** `@synonyms "..."` authored on the `@rebindable` binding in `.lolo`. */
    entityBindingSynonyms?: string;
    /**
     * Author-supplied capability tags lifted from the `.lolo` trait header's
     * bracket list. Anything beyond the known scope tokens (`instance` /
     * `collection`) and the first category identifier accumulates here.
     * Free-form strings — the lolo parser does not validate them against a
     * known set. The Phase 4 translator overlay matches rules to traits by
     * exact set membership against this list. Empty when no capabilities
     * were declared. See `docs/Almadar_Domain_Language.md` Phase 3.
     */
    capabilities?: string[];
    /**
     * Instance or collection scope. Required in V2: every trait operates on
     * either a single record (`instance`) or a group (`collection`). Drives
     * payload-inference rules for emits declared via `type X = Event<T>` and
     * shapes the runtime's binding semantics. Authored in `.lolo` as the
     * `[instance]` / `[collection]` modifier on the trait header.
     */
    scope: TraitScope;
    /**
     * The entity this trait is linked to.
     * Required for inline trait definitions within an orbital.
     */
    linkedEntity?: string;
    /** V4 dual-carry id sibling of `linkedEntity` — optional until the Phase-7 flip. */
    linkedEntityId?: EntityId;
    requiredFields?: RequiredField[];
    dataEntities?: TraitDataEntity[];
    stateMachine?: StateMachine;
    initialEffects?: Effect[];
    ticks?: TraitTick[];
    /**
     * Events this trait emits.
     * Each event can be scoped as internal or external.
     * External events are namespaced at orbital level (TraitName.EVENT_NAME).
     */
    emits?: TraitEventContract[];
    /**
     * Events this trait listens for.
     * External listeners reference namespaced events (TraitName.EVENT_NAME).
     */
    listens?: TraitEventListener[];
    ui?: TraitUIBinding;
    /**
     * Declared `config { }` schema authored on the trait. Drives
     * `@config.X` substitution: each field's `default` seeds the
     * binding context behind any caller-supplied call-site
     * `config: { ... }` override.
     */
    config?: DeclaredTraitConfig;
    /**
     * Set by the resolve/inline phase when this trait was cloned from a
     * `uses[]` import. Absent for traits authored directly on the
     * orbital. Viewport-only metadata — runtime and codegen ignore it.
     * Drives Studio's L2 grouping (imported traits collapse under one
     * card per alias) and L3 drill (alias → that behavior's transitions).
     */
    sourceBehavior?: SourceBehaviorMetadata;
    /**
     * Set by the resolve/inline phase alongside `sourceBehavior`. Carries
     * the resolved `Entity` definition of the imported behavior so the
     * client-side mock-data generator can produce rows for the trait's
     * `linkedEntity` without re-walking the import graph at runtime.
     */
    sourceEntityDefinition?: Entity;
}

/**
 * Provenance attached to a trait that was cloned from a `uses[]` import
 * during the inline phase. The resolved schema carries this so Studio
 * can group L2 cards by source behavior and offer an L3 drill into the
 * import's own transitions.
 */
export interface SourceBehaviorMetadata {
    /** Behavior name (e.g. "std-stat-card") — the resolved `from:` value. */
    behavior: string;
    /** Alias used at the import site (e.g. "Stat"). Multiple imports of
     *  the same atom group by alias, not by behavior. */
    alias: string;
    /** Original trait name inside the imported behavior, before any
     *  call-site `name:` rename. */
    originalName: string;
}

export const SourceBehaviorMetadataSchema = z.object({
    behavior: z.string().min(1),
    alias: z.string().min(1),
    originalName: z.string().min(1),
});

export const TraitSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    description_visual_prompt: z.string().optional(),
    category: TraitCategorySchema.optional(),
    entityRebindable: z.boolean().optional(),
    entityContract: EntityFieldContractSchema.optional(),
    entityBindingDescription: z.string().optional(),
    entityBindingSynonyms: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
    scope: TraitScopeSchema,
    linkedEntity: z.string().optional(),
    requiredFields: z.array(RequiredFieldSchema).optional(),
    dataEntities: z.array(TraitDataEntitySchema).optional(),
    stateMachine: StateMachineSchema.optional(),
    initialEffects: z.array(EffectSchema).optional(),
    ticks: z.array(TraitTickSchema).optional(),
    emits: z.array(TraitEventContractSchema).optional(),
    listens: z.array(TraitEventListenerSchema).optional(),
    ui: z.record(z.unknown()).optional(),
    config: DeclaredTraitConfigSchema.optional(),
    sourceBehavior: SourceBehaviorMetadataSchema.optional(),
    sourceEntityDefinition: EntitySchema.optional(),
});

// TraitRefSchema defined here after TraitSchema to avoid forward reference
export const TraitRefSchema = z.union([
    z.string().min(1),
    z.object({
        ref: z.string().min(1),
        config: TraitConfigSchema.optional(),
        linkedEntity: z.string().optional(),
        name: z.string().optional(),
        // Phase F.4: same non-empty refine as TraitReferenceSchema.events.
        // Both schemas accept the same call-site argument shape, so the
        // validators should agree.
        events: z
            .record(
                z.string().min(1, "events key (atom event name) must be non-empty"),
                z.string().min(1, "events value (caller event name) must be non-empty"),
            )
            .optional(),
    }),
    TraitSchema, // Allow inline trait definitions
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a trait ref is an inline Trait definition
 */
/**
 * Checks if a trait reference is an inline trait definition.
 * 
 * Type guard to determine if a TraitRef is an inline trait object
 * (with 'name' property) rather than a string reference or object reference.
 * 
 * @param {TraitRef} traitRef - Trait reference to check
 * @returns {boolean} True if traitRef is an inline trait, false otherwise
 * 
 * @example
 * isInlineTrait({ name: 'MyTrait' }); // returns true (inline)
 * isInlineTrait('MyTrait'); // returns false (string reference)
 * isInlineTrait({ ref: 'MyTrait' }); // returns false (object reference)
 */
export function isInlineTrait(traitRef: TraitRef): traitRef is Trait {
    return typeof traitRef === 'object' && 'name' in traitRef && !('ref' in traitRef);
}

/**
 * Extracts the trait name from a trait reference.
 * 
 * Handles all trait reference formats (string, inline object, object reference)
 * and returns the canonical trait name.
 * 
 * @param {TraitRef} traitRef - Trait reference to extract name from
 * @returns {string} Trait name
 * 
 * @example
 * getTraitName('MyTrait'); // returns 'MyTrait'
 * getTraitName({ name: 'MyTrait' }); // returns 'MyTrait'
 * getTraitName({ ref: 'MyTrait' }); // returns 'MyTrait'
 */
export function getTraitName(traitRef: TraitRef): string {
    if (typeof traitRef === 'string') {
        return traitRef;
    }
    if (isInlineTrait(traitRef)) {
        return traitRef.name;
    }
    return traitRef.ref;
}

/**
 * Extracts the configuration from a trait reference.
 * 
 * Returns the configuration object for trait references that support it
 * (object references with 'config' property). Returns undefined for
 * string references and inline traits.
 * 
 * @param {TraitRef} traitRef - Trait reference to extract config from
 * @returns {TraitConfig | undefined} Trait configuration or undefined
 *
 * @example
 * getTraitConfig('MyTrait'); // returns undefined
 * getTraitConfig({ name: 'MyTrait' }); // returns undefined
 * getTraitConfig({ ref: 'MyTrait', config: { option: 'value' } }); // returns config object
 */
export function getTraitConfig(traitRef: TraitRef): CallSiteConfig | undefined {
    if (typeof traitRef === 'string') {
        return undefined;
    }
    if (isInlineTrait(traitRef)) {
        return undefined; // Inline traits don't have config
    }
    return traitRef.config;
}

/**
 * Normalizes a trait reference to object form.
 * 
 * Converts any trait reference format (string, inline, object) to a
 * standardized object format with 'ref' and optional 'config' properties.
 * 
 * @param {TraitRef} traitRef - Trait reference to normalize
 * @returns {{ ref: string; config?: TraitConfig }} Normalized trait reference
 *
 * @example
 * normalizeTraitRef('MyTrait'); // returns { ref: 'MyTrait' }
 * normalizeTraitRef({ name: 'MyTrait' }); // returns { ref: 'MyTrait' }
 * normalizeTraitRef({ ref: 'MyTrait', config: {...} }); // returns original
 */
export function normalizeTraitRef(traitRef: TraitRef): { ref: string; config?: CallSiteConfig } {
    if (typeof traitRef === 'string') {
        return { ref: traitRef };
    }
    if (isInlineTrait(traitRef)) {
        return { ref: traitRef.name };
    }
    return traitRef;
}

// ============================================================================
// Type exports
// ============================================================================

export type TraitInput = z.input<typeof TraitSchema>;
export type TraitReferenceInput = z.input<typeof TraitReferenceSchema>;

// Backward compatibility aliases
export type OrbitalTraitRef = TraitRef;
export const OrbitalTraitRefSchema = TraitRefSchema;
