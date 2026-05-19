import type { EntityPersistence } from '../types/entity.js';
import type { EntityField } from '../types/field.js';
import type { TraitReference } from '../types/trait.js';
export type { EntityPersistence };

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
 * orbital + which override knobs a presentation overlay can target.
 */
export interface FactoryTraitSignature {
  /** Canonical trait name post-rename (e.g. `"ChatMessageList"`). */
  name: string;
  /** Event keys this trait emits (post-rename). */
  emittedEvents: ReadonlyArray<string>;
  /** Event keys this trait listens for. */
  listenedEvents: ReadonlyArray<string>;
  /** Config keys overridable via `traitOverrides.<name>.config.<key>`. */
  overridableConfigKeys: ReadonlyArray<string>;
  /** Capability tags lifted directly from the source `.lolo` trait's
   *  header annotations. Free-form strings — the translator overlay
   *  matches rules to traits by exact set membership. */
  capabilities: ReadonlyArray<string>;
}

/** One page the factory emits. The path is the factory default; the
 *  projector may override via `params.pagePaths`. */
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
  /** Trait config overrides keyed by `signature.traits[i].name`. */
  traitOverrides?: Readonly<
    Record<string, { config?: Readonly<Record<string, FactoryParamValue>> }>
  >;
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
