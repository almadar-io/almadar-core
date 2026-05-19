/**
 * Domain Language Types
 *
 * AST node types for the domain language that maps to KFlow schema.
 * All entity references use explicit names (e.g., Order, Task, CurrentUser)
 * per GAP-002 - no magic variables like `entity.` or `context.`.
 *
 * @packageDocumentation
 */

import type { EntityPersistence } from '../types/entity.js';
import type { EntityField } from '../types/field.js';
import type { TraitScope } from '../types/trait.js';
import type { TraitEventListener, TraitReference } from '../types/trait.js';
export type { EntityPersistence, TraitScope };

// ============================================================================
// Type Registry (OrbitalSchema ↔ Domain Language Mapping)
// ============================================================================

/**
 * Field type mapping: OrbitalSchema type → Domain Language keyword
 *
 * This is the single source of truth for type conversion.
 * When adding new field types to OrbitalSchema, add the mapping here.
 */
export const FIELD_TYPE_MAPPING = {
    // OrbitalSchema → Domain Language
    'string': 'text',
    'number': 'number',
    'boolean': 'yes/no',
    'date': 'date',
    'timestamp': 'timestamp',
    'datetime': 'datetime',
    'array': 'list',
    'object': 'object',
    'enum': 'enum',
    'relation': 'relation',
} as const;

/**
 * Reverse mapping: Domain Language keyword → OrbitalSchema type
 */
export const DOMAIN_TO_SCHEMA_FIELD_TYPE = {
    'text': 'string',
    'long text': 'string',
    'number': 'number',
    'currency': 'number',
    'yes/no': 'boolean',
    'date': 'date',
    'timestamp': 'timestamp',
    'datetime': 'datetime',
    'list': 'array',
    'object': 'object',
    'enum': 'enum',
    'relation': 'relation',
} as const;

/**
 * Effect operator mapping: Both systems use the same operator names
 */
export const EFFECT_OPERATORS = [
    'set',
    'emit',
    'navigate',
    'render-ui',
    'persist',
    'call-service',
    'spawn',
    'despawn',
    'do',
    'notify',
] as const;

/**
 * Guard/comparison operators: S-Expression syntax only
 */
export const COMPARISON_OPERATORS = ['=', '!=', '<', '>', '<=', '>='] as const;
export const LOGICAL_OPERATORS = ['and', 'or', 'not'] as const;
export const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%'] as const;

/**
 * UI Slots: Same in both OrbitalSchema and Domain Language
 */
export const UI_SLOTS = [
    'main',
    'sidebar',
    'modal',
    'drawer',
    'overlay',
    'center',
    'toast',
    'hud-top',
    'hud-bottom',
    'floating',
    'system',
] as const;

/**
 * Binding prefixes for S-Expressions
 */
export const BINDING_PREFIXES = {
    entity: '@entity',
    payload: '@payload',
    state: '@state',
    now: '@now',
} as const;

// ============================================================================
// Effect Type
// ============================================================================

/**
 * Effect operator names (S-expression first element)
 * These are the operators used in S-expression effects like ['emit', ...]
 */
export type EffectType = (typeof EFFECT_OPERATORS)[number];

// ============================================================================
// Base Types
// ============================================================================

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface ASTNode {
  type: string;
  range?: SourceRange;
}

// ============================================================================
// Field Types
// ============================================================================

/**
 * Domain Language field types
 *
 * Note: These map to OrbitalSchema types via DOMAIN_TO_SCHEMA_FIELD_TYPE
 */
export type DomainFieldType =
  | 'text'
  | 'long text'
  | 'number'
  | 'currency'
  | 'date'
  | 'timestamp'
  | 'datetime'
  | 'yes/no'
  | 'enum'
  | 'list'
  | 'object'
  | 'relation';

/**
 * OrbitalSchema field types (for reference)
 */
export type SchemaFieldType = keyof typeof FIELD_TYPE_MAPPING;

/**
 * Default value for a `DomainField`. Mirrors the JSON-leaf shape an
 * `EntityField.default` may carry on `OrbitalSchema`: scalar, list, or
 * nested object (when the field type is `'object'` or `'list'`).
 */
export type DomainFieldDefault =
  | string
  | number
  | boolean
  | null
  | DomainFieldDefault[]
  | { [k: string]: DomainFieldDefault };

/**
 * For `fieldType: 'list'`, the typed shape of each item. Mirrors
 * `EntityField.items` on `OrbitalSchema`. Currently a single-level
 * type tag (matching how the schema uses it); extend if/when nested
 * list-of-list / list-of-object signatures are required.
 */
export interface DomainFieldItems {
  type: DomainFieldType;
}

export interface DomainField extends ASTNode {
  type: 'field';
  name: string;
  fieldType: DomainFieldType;
  required: boolean;
  unique: boolean;
  auto: boolean;
  default?: DomainFieldDefault;
  enumValues?: string[];  // For enum types
  /** List-of-X item type when `fieldType === 'list'`. */
  items?: DomainFieldItems;
}

// ============================================================================
// Relationship Types
// ============================================================================

export type RelationshipType = 'belongs_to' | 'has_many' | 'has_one';

export interface DomainRelationship extends ASTNode {
  type: 'relationship';
  relationshipType: RelationshipType;
  targetEntity: string;
  alias?: string;  // e.g., "as Assignee"
}

// ============================================================================
// Entity AST
// ============================================================================

export interface DomainEntity extends ASTNode {
  type: 'entity';
  name: string;
  description: string;
  fields: DomainField[];
  relationships: DomainRelationship[];
  states?: string[];
  initialState?: string;
  /**
   * Storage mode on the resolved schema. Mirrors `EntityPersistence` in
   * `@almadar/core/types/entity.ts`. Omitted ⇒ projector defaults to
   * `'persistent'`. Domain text syntax: `Persistence: <value>` line in
   * the entity section.
   */
  persistence?: EntityPersistence;
}

// ============================================================================
// Page AST
// ============================================================================

export interface DomainPageSection extends ASTNode {
  type: 'page_section';
  description: string;
}

export interface DomainPageAction extends ASTNode {
  type: 'page_action';
  trigger: string;      // e.g., "Click a task"
  action: string;       // e.g., "Navigate to Task Details"
}

export interface DomainPage extends ASTNode {
  type: 'page';
  name: string;
  description: string;
  purpose: string;
  url: string;
  primaryEntity?: string;  // Explicit entity reference (no inference!)
  traitName?: string;      // Trait/behavior to use for this page
  sections: DomainPageSection[];
  actions: DomainPageAction[];
  onAccess?: string;
}

// ============================================================================
// Guard Expression AST
// ============================================================================

export type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';
export type LogicalOperator = 'AND' | 'OR';

export interface FieldReference extends ASTNode {
  type: 'field_reference';
  entityName: string;   // Explicit entity name (Order, Task, CurrentUser)
  fieldName: string;
}

export interface FieldCheckCondition extends ASTNode {
  type: 'field_check';
  field: FieldReference;
  check: 'provided' | 'empty' | 'equals';
  value?: string | number | boolean;
}

export interface ComparisonCondition extends ASTNode {
  type: 'comparison';
  field: FieldReference;
  operator: ComparisonOperator;
  value: string | number | boolean;
}

export interface UserCheckCondition extends ASTNode {
  type: 'user_check';
  check: 'is_role' | 'owns_this';
  role?: string;
  ownerField?: string;  // Field that contains owner ID
}

export interface LogicalCondition extends ASTNode {
  type: 'logical';
  operator: LogicalOperator;
  left: GuardCondition;
  right: GuardCondition;
}

export type GuardCondition =
  | FieldCheckCondition
  | ComparisonCondition
  | UserCheckCondition
  | LogicalCondition;

export interface DomainGuard extends ASTNode {
  type: 'guard';
  condition: GuardCondition;
  raw: string;  // Original text for display
}

// ============================================================================
// Effect AST
// ============================================================================

// EffectType is imported from schema/index.js above

export interface DomainEffect extends ASTNode {
  type: 'effect';
  effectType: EffectType;
  description: string;  // Human-readable description
  // eslint-disable-next-line almadar/no-record-string-unknown -- Effect config varies per effect type (notify, set, navigate, etc.)
  config: Record<string, unknown>;
}

// ============================================================================
// Behavior AST (Traits)
// ============================================================================

export interface DomainTransition extends ASTNode {
  type: 'transition';
  fromState: string;
  toState: string;
  event: string;
  guards: DomainGuard[];
  effects: DomainEffect[];
}

export interface DomainTick extends ASTNode {
  type: 'tick';
  name: string;
  interval: string;     // e.g., "Every hour", "Every day at 9am"
  intervalMs?: number;  // Parsed milliseconds
  guard?: DomainGuard;
  effects: DomainEffect[];
}

export interface DomainBehavior extends ASTNode {
  type: 'behavior';
  name: string;           // e.g., "Order Lifecycle"
  entityName: string;     // The entity this behavior applies to
  states: string[];
  initialState: string;
  transitions: DomainTransition[];
  ticks: DomainTick[];
  rules: string[];        // Business rules in natural language
  /**
   * Instance- vs collection-scoped state machine. Mirrors
   * `Trait.scope: TraitScope` in `@almadar/core/types/trait.ts`.
   * Omitted ⇒ projector defaults to `'instance'`. Domain text syntax:
   * `Scope: instance|collection` line in the behavior section.
   */
  scope?: TraitScope;
}

// ============================================================================
// Full Document AST
// ============================================================================

export interface DomainDocument extends ASTNode {
  type: 'document';
  entities: DomainEntity[];
  pages: DomainPage[];
  behaviors: DomainBehavior[];
}

// ============================================================================
// Section Mapping (for bidirectional sync)
// ============================================================================

export interface SectionMapping {
  sectionId: string;
  sectionType: 'entity' | 'page' | 'behavior' | 'tick';
  schemaPath: string;       // JSON path in KFlow schema
  domainText: string;       // The domain text for this section
  aiDescription?: string;   // AI-generated prose description
  range?: SourceRange;      // Location in source text
  lastModified?: number;    // Timestamp
}

// ============================================================================
// Parse Result
// ============================================================================

export interface ParseError {
  message: string;
  range?: SourceRange;
  suggestion?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: ParseError[];
  warnings: ParseError[];
}

// ============================================================================
// Factory Signatures
//
// Phase 1 of `docs/Almadar_Domain_Language.md`. Each factory in
// `packages/almadar-std/behaviors/functions/` advertises a typed
// `FactorySignature` — the machine-readable record of "what this factory
// covers" that the Phase 2 projector uses to match a `DomainDocument`
// to factory call sites. Signatures are AUTO-GENERATED by
// `tools/almadar-pattern-sync` from the canonical `.orb`; hand-editing
// is forbidden (next regen overwrites them).
//
// **No inferred fields.** Every field carried here is read directly
// from the canonical `.orb`. The projector finds consumers structurally
// (overlap on `entity.fields`, `emittedEvents`, `listenedEvents`,
// `overridableConfigKeys`) — no name-matching, no kind-inference, no
// "always true" placeholders. If a concept can't be enumerated from
// the .orb today, it doesn't go in the signature; it gets source-tagged
// upstream (in `.lolo` → `Trait` on `@almadar/core`) first.
// ============================================================================

/**
 * One field on a factory's canonical entity, in signature form. Mirrors
 * the subset of `EntityField` that the projector needs to score a
 * domain-entity match. Auto-added audit fields (id / createdAt /
 * updatedAt) are omitted by the extractor.
 */
export interface FactorySignatureEntityField {
  name: string;
  type: SchemaFieldType;
  required: boolean;
}

/**
 * The canonical entity a factory produces. Almost always one entity
 * per orbital; modeled as an array to keep the door open for orbitals
 * that compose multiple entities.
 */
export interface FactoryEntitySignature {
  /** Canonical entity name the factory's params build (e.g. `"ChatMessage"`). */
  name: string;
  /** Fields the factory emits, post-auto-field stripping. */
  fields: ReadonlyArray<FactorySignatureEntityField>;
  /** Persistence mode declared on the canonical entity in the `.orb`. */
  persistence: EntityPersistence;
}

/**
 * One trait the factory composes into the orbital. The projector reads
 * these to determine which factory's trait stack covers a given
 * `DomainBehavior` + which override knobs a presentation overlay can
 * deterministically target. Trait identity is by `name` only; the
 * projector matches structurally on the event / config arrays — no
 * inferred "kind" tag.
 */
export interface FactoryTraitSignature {
  /** Canonical trait name post-rename (e.g. `"ChatMessageList"`). */
  name: string;
  /** Event keys this trait emits (post-rename). Read directly from
   *  the trait's `emits[].event`. */
  emittedEvents: ReadonlyArray<string>;
  /** Event keys this trait listens for. Read directly from `listens[].event`. */
  listenedEvents: ReadonlyArray<string>;
  /** Config keys overridable via `traitOverrides.<name>.config.<key>`.
   *  Read directly from the trait's `config` declaration block. */
  overridableConfigKeys: ReadonlyArray<string>;
  /** Capability tags lifted directly from the source `.lolo` trait's
   *  header annotations. Free-form strings — the Phase 4 translator
   *  overlay matches rules to traits by exact set membership. Empty
   *  when the trait declared none. See `docs/Almadar_Domain_Language.md`
   *  Phase 3. */
  capabilities: ReadonlyArray<string>;
}

/** One page the factory emits. The path is the factory default; the
 *  projector may override via `params.pagePath` or `params.pages[].path`. */
export interface FactoryPageSignature {
  name: string;
  defaultPath: string;
  primaryEntity: string;
}

export interface FactorySignature {
  /** Organism the factory belongs to (e.g. `"std-realtime-chat"`). */
  organism: string;
  /** Orbital this factory builds within that organism. */
  orbital: string;
  /** Tier the factory sits in (informational; drives nothing today). */
  tier: 'atoms' | 'molecules' | 'organisms';
  /** Path of the generated factory source (relative to the std root). */
  factoryPath: string;
  /** Canonical entity surface(s) the factory produces. */
  entities: ReadonlyArray<FactoryEntitySignature>;
  /** Trait stack the factory composes. */
  traits: ReadonlyArray<FactoryTraitSignature>;
  /** Pages the factory emits. */
  pages: ReadonlyArray<FactoryPageSignature>;
  /** Union of all `traits[].emittedEvents`. */
  emittedEvents: ReadonlyArray<string>;
  /** Union of all `traits[].listenedEvents`. */
  listenedEvents: ReadonlyArray<string>;
}

/**
 * Aggregate catalog written to
 * `packages/almadar-std/behaviors/registry/factory-signatures.json`.
 * Sorted by organism then orbital. One entry per factory in the
 * regenerate pipeline.
 */
export interface FactorySignatureCatalog {
  /** Generated-by version stamp (the `@almadar/std` minor it shipped in). */
  generatedFromStdVersion: string;
  /** Sorted list of factory signatures. */
  signatures: ReadonlyArray<FactorySignature>;
}

// ============================================================================
// Phase 2 — Deterministic translator + mutation reducer
// ============================================================================
// `translateDomainToParams(doc, signature)` takes ONE chosen signature
// (the agent picked it upstream via embedding-search over the catalog)
// and lowers the relevant `DomainDocument` slice into that factory's
// param surface — field-by-field, no scoring. The result is one
// `FactoryCallSite` per orbital the doc maps onto.
//
// `applyMutation(doc, mut)` is the reducer over a typed discriminated
// union of edits — what a UI questionnaire or agent emits when it
// wants to change the doc.
//
// `PresentationOverlay` separates concerns: nav items and theme refs
// are presentation-layer and pass through to factory params via the
// translator's overlay step, NOT through `DomainDocument`.
// ============================================================================

/**
 * A single factory invocation, as the typed result of the translator.
 * Lower into runtime by calling the factory at `factoryPath` with
 * these `params`. Stable identity for downstream diffing is
 * `(organism, orbital)`.
 */
export interface FactoryCallSite {
  /** Matches `FactorySignature.organism`. */
  organism: string;
  /** Matches `FactorySignature.orbital`. */
  orbital: string;
  /** Matches `FactorySignature.factoryPath`. Convenience pointer; the
   *  authoritative source remains the signature catalog. */
  factoryPath: string;
  /** Typed param surface fed to the factory at invocation time. */
  params: FactoryCallSiteParams;
}

/**
 * The typed param surface every factory's call site populates. Each
 * field on this interface corresponds to one row in the translator's
 * domain↔factory mapping table. Adding a new domain concept means
 * adding a field here AND wiring it in `translateDomainToParams`.
 *
 * Fields are all optional because not every factory consumes every
 * concept; the translator only sets what the chosen signature
 * advertises.
 */
export interface FactoryCallSiteParams {
  /** Override `signature.entities[0].name` (entity rename). */
  entityName?: string;
  /** Additional or overriding entity fields. Caller wins on collision. */
  entityFields?: ReadonlyArray<EntityField>;
  /** Override `signature.entities[0].persistence`. */
  persistence?: EntityPersistence;
  /** Per-page path overrides keyed by `signature.pages[i].name`. */
  pagePaths?: Readonly<Record<string, string>>;
  /** Trait config overrides keyed by `signature.traits[i].name`. Each
   *  value is a record keyed by the trait's `overridableConfigKeys`. */
  traitOverrides?: Readonly<
    Record<string, { config?: Readonly<Record<string, FactoryParamValue>> }>
  >;
  /** Extra traits to compose into the orbital that aren't part of the
   *  canonical signature trait stack. Used when a domain behavior
   *  isn't covered by any canonical trait. */
  extraTraits?: ReadonlyArray<TraitReference>;
}

/**
 * Allowed leaf values for the typed factory-param surface. Same as
 * `DomainFieldDefault` minus null, plus arrays + records to mirror
 * the trait-config shape factories accept today.
 */
export type FactoryParamValue =
  | string
  | number
  | boolean
  | ReadonlyArray<FactoryParamValue>
  | { readonly [key: string]: FactoryParamValue };

/**
 * Discriminated union of edits to a `DomainDocument`. Each variant
 * carries typed AST nodes already defined in this file — never raw
 * JSON. `applyMutation` is total over this union.
 */
export type DomainMutation =
  | { kind: 'add-entity'; entity: DomainEntity }
  | { kind: 'remove-entity'; entityName: string }
  | { kind: 'rename-entity'; from: string; to: string }
  | { kind: 'update-entity'; entityName: string; entity: DomainEntity }
  | { kind: 'add-field'; entityName: string; field: DomainField }
  | { kind: 'remove-field'; entityName: string; fieldName: string }
  | { kind: 'update-field'; entityName: string; field: DomainField }
  | { kind: 'add-page'; page: DomainPage }
  | { kind: 'remove-page'; pageName: string }
  | { kind: 'update-page'; pageName: string; page: DomainPage }
  | { kind: 'add-behavior'; behavior: DomainBehavior }
  | { kind: 'remove-behavior'; behaviorName: string }
  | { kind: 'update-behavior'; behaviorName: string; behavior: DomainBehavior }
  | { kind: 'add-transition'; behaviorName: string; transition: DomainTransition }
  | {
      kind: 'remove-transition';
      behaviorName: string;
      from: string;
      to: string;
      event: string;
    }
  | {
      kind: 'add-relationship';
      entityName: string;
      relationship: DomainRelationship;
    }
  | {
      kind: 'remove-relationship';
      entityName: string;
      targetEntity: string;
      relationshipType: RelationshipType;
    };

/**
 * Cross-cutting presentation knobs that don't live in `DomainDocument`
 * because they're factory-layer concerns (nav items live on a layout
 * trait; theme is a separate `ThemeRef`). The translator reads these
 * and threads them into the matching factory params.
 */
export interface PresentationOverlay {
  /** Nav items to add to the orbital's layout trait. The translator
   *  looks for a `signature.traits[i]` with `overridableConfigKeys`
   *  including `navItems` and writes into `traitOverrides[name].config.navItems`. */
  navAdditions?: ReadonlyArray<PresentationNavItem>;
  /** Optional theme ref override for the orbital. */
  themeRef?: string;
}

export interface PresentationNavItem {
  label: string;
  path: string;
  /** Optional icon key (consumer-resolved). */
  icon?: string;
}

// ============================================================================
// Phase 4 — Agent-authored overlays for the translator
// ============================================================================
// The agent's Stage A LLM emits two typed overlays alongside the
// `DomainDocument` slice. The translator's `applyTraitOverlay` +
// `applyRuleOverlay` rows lower them onto the chosen factory's param
// surface.
//
// Both overlays are typed-but-free-form on the key dimension that
// matters (trait names, capability strings): the catalog is the
// source of truth, atoms grow the vocabulary, the translator looks
// up by exact set membership. No central enum.
// ============================================================================

/**
 * LLM-authored trait-level overrides keyed by trait name (matches
 * `signature.traits[].name`). Each entry's `config` keys are
 * validated against `signature.traits[i].overridableConfigKeys`;
 * unknown trait names or unknown config keys emit typed warnings
 * and are skipped. Mirrors the existing call-site override surface
 * on `TraitReference` in `OrbitalSchema`.
 */
export type TraitOverlay = Readonly<Record<string, TraitOverlayEntry>>;

export interface TraitOverlayEntry {
  config?: Readonly<Record<string, FactoryParamValue>>;
  linkedEntity?: string;
  events?: Readonly<Record<string, string>>;
  name?: string;
  emitsScope?: 'internal' | 'external';
  /** Reuses `TraitEventListener` from `@almadar/core/types/trait` so the
   *  overlay's listen entries carry the same `event` / `triggers` /
   *  `source` / `guard` shape as everywhere else — no narrower clone. */
  listens?: ReadonlyArray<TraitEventListener>;
}

/** @deprecated Phase 4.1 placeholder — use `TraitEventListener` instead.
 *  Kept as a structural type alias so callers that imported it keep
 *  compiling through the transition; will be removed in 7.25.0. */
export type TraitOverlayListener = TraitEventListener;

/**
 * Rules carry a free-form `capability: string` that the translator
 * matches against `signature.traits[].capabilities` (source-tagged
 * in `.lolo`, propagated via `@almadar/core@7.22.0`).
 *
 * NO closed enum on `capability` — atoms advertise capability
 * strings in their `.lolo` headers, and the catalog grows the
 * vocabulary organically. The agent emits whatever capability
 * string the user's domain expresses; if no trait in the catalog
 * advertises that capability, the translator emits a typed warning.
 */
export interface RuleOverlay {
  rules: ReadonlyArray<DomainRuleOverlayEntry>;
  /**
   * Entity-level ownership signal. Until Phase 1.5 promotes
   * `ownedBy` into `DomainEntity`, ownership rides here as a
   * parallel typed channel. The translator threads it into the
   * matched trait's `config.ownerField` (when the matched trait
   * advertises that key in `overridableConfigKeys`).
   */
  ownership?: ReadonlyArray<OwnershipOverlayEntry>;
}

export interface DomainRuleOverlayEntry {
  id: string;
  /** Free-form capability label, matched against
   *  `signature.traits[].capabilities` by exact set membership. */
  capability: string;
  description: string;
  /** Entity names this rule binds to. Empty array = cross-cutting:
   *  the rule applies to every orbital the translator visits. */
  appliesTo: ReadonlyArray<string>;
  /** Optional role name (e.g. `"admin"`) when the rule is role-scoped. */
  role?: string;
  /** Optional extra config knobs threaded into the matched trait's
   *  `config`. Validated against the trait's `overridableConfigKeys`. */
  config?: Readonly<Record<string, FactoryParamValue>>;
}

export interface OwnershipOverlayEntry {
  /** Entity name (matches `DomainEntity.name`). */
  entity: string;
  /** Field name on the entity that carries the owner identifier. */
  ownerField: string;
}

