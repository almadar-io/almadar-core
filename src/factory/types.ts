import type { EntityPersistence } from '../types/entity.js';
import type { EntityField, RelationConfig } from '../types/field.js';
import type { TraitReference } from '../types/trait.js';
import type { TraitOverlayEntry } from './overlays.js';
import type { JsonValue } from '../types/json.js';
export type { EntityPersistence };
export type { JsonValue };

// ============================================================================
// JSON Schema (minimal subset — covers what the signature → schema generator
// emits + what OpenAI's strict-mode tool calling consumes).
// ============================================================================
//
// `JsonValue` (re-exported above) lives in `src/types/json.ts`. The
// canonical shape is mutable; consumers that want immutability take
// `Readonly<JsonValue>` at their boundary. Used by `JsonSchema.default`
// (arbitrary JSON literal) and any other JSON-shaped field.

/**
 * Recursive JSON Schema. Intentionally narrow — only the keywords V2's
 * signature → schema generator emits. Custom `x-*` extensions carry
 * descriptive metadata (synonyms, label) that doesn't shape validation
 * but stays in the schema for prompt rendering / studio UIs.
 */
export interface JsonSchema {
  type?: JsonSchemaType | ReadonlyArray<JsonSchemaType>;
  description?: string;
  properties?: Readonly<{ [key: string]: JsonSchema }>;
  required?: ReadonlyArray<string>;
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: ReadonlyArray<string | number | boolean>;
  oneOf?: ReadonlyArray<JsonSchema>;
  anyOf?: ReadonlyArray<JsonSchema>;
  default?: JsonValue;
  /**
   * Reference to a shared definition under `$defs` at the schema root.
   * Lets consumers DRY large repeated subschemas (e.g. a 300-entry enum
   * of std-behavior paths reused across every orbital branch of a tool
   * schema). Per JSON Schema 2020-12: absolute reference starting with
   * `#`. Standard OpenAI / DeepSeek strict-mode tool calling resolves
   * `$ref` against `$defs` defined on the tool's parameters root.
   */
  $ref?: string;
  /**
   * Inline subschema definitions referenced from elsewhere via `$ref`.
   * Lives at the schema root so all `$ref` paths can resolve. Values are
   * full `JsonSchema` (can be referenced recursively).
   */
  $defs?: Readonly<{ [key: string]: JsonSchema }>;
  /** Knob's `@synonyms` from the source `.lolo`. */
  'x-synonyms'?: string;
  /** Knob's `@label` from the source `.lolo`. */
  'x-label'?: string;
  /** Knob's `@tier` from the source `.lolo` (`domain`/`presentation`/`internal`). */
  'x-tier'?: string;
}

export type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

/**
 * OrbitalSchema field type tags. The factory-signature extractor lifts
 * these directly from the resolved `.orb`; consumers narrow further at
 * dispatch time.
 */
export type SchemaFieldType =
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

export interface FactorySignatureEntityField {
  name: string;
  type: SchemaFieldType;
  required: boolean;
  /** Runtime-managed widget state (`@intrinsic`). A composer must NOT remap an
   *  intrinsic slot onto a domain field — it rides along via `extends`. */
  intrinsic?: boolean;
  /** Human/semantic description (`@description "..."`). Slot-side signal for the
   *  curation field matcher + catalog search. */
  description?: string;
  /** User-vocabulary synonyms (`@synonyms "..."`). */
  synonyms?: string;
  /** Closed string vocabulary for `type: 'enum'` fields. Matches `EnumEntityField.values`. */
  values?: string[];
  /** Relation target binding for `type: 'relation'` fields. Matches `RelationEntityField.relation`. */
  relation?: RelationConfig;
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
 * One overridable config knob a trait advertises. Lifted directly from
 * the source `.lolo` `config { }` block (which carries typed
 * declarations + defaults). Consumers (the questionnaire generator,
 * the studio) pick a widget from `type` and pre-fill from `default`.
 *
 * `label` is reserved for a future `.lolo` grammar extension that
 * lets atom authors author a human-friendly question prompt; today
 * it's always undefined and the questionnaire derives a fallback
 * from the key name.
 */
export interface FactoryConfigParam {
  /** Key name as advertised by the trait. Matches the override path
   *  `traitOverrides.<traitName>.config.<key>`. */
  key: string;
  /** Type tag lifted from the `.lolo` config declaration. Drives the
   *  question widget selection. Free-form to admit array/object
   *  brackets (`[object]`, `[string]`) and atom-defined custom tags. */
  type: string;
  /** Canonical default value the factory uses when no override is
   *  supplied. Pre-fills the form widget so users see what they're
   *  about to change. */
  default?: FactoryParamValue;
  /** Optional human-friendly question prompt. Lifted from the source
   *  `.lolo` `@label "..."` annotation. */
  label?: string;
  /** Optional help-text. Lifted from `.lolo` `@description "..."`. */
  description?: string;
  /** Optional closed-enum value set. Lifted from `.lolo` enum syntax. */
  enumValues?: ReadonlyArray<string>;
  /** Array element schema when the slot's type is `[T]`. Mirrors the
   *  `.orb` `ConfigField.items` carrier (`FieldDefinition`-shaped). Lets
   *  consumers see the per-element typing — e.g. `metrics : [MetricSpec]`
   *  exposes `items.properties` with every MetricSpec field + its own
   *  `values: [...]` enum constraints. */
  items?: EntityField;
  /** Object property schemas keyed by property name when the slot's type
   *  is an inline `{ ... }` or a named struct alias. Mirrors the `.orb`
   *  `ConfigField.properties` carrier. */
  properties?: Readonly<Record<string, EntityField>>;
  /** Comma-separated user-vocabulary synonyms. Authored in `.lolo` as
   *  `@synonyms "..."` next to the knob declaration. Used by the agent's
   *  catalog-summary prompt (so the LLM connects user phrases to knob
   *  names) and by the publish-time knob-embeddings bake (so cosine
   *  narrowing recalls knobs voiced via synonym).
   *
   *  Example for the `height` knob on `std-graphs`:
   *    `@synonyms "taller, shorter, vertical size, pixel height"`
   *
   *  Stays a single free-form string; consumers decide their own
   *  splitting/formatting policy. */
  synonyms?: string;
  /** Decision-kind tier authored in `.lolo` as `@tier "..."` next to the
   *  knob declaration. Drives the studio Questionnaire's filter +
   *  disclosure: `internal` knobs are hidden entirely, `presentation`
   *  knobs collapse under the "Polish wording" panel, `domain` knobs
   *  render inline. Untagged knobs are treated as `presentation` by the
   *  studio (safe default — most un-audited knobs are presentation polish). */
  tier?: FactoryConfigTier;
}

/**
 * Decision-kind tier for a `FactoryConfigParam`. Source-tagged via the
 * `@tier "..."` annotation in `.lolo` — no heuristic inference on the
 * consumer side. Missing tag = author did not tag = treat as
 * `presentation` at render time.
 *
 *  - `domain` — configures THIS entity's business meaning (currency,
 *    SLA hours, which fields matter). The user MUST own these.
 *  - `policy` — turns on a cross-cutting GOVERNANCE behavior that changes
 *    what gets generated (audit trail, row access, approval gate, GDPR
 *    erasure, notification cadence). Shown by default alongside domain.
 *  - `infra` — wires a cross-cutting OPERATIONAL/structural primitive
 *    (lifecycle scans, deadline reminders, cascade-delete, N:M joins).
 *    Shown by default; mostly wiring rather than business choices.
 *  - `presentation` — changes how the same business meaning is RENDERED
 *    (labels, placeholders, titles, copy, column lists, action lists,
 *    layout fidelity like cols/gap/chartType). LLM picks defaults;
 *    user can edit post-generation.
 *  - `internal` — framework primitives (trait/slot/pattern types,
 *    *Event keys, layoutMode); the studio never surfaces these.
 */
export type FactoryConfigTier =
  | 'domain'
  | 'policy'
  | 'infra'
  | 'presentation'
  | 'internal';

/**
 * One trait the factory composes into the orbital. The projector reads
 * these to determine which factory's trait stack covers a given
 * orbital + which override knobs a presentation overlay can target.
 */
export interface FactoryTraitSignature {
  /** Canonical trait name post-rename (e.g. `"ChatMessageList"`). */
  name: string;
  /** Upstream trait reference path when this trait is a call-site override
   *  of an imported atom — e.g. `"Stats.traits.StatsItemStats"`. Absent
   *  when the trait is inline-defined (atom-tier traits). The catalog
   *  inheritance pass uses this to resolve the upstream atom signature
   *  so each call-site `overridableConfigKeys` entry gets `type` /
   *  `items` / `properties` filled in from the canonical declaration. */
  ref?: string;
  /** Event keys this trait emits (post-rename). */
  emittedEvents: ReadonlyArray<string>;
  /** Event keys this trait listens for. */
  listenedEvents: ReadonlyArray<string>;
  /** Structured emit + listen events with their `@description`/`@synonyms`/`@tier`
   *  annotations. Parallel to `emittedEvents`/`listenedEvents` (kept as bare-key
   *  back-compat); the curation event matcher reads this. */
  events?: ReadonlyArray<FactoryEventSignature>;
  /** Config knobs overridable via `traitOverrides.<name>.config.<key>`.
   *  Each entry carries the key name plus the typed declaration lifted
   *  from the source `.lolo` `config { }` block. */
  overridableConfigKeys: ReadonlyArray<FactoryConfigParam>;
  /** Capability tags lifted directly from the source `.lolo` trait's
   *  header annotations. Free-form strings — the translator overlay
   *  matches rules to traits by exact set membership. */
  capabilities: ReadonlyArray<string>;
  /** `true` when the source trait's entity binding was authored
   *  `-> @rebindable Entity`. Only then may a consumer rebind it via
   *  `traitOverrides.<name>.linkedEntity`; rabit enum-constrains that
   *  override to the organism's entities and the validator enforces the
   *  field contract. Absent/false = fixed binding. */
  entityRebindable?: boolean;
  /** Inferred field contract a rebind target must satisfy. `requires` =
   *  fields the trait reads via `@entity.X`; `provides` = fields it writes.
   *  Present only alongside `entityRebindable`. */
  entityContract?: { requires: ReadonlyArray<string>; provides: ReadonlyArray<string> };
  /** `@description` / `@synonyms` authored on the `@rebindable` binding —
   *  fed to catalog prose + knob-embeddings for binding-discovery. */
  entityBindingDescription?: string;
  entityBindingSynonyms?: string;
}

/** One event a trait emits or listens for, with its authored annotations — the
 *  per-event analogue of `FactorySignatureEntityField` / `FactoryConfigParam`.
 *  Feeds the curation event matcher (embedding-wire a composed style atom's
 *  actions to a domain lifecycle's events). */
export interface FactoryEventSignature {
  /** Event key (post-rename). */
  name: string;
  /** Whether the trait emits the event or listens for it. */
  direction: 'emit' | 'listen';
  /** Authored `@description` on the emit/listen. */
  description?: string;
  /** Authored `@synonyms` (comma-separated user vocabulary). */
  synonyms?: string;
  /** Authoring `@tier` (`essential`/`customization`/`advanced`/`internal`). */
  tier?: string;
}

/** One page the factory emits. The path is the factory default; the
 *  projector may override via `params.pagePaths`. */
export interface FactoryPageSignature {
  name: string;
  defaultPath: string;
  primaryEntity: string;
}

/**
 * Which coordinator surface may see this entry: `'app'` = pickable factory
 * organism catalog, `'palette'` = free-lolo compose palette, `'both'`,
 * `'internal'` = neither.
 */
export type FactoryExposure = 'app' | 'palette' | 'both' | 'internal';

/**
 * `'generated'` = machine-emitted 1:1 wrapper (lolo-ui), `'authored'` =
 * hand-authored (`.hand-authored.json` membership), `'promoted'` = landed
 * through the cache-fill promotion pipeline.
 */
export type FactoryProvenance = 'generated' | 'authored' | 'promoted';

export interface FactorySignature {
  /** Organism the factory belongs to (e.g. `"std-realtime-chat"`). */
  organism: string;
  /** Orbital this factory builds within that organism. */
  orbital: string;
  /** Tier the factory sits in (informational). */
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
  /**
   * JSON Schema for the orbital's `AnalysisOrbitalParams` shape. Walks
   * `traitOverrides.<TraitName>.config.<knob>` with the exact type
   * (string/number/boolean/array/object) lifted from each knob's
   * declaration, `enum` from `enumValues`, recursive `items` for array
   * slots, recursive `properties` for struct slots. Every level carries
   * `additionalProperties: false` so the LLM cannot emit unknown trait
   * names, invented knob keys, or out-of-set enum values.
   *
   * Pre-computed at signature extraction time by
   * `tools/almadar-pattern-sync/src/std-ts/signatures/`. V2 tool-calling
   * (`@almadar-io/agent`'s coordinator + per-orbital subagent) feeds this
   * directly to OpenAI's `tool.parameters` with `strict: true` — the
   * LLM is physically constrained by the schema instead of relying on
   * post-hoc validation.
   *
   * Optional for backward compatibility: signatures emitted by older
   * pattern-sync versions don't carry it, in which case V2 tools fall
   * back to a loose schema + post-hoc validation.
   */
  paramsSchema?: JsonSchema;
  /**
   * Which coordinator surface may see this entry: `'app'` = pickable
   * factory organism catalog, `'palette'` = free-lolo compose palette,
   * `'both'`, `'internal'` = neither. Stamped at generation time by
   * `tools/almadar-pattern-sync` (std-ts) from the `.lolo` `@exposure`
   * header tag with per-topic defaults; consumers treat a missing field
   * as "pre-V3 signature" and fall back to their legacy filters. An
   * entry may carry `'app'`/`'both'` only if its factory is registered
   * in the package's dispatch registry — enforced at generation time.
   */
  exposure?: FactoryExposure;
  /**
   * `'generated'` = machine-emitted 1:1 wrapper (lolo-ui), `'authored'` =
   * hand-authored (`.hand-authored.json` membership), `'promoted'` =
   * landed through the cache-fill promotion pipeline.
   */
  provenance?: FactoryProvenance;
  /**
   * The blessed pattern-signature hash (sha256 of family/tier +
   * propsSchema) recorded at bless time for `authored`/`promoted`
   * entries; drift against the current substrate flags the entry for
   * review.
   */
  substrateSignature?: string;
}

/**
 * Aggregate catalog written to
 * `packages/almadar-std/behaviors/registry/factory-signatures.json`.
 * Sorted by organism then orbital.
 */
export interface FactorySignatureCatalog {
  /** Generated-by version stamp (the `@almadar/std` minor it shipped in). */
  generatedFromStdVersion: string;
  /** Sorted list of factory signatures. */
  signatures: ReadonlyArray<FactorySignature>;
}

/**
 * A single factory invocation, as the typed result of the translator.
 * Lower into runtime by calling the factory at `factoryPath` with
 * these `params`. Stable identity for downstream diffing is
 * `(organism, orbital)`.
 */
export interface FactoryCallSite {
  organism: string;
  orbital: string;
  factoryPath: string;
  params: FactoryCallSiteParams;
}

/**
 * The typed param surface every factory's call site populates. Each
 * field corresponds to one row in the translator's overlay → factory
 * mapping table.
 */
export interface FactoryCallSiteParams {
  /** Override `signature.entities[0].name` (entity rename). */
  entityName?: string;
  /** Additional or overriding entity fields. Caller wins on collision. */
  entityFields?: ReadonlyArray<EntityField>;
  /** Override `signature.entities[0].persistence`. */
  persistence?: EntityPersistence;
  /** Override the entity's storage collection key. */
  collection?: string;
  /** Per-page path overrides keyed by `signature.pages[i].name`. */
  pagePaths?: Readonly<Record<string, string>>;
  /** Trait-level overrides keyed by `signature.traits[i].name`. Each value
   *  is a {@link TraitOverlayEntry} — the canonical override surface that
   *  admits the full documented set (`config`, `linkedEntity`, `events`,
   *  `name`, `emitsScope`, `listens`) and mirrors what `TraitOverlay` (the
   *  LLM-facing input) and {@link MakeTraitRefOpts} (the builder input)
   *  both accept. The translator threads each field from the overlay
   *  through to here verbatim; the factory applies them via the same
   *  `TraitReference` override semantics the inliner uses on hand-authored
   *  `.orb` traits. Pre-unification this carried only `{ config? }`, which
   *  silently dropped every other override field even though both the
   *  overlay layer above and the factory builders below accepted them. */
  traitOverrides?: Readonly<Record<string, TraitOverlayEntry>>;
  /** Extra traits to compose into the orbital that aren't part of the
   *  canonical signature trait stack. */
  extraTraits?: ReadonlyArray<TraitReference>;
}

/**
 * Allowed leaf values for the typed factory-param surface.
 */
export type FactoryParamValue =
  | string
  | number
  | boolean
  | ReadonlyArray<FactoryParamValue>
  | { readonly [key: string]: FactoryParamValue };
