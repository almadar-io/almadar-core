/**
 * Orbital Type (Self-Contained)
 *
 * Defines the Orbital - the atomic building block of applications.
 * Formula: Orbital = Entity × Traits × Pages
 *
 * An Orbital is a module that exports { entity, traits, pages }.
 * Use `uses` to import other Orbitals and access their components via:
 * - Alias.entity
 * - Alias.traits.TraitName
 * - Alias.pages.PageName
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Entity } from "./entity.js";
import { EntitySchema } from "./entity.js";
import type { Page } from "./page.js";
import { PageSchema } from "./page.js";
import type {
  TraitRef,
  EventPayloadField,
  EventScope,
  Trait,
} from "./trait.js";
import {
  TraitRefSchema,
  EventPayloadFieldSchema,
  EventScopeSchema,
  TraitSchema,
} from "./trait.js";
import type {
  DomainContext,
  DesignPreferences,
  SuggestedGuard,
  ThemeRef,
} from "./domain.js";
import {
  DomainContextSchema,
  DesignPreferencesSchema,
  SuggestedGuardSchema,
  ThemeRefSchema,
} from "./domain.js";
import type { ServiceRef } from "./service.js";
import { ServiceRefSchema } from "./service.js";
import type { Expression } from "./expression.js";
import { ExpressionSchema } from "./expression.js";

// ============================================================================
// Use Declaration (Import System)
// ============================================================================

/**
 * UseDeclaration - Import an external Orbital as a namespace.
 *
 * After importing, access components via:
 * - Alias.entity - The entity definition
 * - Alias.traits.TraitName - A specific trait
 * - Alias.pages.PageName - A specific page
 *
 * @example
 * ```json
 * {
 *   "uses": [
 *     { "from": "./health.orb", "as": "Health" },
 *     { "from": "std/behaviors/game-core", "as": "GameCore" }
 *   ]
 * }
 * ```
 */
export interface UseDeclaration {
  /**
   * Import source path:
   * - "std/behaviors/game-core" - Standard library
   * - "./shared/health.orb" - Local .orb file (relative path)
   * - "../common/physics.orb" - Parent directory .orb file
   * - "@game-lib/enemies.orb" - Scoped package (configured base)
   */
  from: string;

  /**
   * Alias for accessing imported components.
   * Used as namespace: Alias.entity, Alias.traits.X, Alias.pages.X
   */
  as: string;
}

export const UseDeclarationSchema = z.object({
  from: z.string().min(1, "Import source is required"),
  as: z
    .string()
    .min(1, "Alias is required")
    .regex(
      /^[A-Z][a-zA-Z0-9]*$/,
      'Alias must be PascalCase (e.g., "Health", "GameCore")',
    ),
});

// ============================================================================
// Entity Reference (Inline OR Reference)
// ============================================================================

/**
 * EntityRef - Entity can be inline definition OR reference to imported entity.
 *
 * Reference format: "Alias.entity"
 *
 * @example
 * ```json
 * // Inline
 * { "entity": { "name": "Player", "fields": [...] } }
 *
 * // Reference
 * { "entity": "Goblin.entity" }
 * ```
 */
export type EntityRef = Entity | string;

/**
 * Checks if an entity reference is a string reference.
 * 
 * Type guard to determine if an EntityRef is a string reference
 * (format: "Alias.entity") rather than an inline entity definition.
 * 
 * @param {EntityRef} entity - Entity reference to check
 * @returns {boolean} True if entity is a string reference, false if inline definition
 * 
 * @example
 * const ref1 = "User.entity"; // string reference
 * const ref2 = { name: "User", fields: [...] }; // inline definition
 * 
 * isEntityReference(ref1); // returns true
 * isEntityReference(ref2); // returns false
 */
export function isEntityReference(entity: EntityRef): entity is string {
  return typeof entity === "string";
}

/**
 * Validate entity reference format: "Alias.entity"
 */
export const EntityRefStringSchema = z
  .string()
  .regex(
    /^[A-Z][a-zA-Z0-9]*\.entity$/,
    'Entity reference must be in format "Alias.entity" (e.g., "Goblin.entity")',
  );

export const EntityRefSchema = z.union([EntitySchema, EntityRefStringSchema]);

// ============================================================================
// Page Reference (Inline OR Reference)
// ============================================================================

/**
 * PageRefObject - Reference to imported page with optional path override.
 */
export interface PageRefObject {
  /**
   * Reference to imported page: "Alias.pages.PageName"
   */
  ref: string;

  /**
   * Optional path override.
   * If provided, overrides the original page's path.
   */
  path?: string;
}

/**
 * PageRef - Page can be inline definition OR reference to imported page.
 *
 * Reference formats:
 * - "Alias.pages.PageName" - Simple reference (keeps original path)
 * - { ref: "Alias.pages.PageName", path: "/custom" } - Reference with path override
 *
 * @example
 * ```json
 * // Inline
 * { "name": "Dashboard", "path": "/", ... }
 *
 * // Simple reference
 * "User.pages.Profile"
 *
 * // Reference with path override
 * { "ref": "User.pages.Profile", "path": "/my-profile" }
 * ```
 */
export type PageRef = Page | string | PageRefObject;

/**
 * Checks if a page reference is a string reference.
 * 
 * Type guard to determine if a PageRef is a simple string reference
 * (format: "Alias.pages.PageName") rather than an inline page definition or object reference.
 * 
 * @param {PageRef} page - Page reference to check
 * @returns {boolean} True if page is a string reference, false otherwise
 * 
 * @example
 * const ref1 = "User.pages.Profile"; // string reference
 * const ref2 = { name: "Dashboard", path: "/" }; // inline definition
 * 
 * isPageReferenceString(ref1); // returns true
 * isPageReferenceString(ref2); // returns false
 */
export function isPageReferenceString(page: PageRef): page is string {
  return typeof page === "string";
}

/**
 * Checks if a page reference is a reference object.
 * 
 * Type guard to determine if a PageRef is an object reference
 * with a 'ref' property rather than an inline page definition.
 * 
 * @param {PageRef} page - Page reference to check
 * @returns {boolean} True if page is a reference object, false otherwise
 * 
 * @example
 * const ref1 = { ref: "User.pages.Profile", path: "/custom" }; // reference object
 * const ref2 = { name: "Dashboard", path: "/" }; // inline definition
 * 
 * isPageReferenceObject(ref1); // returns true
 * isPageReferenceObject(ref2); // returns false
 */
export function isPageReferenceObject(page: PageRef): page is PageRefObject {
  return typeof page === "object" && "ref" in page && !("name" in page);
}

/**
 * Checks if a page reference is any type of reference.
 * 
 * Type guard to determine if a PageRef is a reference (string or object)
 * rather than an inline page definition.
 * 
 * @param {PageRef} page - Page reference to check
 * @returns {boolean} True if page is a reference, false if inline definition
 * 
 * @example
 * const ref1 = "User.pages.Profile"; // string reference
 * const ref2 = { ref: "User.pages.Profile", path: "/custom" }; // object reference
 * const ref3 = { name: "Dashboard", path: "/" }; // inline definition
 * 
 * isPageReference(ref1); // returns true
 * isPageReference(ref2); // returns true
 * isPageReference(ref3); // returns false
 */
export function isPageReference(page: PageRef): page is string | PageRefObject {
  return isPageReferenceString(page) || isPageReferenceObject(page);
}

/**
 * Validate page reference format: "Alias.pages.PageName"
 */
export const PageRefStringSchema = z
  .string()
  .regex(
    /^[A-Z][a-zA-Z0-9]*\.pages\.[A-Z][a-zA-Z0-9]*$/,
    'Page reference must be in format "Alias.pages.PageName" (e.g., "User.pages.Profile")',
  );

export const PageRefObjectSchema = z.object({
  ref: PageRefStringSchema,
  path: z.string().startsWith("/").optional(),
});

export const PageRefSchema = z.union([
  PageSchema,
  PageRefStringSchema,
  PageRefObjectSchema,
]);

// ============================================================================
// Trait Reference Extensions
// ============================================================================

/**
 * Extended trait reference format for imported traits.
 *
 * Formats:
 * - "TraitName" - Local trait (inline or from uses without alias)
 * - "Alias.traits.TraitName" - Imported trait with namespace
 *
 * The existing TraitRef type already supports these via string.
 */

/**
 * Validate trait reference format for imported traits.
 */
export const ImportedTraitRefStringSchema = z
  .string()
  .regex(
    /^([A-Z][a-zA-Z0-9]*\.traits\.)?[A-Z][a-zA-Z0-9]*$/,
    'Trait reference must be "TraitName" or "Alias.traits.TraitName"',
  );

/**
 * Checks if a trait reference is an imported reference.
 * 
 * Determines if a trait reference uses the imported format
 * "Alias.traits.TraitName" rather than a simple "TraitName".
 * 
 * @param {string} ref - Trait reference to check
 * @returns {boolean} True if reference is imported format, false otherwise
 * 
 * @example
 * isImportedTraitRef("User.traits.Profile"); // returns true
 * isImportedTraitRef("Profile"); // returns false
 */
export function isImportedTraitRef(ref: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*\.traits\.[A-Z][a-zA-Z0-9]*$/.test(ref);
}

/**
 * Parses an imported trait reference.
 * 
 * Extracts the alias and trait name from an imported trait reference
 * in format "Alias.traits.TraitName". Returns null if not a valid imported reference.
 * 
 * @param {string} ref - Trait reference to parse
 * @returns {{ alias: string; traitName: string } | null} Parsed reference or null
 * 
 * @example
 * parseImportedTraitRef("User.traits.Profile"); // returns { alias: "User", traitName: "Profile" }
 * parseImportedTraitRef("Profile"); // returns null
 */
export function parseImportedTraitRef(
  ref: string,
): { alias: string; traitName: string } | null {
  const match = ref.match(/^([A-Z][a-zA-Z0-9]*)\.traits\.([A-Z][a-zA-Z0-9]*)$/);
  if (!match) return null;
  return { alias: match[1], traitName: match[2] };
}

/**
 * Parses an entity reference.
 * 
 * Extracts the alias from an entity reference in format "Alias.entity".
 * Returns null if not a valid entity reference.
 * 
 * @param {string} ref - Entity reference to parse
 * @returns {{ alias: string } | null} Parsed reference or null
 * 
 * @example
 * parseEntityRef("User.entity"); // returns { alias: "User" }
 * parseEntityRef("User"); // returns null
 */
export function parseEntityRef(ref: string): { alias: string } | null {
  const match = ref.match(/^([A-Z][a-zA-Z0-9]*)\.entity$/);
  if (!match) return null;
  return { alias: match[1] };
}

/**
 * Parses a page reference.
 * 
 * Extracts the alias and page name from a page reference
 * in format "Alias.pages.PageName". Returns null if not a valid page reference.
 * 
 * @param {string} ref - Page reference to parse
 * @returns {{ alias: string; pageName: string } | null} Parsed reference or null
 * 
 * @example
 * parsePageRef("User.pages.Profile"); // returns { alias: "User", pageName: "Profile" }
 * parsePageRef("Profile"); // returns null
 */
export function parsePageRef(
  ref: string,
): { alias: string; pageName: string } | null {
  const match = ref.match(/^([A-Z][a-zA-Z0-9]*)\.pages\.([A-Z][a-zA-Z0-9]*)$/);
  if (!match) return null;
  return { alias: match[1], pageName: match[2] };
}

// ============================================================================
// Event Listener (Legacy)
// ============================================================================

/**
 * Event listener for cross-orbital communication (legacy format).
 * @deprecated Use trait-level listens with scope instead.
 */
export interface EventListener {
  /** Event key to listen for */
  event: string;
  /** Action to trigger */
  triggers: string;
  /** Optional guard condition */
  guard?: string;
}

export const EventListenerSchema = z.object({
  event: z.string().min(1),
  triggers: z.string().min(1),
  guard: z.string().optional(),
});

// ============================================================================
// Computed Event Contract (Trait-Centric Model)
// ============================================================================

/**
 * Source of an event - which trait/transition/tick emits it.
 */
export interface EventSource {
  /** Trait that emits this event */
  trait: string;
  /** Transition that emits this event (if applicable) */
  transition?: string;
  /** Tick that emits this event (if applicable) */
  tick?: string;
}

export const EventSourceSchema = z.object({
  trait: z.string().min(1),
  transition: z.string().optional(),
  tick: z.string().optional(),
});

/**
 * Computed event contract with source tracking.
 * Generated by aggregating trait-level emits with namespacing.
 */
export interface ComputedEventContract {
  /** Namespaced event: "TraitName.EVENT_NAME" */
  event: string;
  /** Original event name without namespace */
  originalEvent: string;
  /** Source trait that emits this event */
  source: EventSource;
  /** Human-readable description */
  description?: string;
  /** Payload schema */
  payload?: EventPayloadField[];
}

export const ComputedEventContractSchema = z.object({
  event: z.string().min(1),
  originalEvent: z.string().min(1),
  source: EventSourceSchema,
  description: z.string().optional(),
  payload: z.array(EventPayloadFieldSchema).optional(),
});

/**
 * Computed event listener with source tracking.
 * Generated by aggregating trait-level listens.
 */
export interface ComputedEventListener {
  /** Event to listen for (may be namespaced) */
  event: string;
  /** Source trait that defines this listener */
  source: EventSource;
  /** State machine event to trigger */
  triggers: string;
  /** Guard expression */
  guard?: Expression;
  /** Payload field mapping */
  payloadMapping?: Record<string, string>;
}

export const ComputedEventListenerSchema = z.object({
  event: z.string().min(1),
  source: EventSourceSchema,
  triggers: z.string().min(1),
  guard: ExpressionSchema.optional(),
  payloadMapping: z.record(z.string()).optional(),
});

// ============================================================================
// Orbital
// ============================================================================

/**
 * Orbital - The atomic building block of applications.
 *
 * Formula: Orbital = Entity × Traits × Pages
 *
 * An orbital is a self-contained feature unit that groups:
 * - One entity (the data nucleus) - inline OR referenced via "Alias.entity"
 * - Zero or more traits (behavioral patterns) - inline OR referenced via "Alias.traits.X"
 * - Zero or more pages (UI entry points) - inline OR referenced via "Alias.pages.X"
 *
 * Use `uses` to import other orbitals and access their components.
 */
export type Orbital = OrbitalDefinition;

export interface OrbitalDefinition {
  /** Human-readable name */
  name: string;

  /** Optional description */
  description?: string;

  /** Visual prompt override */
  visual_prompt?: string;

  // ========================================================================
  // Import System (Unified Reference)
  // ========================================================================

  /**
   * Import external orbitals as namespaces.
   *
   * After importing, access components via:
   * - Alias.entity - The entity definition
   * - Alias.traits.TraitName - A specific trait
   * - Alias.pages.PageName - A specific page
   * - Alias.theme - The theme definition
   * - Alias.services.ServiceName - A specific service
   *
   * @example
   * ```json
   * "uses": [
   *   { "from": "./health.orb", "as": "Health" },
   *   { "from": "std/behaviors/game-core", "as": "GameCore" }
   * ]
   * ```
   */
  uses?: UseDeclaration[];

  // ========================================================================
  // Theme & Services
  // ========================================================================

  /**
   * Theme definition (inline OR reference via "Alias.theme").
   *
   * @example
   * ```json
   * // Inline
   * "theme": { "name": "ocean", "tokens": { "colors": { "primary": "#0ea5e9" } } }
   *
   * // Reference
   * "theme": "Ocean.theme"
   * ```
   */
  theme?: ThemeRef;

  /**
   * Service definitions (inline OR reference via "Alias.services.ServiceName").
   *
   * @example
   * ```json
   * // Inline
   * "services": [{ "name": "weather", "type": "rest", "baseUrl": "..." }]
   *
   * // Reference
   * "services": ["Weather.services.openweather"]
   * ```
   */
  services?: ServiceRef[];

  // ========================================================================
  // Components (Inline OR Reference)
  // ========================================================================

  /**
   * Entity definition (nucleus).
   *
   * Can be:
   * - Inline: Full entity definition
   * - Reference: "Alias.entity" (from uses)
   *
   * Entity sharing depends on persistence type:
   * - persistent: Shared (same DB collection)
   * - runtime: Isolated (each orbital gets own instances)
   * - singleton: Shared (single global instance)
   */
  entity: EntityRef;

  /** Trait references (local or imported via "Alias.traits.TraitName") */
  traits: TraitRef[];

  /**
   * Page definitions.
   *
   * Can be:
   * - Inline: Full page definition
   * - Reference string: "Alias.pages.PageName"
   * - Reference object: { ref: "Alias.pages.PageName", path: "/custom" }
   */
  pages: PageRef[];

  // ========================================================================
  // Event Interface (Trait-Centric Model)
  // ========================================================================

  /**
   * Events this orbital emits.
   *
   * COMPUTED from trait-level emits:
   * - Aggregated from all traits with `scope: 'external'`
   * - Namespaced as "TraitName.EVENT_NAME"
   * - Filtered by `exposes` if present
   *
   * Do not author directly - computed by resolver.
   */
  emits?: ComputedEventContract[];

  /**
   * Events this orbital listens for.
   *
   * COMPUTED from trait-level listens:
   * - Aggregated from all traits with `scope: 'external'`
   *
   * Do not author directly - computed by resolver.
   */
  listens?: ComputedEventListener[];

  /**
   * Filter which trait events are exposed externally.
   * If omitted, all external-scoped trait events are exposed.
   * Format: ["TraitName.EVENT_NAME", ...]
   */
  exposes?: string[];

  // ========================================================================
  // Context fields - persisted throughout orbital lifecycle
  // ========================================================================

  /** Domain context - category, vocabulary, personas */
  domainContext?: DomainContext;

  /** Design preferences - style, colors, UX hints */
  design?: DesignPreferences;

  /**
   * Suggested guards (decomposition phase only).
   * Natural language descriptions that generator converts to S-expressions.
   * Removed after generation - guards live in traits.
   */
  suggestedGuards?: SuggestedGuard[];
}

export const OrbitalDefinitionSchema = z.object({
  name: z.string().min(1, "Orbital name is required"),
  description: z.string().optional(),
  visual_prompt: z.string().optional(),
  // Import system
  uses: z.array(UseDeclarationSchema).optional(),
  // Theme & Services
  theme: ThemeRefSchema.optional(),
  services: z.array(ServiceRefSchema).optional(),
  // Components (inline or reference)
  entity: EntityRefSchema,
  traits: z.array(TraitRefSchema),
  pages: z.array(PageRefSchema),
  // Event interface (trait-centric model) - computed by resolver
  emits: z.array(ComputedEventContractSchema).optional(),
  listens: z.array(ComputedEventListenerSchema).optional(),
  // Filter for exposed events (trait-centric model)
  exposes: z.array(z.string()).optional(),
  // Context fields - persisted throughout orbital lifecycle
  domainContext: DomainContextSchema.optional(),
  design: DesignPreferencesSchema.optional(),
  suggestedGuards: z.array(SuggestedGuardSchema).optional(),
});

export const OrbitalSchema = OrbitalDefinitionSchema;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an Orbital is a full definition.
 * @deprecated No longer needed since Orbital is always OrbitalDefinition now.
 */
export function isOrbitalDefinition(
  orbital: Orbital,
): orbital is OrbitalDefinition {
  return "entity" in orbital;
}

// ============================================================================
// Type exports
// ============================================================================

export type OrbitalInput = z.input<typeof OrbitalSchema>;

// Backward compatibility
export type OrbitalUnit = Orbital;
export const OrbitalUnitSchema = OrbitalSchema;
