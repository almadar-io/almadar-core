/**
 * Orbital Schema Type (Self-Contained)
 *
 * Defines the OrbitalSchema - the top-level application definition.
 * An application is a composition of orbitals: App = Σ(Orbitals)
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Orbital } from "./orbital.js";
import { OrbitalSchema as OrbitalZodSchema } from "./orbital.js";
import type {
  DomainContext,
  DesignPreferences,
  DesignTokens,
  CustomPatternMap,
} from "./domain.js";
import {
  DomainContextSchema,
  DesignPreferencesSchema,
  DesignTokensSchema,
  CustomPatternMapSchema,
} from "./domain.js";
import type { ServiceDefinition } from "./service.js";
import { ServiceDefinitionSchema } from "./service.js";
import type { Trait } from "./trait.js";
import type { IdentityLedger } from "./identity.js";
import { IdentityLedgerSchema } from "./identity.js";

// ============================================================================
// Orbital Config
// ============================================================================

/**
 * Global configuration for the application
 */
export interface OrbitalConfig {
  /** Theme configuration */
  theme?: {
    primary?: string;
    secondary?: string;
    mode?: "light" | "dark" | "system";
  };
  /** Feature flags */
  features?: Record<string, boolean>;
  /** API configuration */
  api?: {
    baseUrl?: string;
    timeout?: number;
  };
}

export const OrbitalConfigSchema = z.object({
  theme: z
    .object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      mode: z.enum(["light", "dark", "system"]).optional(),
    })
    .optional(),
  features: z.record(z.boolean()).optional(),
  api: z
    .object({
      baseUrl: z.string().optional(),
      timeout: z.number().optional(),
    })
    .optional(),
});

// ============================================================================
// Orbital Schema
// ============================================================================

/**
 * OrbitalSchema - The top-level application definition.
 *
 * An application is a composition of orbitals:
 * App = Σ(Orbitals)
 *
 * Custom traits can be defined at the schema level and referenced
 * by orbitals via TraitRef. This allows LLMs to generate custom
 * traits that aren't in the trait library.
 */
/**
 * One `@config.<knob>` → render-ui prop substitution recorded by the inline
 * phase. Lets a consumer trace a resolved render-ui literal back to the config
 * knob it came from (the `@config.X` string is erased after substitution).
 * Mirrors the Rust `ConfigProvenanceRecord`.
 */
export interface ConfigProvenanceRecord {
  /** Resolved trait name (post call-site rename) owning the render-ui effect. */
  trait: string;
  /** Pattern path within the render-ui tree (e.g. `root.children.0`). */
  patternPath?: string;
  /** The pattern-node prop key whose value was a `@config.X` binding. */
  prop: string;
  /** The config knob name (`X` in `@config.X`). */
  knob: string;
}

/** Compiler-emitted schema metadata — the resolved `.orb` `_metadata` block. */
export interface SchemaMetadata {
  version?: number;
  createdAt?: number;
  source?: string;
  updatedAt?: number;
  /** Config→knob provenance keyed by orbital name. See {@link ConfigProvenanceRecord}. */
  configProvenance?: Record<string, ConfigProvenanceRecord[]>;
}

export interface OrbitalSchema {
  /** Application name */
  name: string;

  /** Description */
  description?: string;

  /**
   * Short human-readable summary distinct from `description`. Typically an
   * AI-generated one-liner used by app list views, breadcrumbs, and the
   * `GET /graphs/:appId/domain-text` projection. Kept separate from
   * `description` (which may be longer / authored copy) so consumers can
   * present a stable short label without truncating.
   */
  summary?: string;

  /** Version (semver) */
  version?: string;

  /** Domain context - user request + classification */
  domainContext?: DomainContext;

  /** Design preferences */
  design?: DesignPreferences;

  /**
   * Design tokens - reusable Tailwind class collections.
   * Reference via `token: "surfaces.glass"` in patterns.
   */
  designTokens?: DesignTokens;

  /**
   * Custom pattern definitions for app-specific reusable patterns.
   * Register custom designs that can be referenced by name.
   */
  customPatterns?: CustomPatternMap;

  /** Array of orbitals */
  orbitals: Orbital[];

  /** External services */
  services?: ServiceDefinition[];

  /** Global config */
  config?: OrbitalConfig;

  /** Compiler-emitted metadata (resolved `.orb` `_metadata`). */
  _metadata?: SchemaMetadata;

  /**
   * V4 IR schema version. Distinct from the semver `version` above; gates the
   * identity-keyed reference semantics. Optional/unset for pre-V4 schemas.
   */
  schemaVersion?: number;

  /**
   * V4 identity ledger — the sole name↔id map for this schema's nodes. Optional
   * until the Phase-7 flip; absent on pre-V4 schemas.
   */
  ledger?: IdentityLedger;
}

export const ConfigProvenanceRecordSchema = z.object({
  trait: z.string(),
  patternPath: z.string().optional(),
  prop: z.string(),
  knob: z.string(),
});

export const SchemaMetadataSchema = z.object({
  version: z.number().optional(),
  createdAt: z.number().optional(),
  source: z.string().optional(),
  updatedAt: z.number().optional(),
  configProvenance: z.record(z.array(ConfigProvenanceRecordSchema)).optional(),
});

export const OrbitalSchemaSchema = z.object({
  name: z.string().min(1, "Schema name is required"),
  description: z.string().optional(),
  summary: z.string().optional(),
  version: z.string().optional(),
  domainContext: DomainContextSchema.optional(),
  design: DesignPreferencesSchema.optional(),
  designTokens: DesignTokensSchema,
  customPatterns: CustomPatternMapSchema,
  orbitals: z
    .array(OrbitalZodSchema)
    .min(1, "At least one orbital is required"),
  services: z.array(ServiceDefinitionSchema).optional(),
  config: OrbitalConfigSchema.optional(),
  _metadata: SchemaMetadataSchema.optional(),
  // V4 identity — optional/dual-carry until the Phase-7 flip. Present on
  // id-carrying `.orb` files so `parseOrbitalSchema` preserves them instead
  // of stripping unknown keys.
  schemaVersion: z.number().optional(),
  ledger: IdentityLedgerSchema.optional(),
});

// ============================================================================
// Persisted/Flattened View
// ============================================================================

/**
 * Flattened `OrbitalSchema` view used by the persistence/runtime layer.
 *
 * Canonical `OrbitalSchema` keeps every trait inside its owning
 * `OrbitalDefinition.traits`. Some runtime paths (e.g. the orbital-agent
 * stream, Firestore persistence) additionally roll the resolved trait set up
 * to the top level as `traits[]` so diffs and list views don't have to walk
 * every orbital.
 *
 * This is intentionally a LOSSY persisted view, NOT the canonical authoring
 * shape: it carries the rolled-up array alongside the per-orbital trait
 * lists, and consumers should prefer `OrbitalSchema` whenever the rolled-up
 * surface isn't required.
 */
export interface OrbitalSchemaWithTraits extends OrbitalSchema {
  /** Flattened trait set rolled up from all orbitals. Persisted-view only. */
  traits?: Trait[];
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parses raw data into a validated OrbitalSchema.
 * 
 * Uses Zod validation to ensure the data conforms to the OrbitalSchema structure.
 * Throws a ZodError if validation fails. For safe parsing that doesn't throw,
 * use `safeParseOrbitalSchema()` instead.
 * 
 * @param {unknown} data - Raw data to parse (typically JSON)
 * @returns {OrbitalSchema} Validated orbital schema
 * @throws {z.ZodError} If data doesn't match OrbitalSchema structure
 * 
 * @example
 * ```typescript
 * try {
 *   const schema = parseOrbitalSchema(jsonData);
 *   console.log('Valid schema:', schema.name);
 * } catch (error) {
 *   console.error('Invalid schema:', error);
 * }
 * ```
 * 
 * @see safeParseOrbitalSchema
 */
export function parseOrbitalSchema(data: unknown): OrbitalSchema {
  return OrbitalSchemaSchema.parse(data) as OrbitalSchema;
}

/**
 * Safely parses raw data into a validated OrbitalSchema without throwing.
 * 
 * Uses Zod's safeParse method to validate data and return a result object
 * instead of throwing errors. This is useful for form validation and
 * user input handling where you want to gracefully handle invalid data.
 * 
 * @param {unknown} data - Raw data to parse (typically JSON)
 * @returns {z.SafeParseReturnType<OrbitalSchema, OrbitalSchema>} Parse result with success/status
 * 
 * @example
 * ```typescript
 * const result = safeParseOrbitalSchema(jsonData);
 * if (result.success) {
 *   console.log('Valid schema:', result.data.name);
 * } else {
 *   console.error('Validation errors:', result.error);
 * }
 * ```
 * 
 * @see parseOrbitalSchema
 */
export function safeParseOrbitalSchema(data: unknown) {
  return OrbitalSchemaSchema.safeParse(data);
}

// ============================================================================
// Type exports
// ============================================================================

export type OrbitalSchemaInput = z.input<typeof OrbitalSchemaSchema>;
export type OrbitalConfigInput = z.input<typeof OrbitalConfigSchema>;
