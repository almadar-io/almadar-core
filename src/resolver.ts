/**
 * Schema Resolver
 *
 * Converts OrbitalSchema to Intermediate Representation (IR).
 * Resolves all entity references, expands traits, and prepares schema for compilation/runtime.
 *
 * @packageDocumentation
 */

import type { OrbitalSchema } from './types/schema.js';
import type { Orbital, Trait, Page, PageTraitRef, Entity } from './types/index.js';
import type { ResolvedIR, ResolvedPage, ResolvedEntity, ResolvedTrait } from './types/ir.js';

// ============================================================================
// Cache
// ============================================================================

/**
 * Cache for resolved schemas (keyed by schema name + version)
 */
const schemaCache = new Map<string, ResolvedIR>();

/**
 * Clear the schema resolution cache.
 * Useful for hot-reloading during development.
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getSchemaCacheStats() {
  return {
    size: schemaCache.size,
    keys: Array.from(schemaCache.keys()),
  };
}

// ============================================================================
// Schema to IR Conversion
// ============================================================================

/**
 * Convert OrbitalSchema to Intermediate Representation (IR).
 *
 * This function:
 * 1. Resolves all entity references
 * 2. Expands trait definitions (inline or from library)
 * 3. Resolves page bindings
 * 4. Creates the IR structure used by compiler and runtime
 *
 * @param schema - OrbitalSchema to convert
 * @param useCache - Whether to use cached result (default: true)
 * @returns Fully resolved IR
 *
 * @example
 * const schema = { name: 'MyApp', orbitals: [...] };
 * const ir = schemaToIR(schema);
 * console.log(ir.entities.size); // Number of entities
 * console.log(ir.pages.size); // Number of pages
 */
export function schemaToIR(schema: OrbitalSchema, useCache: boolean = true): ResolvedIR {
  // Generate cache key
  const cacheKey = `${schema.name}-${schema.version || '1.0.0'}`;

  // Check cache
  if (useCache && schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey)!;
  }

  // Create empty IR structure
  const ir: ResolvedIR = {
    appName: schema.name,
    description: schema.description,
    version: schema.version || '1.0.0',
    entities: new Map<string, ResolvedEntity>(),
    traits: new Map<string, ResolvedTrait>(),
    pages: new Map<string, ResolvedPage>(),
    entityBindings: [],
    generatedAt: new Date().toISOString(),
  };

  // Process each orbital
  for (const orbital of schema.orbitals as Orbital[]) {
    // Resolve entity if present
    if (orbital.entity && typeof orbital.entity !== 'string') {
      const entityDef = orbital.entity as Entity;
      const entity: ResolvedEntity = {
        name: entityDef.name,
        description: entityDef.description,
        icon: (entityDef as any).icon,  // Optional icon (may not exist on type)
        collection: entityDef.collection || entityDef.name.toLowerCase() + 's',
        fields: (entityDef.fields || []).map((field: any) => ({
          name: field.name,
          type: field.type,
          tsType: inferTsType(field.type),
          description: field.description,
          default: field.default,
          required: field.required ?? false,
          values: field.values,
          enumValues: field.values,
          relation: field.relation,
        })),
        runtime: entityDef.persistence === 'runtime',
        singleton: entityDef.persistence === 'singleton',
        hasInstances: (entityDef.instances?.length ?? 0) > 0,
        instances: entityDef.instances,
        defaults: (entityDef as any).defaults,  // Optional defaults (may not exist on type)
        usedByTraits: [],
        usedByPages: [],
      };
      ir.entities.set(entity.name, entity);
    }

    // Resolve traits
    for (const trait of (orbital.traits || []) as Trait[]) {
      const resolvedTrait: ResolvedTrait = {
        name: trait.name,
        description: trait.description,
        source: 'schema',
        category: trait.category,
        states: (trait.stateMachine?.states || []).map((s: any) => ({
          name: s.name,
          isInitial: s.isInitial ?? false,
          isFinal: s.isFinal ?? s.isTerminal ?? false,
        })),
        events: (trait.stateMachine?.events || []).map((e: any) => ({
          key: typeof e === 'string' ? e : e.key || e.name,
          name: typeof e === 'string' ? e : e.name,
          payload: typeof e === 'object' && 'payloadSchema' in e ?
            (e.payloadSchema as any) : undefined,
        })),
        transitions: (trait.stateMachine?.transitions || []).map((t: any) => ({
          from: t.from,
          to: t.to,
          event: t.event,
          guard: t.guard,
          effects: t.effects || [],
        })),
        guards: [],
        ticks: [],
        listens: ((trait as any).listens || []).map((l: any) => ({
          event: l.event,
          triggers: l.triggers,
          guard: l.guard,
        })),
        dataEntities: [],
      };
      ir.traits.set(trait.name, resolvedTrait);
    }

    // Resolve pages
    for (const page of (orbital.pages || []) as Page[]) {
      const resolvedPage: ResolvedPage = {
        name: page.name,
        path: page.path,
        featureName: page.name.toLowerCase(),
        viewType: page.viewType && ['list', 'detail', 'create', 'edit', 'dashboard'].includes(page.viewType) ?
          page.viewType as ('list' | 'detail' | 'create' | 'edit' | 'dashboard') : undefined,
        sections: [],
        traits: (page.traits || []).map((traitRef: PageTraitRef) => ({
          ref: typeof traitRef === 'string' ? traitRef : traitRef.ref,
          trait: resolveTraitRef(traitRef, ir.traits, orbital.traits as Trait[] || []),
          linkedEntity: typeof traitRef === 'object' && 'linkedEntity' in traitRef ?
            (traitRef as any).linkedEntity : undefined,
          config: typeof traitRef === 'object' && 'config' in traitRef ?
            (traitRef as any).config : undefined,
        })),
        entityBindings: [],
        navigation: [],
        singletonEntities: [],
      };
      ir.pages.set(page.name, resolvedPage);
    }
  }

  // Cache result
  if (useCache) {
    schemaCache.set(cacheKey, ir);
  }

  return ir;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer TypeScript type from schema type
 */
function inferTsType(schemaType: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'Date',
    datetime: 'Date',
    timestamp: 'number',
    array: 'unknown[]',
    object: 'Record<string, unknown>',
    any: 'unknown',
  };

  // Handle array types like "string[]"
  if (schemaType.endsWith('[]')) {
    const baseType = schemaType.slice(0, -2);
    return `${typeMap[baseType] || baseType}[]`;
  }

  return typeMap[schemaType] || schemaType;
}

/**
 * Resolve a trait reference to a full trait
 */
function resolveTraitRef(
  traitRef: PageTraitRef,
  traitsMap: Map<string, ResolvedTrait>,
  schemaTraits: Trait[]
): ResolvedTrait {
  const refName = typeof traitRef === 'string' ? traitRef : traitRef.ref || '';

  // Try to find in resolved traits
  if (traitsMap.has(refName)) {
    return traitsMap.get(refName)!;
  }

  // Try to find in schema traits
  const schemaTrait = schemaTraits.find((t: Trait) => t.name === refName);
  if (schemaTrait) {
    // This is a simplified inline trait
    return {
      name: refName,
      source: 'inline',
      states: [],
      events: [],
      transitions: [],
      guards: [],
      ticks: [],
      listens: [],
      dataEntities: [],
    };
  }

  // Fallback: create empty trait
  return {
    name: refName,
    source: 'schema',
    states: [],
    events: [],
    transitions: [],
    guards: [],
    ticks: [],
    listens: [],
    dataEntities: [],
  };
}

// ============================================================================
// Page Helpers
// ============================================================================

/**
 * Get a specific page from resolved IR by name.
 * If no name is provided, returns the first page.
 *
 * @param ir - Resolved IR
 * @param pageName - Optional page name to find
 * @returns Resolved page or undefined
 *
 * @example
 * const ir = schemaToIR(schema);
 * const homePage = getPage(ir, 'HomePage');
 * const firstPage = getPage(ir); // No name = first page
 */
export function getPage(ir: ResolvedIR, pageName?: string): ResolvedPage | undefined {
  if (!pageName) {
    // Return first page if no name specified
    return ir.pages.values().next().value;
  }
  return ir.pages.get(pageName);
}

/**
 * Get all pages from resolved IR as an array
 *
 * @param ir - Resolved IR
 * @returns Array of resolved pages
 */
export function getPages(ir: ResolvedIR): ResolvedPage[] {
  return Array.from(ir.pages.values());
}

/**
 * Get a specific entity from resolved IR by name
 *
 * @param ir - Resolved IR
 * @param entityName - Entity name to find
 * @returns Resolved entity or undefined
 */
export function getEntity(ir: ResolvedIR, entityName: string): ResolvedEntity | undefined {
  return ir.entities.get(entityName);
}

/**
 * Get a specific trait from resolved IR by name
 *
 * @param ir - Resolved IR
 * @param traitName - Trait name to find
 * @returns Resolved trait or undefined
 */
export function getTrait(ir: ResolvedIR, traitName: string): ResolvedTrait | undefined {
  return ir.traits.get(traitName);
}
