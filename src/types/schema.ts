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
export interface OrbitalSchema {
  /** Application name */
  name: string;

  /** Description */
  description?: string;

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
}

export const OrbitalSchemaSchema = z.object({
  name: z.string().min(1, "Schema name is required"),
  description: z.string().optional(),
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
});

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse an OrbitalSchema with Zod validation
 */
export function parseOrbitalSchema(data: unknown): OrbitalSchema {
  return OrbitalSchemaSchema.parse(data) as OrbitalSchema;
}

/**
 * Safe parse an OrbitalSchema
 */
export function safeParseOrbitalSchema(data: unknown) {
  return OrbitalSchemaSchema.safeParse(data);
}

// ============================================================================
// Type exports
// ============================================================================

export type OrbitalSchemaInput = z.input<typeof OrbitalSchemaSchema>;
export type OrbitalConfigInput = z.input<typeof OrbitalConfigSchema>;
