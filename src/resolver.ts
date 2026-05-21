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
import type { ResolvedIR, ResolvedPage, ResolvedEntity, ResolvedTrait, ResolvedTraitEvent, ResolvedTraitTransition } from './types/ir.js';
import type { EntityField } from './types/field.js';
import type { FieldValue } from './types/entity.js';
import type { State, Event, Transition } from './types/state-machine.js';
import type { TraitEventListener } from './types/trait.js';

/**
 * Extended entity shape for schema data that may carry `defaults`.
 * The core Entity type does not include `defaults`, but parsed schemas
 * can attach it as extra data for singleton initialization.
 */
interface EntityWithDefaults extends Entity {
  defaults?: Record<string, FieldValue>;
}

// ============================================================================
// Cache
// ============================================================================

/**
 * Cache for resolved schemas, keyed on the schema object reference.
 *
 * Identity-based caching (WeakMap) is the only correct shape here: two
 * versions of the same logical schema with the same `name` + `version`
 * can have different content (e.g. a palette drop adds a render-ui
 * pattern, an agent edit rewrites a trait's effects). The old
 * `${name}-${version}` key collided across content mutations and
 * returned a stale IR — fine for the compiler's one-shot path, fatal
 * for the runtime's live-editing path where downstream identity checks
 * (`traits` array refs, trait state-machine references) depend on the
 * IR being fresh when the schema's content moved.
 *
 * WeakMap also means we don't have to think about cache invalidation:
 * when the consumer drops its reference to the schema, the entry is
 * garbage-collected automatically.
 */
let schemaCache = new WeakMap<OrbitalSchema, ResolvedIR>();

/**
 * Clear the schema resolution cache.
 *
 * With WeakMap-on-reference caching, cache entries die naturally when
 * the schema object is GC'd, so explicit clearing is rarely necessary.
 * Kept for hot-reload paths that want to force fresh resolution; since
 * WeakMap has no `clear()`, we swap in a fresh instance.
 */
export function clearSchemaCache(): void {
  schemaCache = new WeakMap<OrbitalSchema, ResolvedIR>();
}

/**
 * Get cache statistics (for debugging).
 *
 * WeakMap doesn't expose size or keys; the best we can do is signal
 * that the cache is identity-keyed. Kept for API parity with the old
 * Map-based cache.
 */
export function getSchemaCacheStats(): { size: number; keys: string[] } {
  return { size: -1, keys: [] };
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
  // Identity cache: same object reference → same IR. Caller is responsible
  // for handing us a fresh ref when content moved (e.g. immutable update).
  if (useCache) {
    const cached = schemaCache.get(schema);
    if (cached) return cached;
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
      const entityDef = orbital.entity as EntityWithDefaults;
      const entity: ResolvedEntity = {
        name: entityDef.name,
        description: entityDef.description,
        // eslint-disable-next-line almadar/no-record-string-unknown -- icon is an optional extension not on Entity type
        icon: (entityDef as unknown as { icon?: string }).icon,
        collection: entityDef.collection || entityDef.name.toLowerCase() + 's',
        fields: (entityDef.fields || [])
          .filter((field: EntityField): field is EntityField & { name: string } =>
            typeof field.name === 'string' && field.name.length > 0,
          )
          .map((field) => ({
          name: field.name,
          type: field.type,
          tsType: inferTsType(field.type),
          // eslint-disable-next-line almadar/no-record-string-unknown -- description is an optional extension not on EntityField type
          description: (field as unknown as { description?: string }).description,
          default: field.default,
          required: field.required ?? false,
          values: field.type === 'enum' ? field.values : undefined,
          enumValues: field.type === 'enum' ? field.values : undefined,
          relation: field.type === 'relation' ? field.relation : undefined,
        })),
        runtime: entityDef.persistence === 'runtime',
        singleton: entityDef.persistence === 'singleton',
        hasInstances: (entityDef.instances?.length ?? 0) > 0,
        instances: entityDef.instances,
        defaults: entityDef.defaults,
        usedByTraits: [],
        usedByPages: [],
      };
      ir.entities.set(entity.name, entity);
    }

    // Resolve traits. Preprocessed ref traits from @almadar/runtime's
    // preprocessSchema arrive as wrappers { ref, config, linkedEntity,
    // _resolved: <full trait> }. Unwrap those before projecting so the
    // page-level trait binding can find them by name in ir.traits.
    // Without this unwrap, `trait.name` on a ref wrapper is undefined,
    // and useTraitStateMachine subscribes to zero events for every ref.
    for (const rawTrait of (orbital.traits || [])) {
      const wrap = rawTrait as { _resolved?: Trait };
      const maybeResolved = wrap._resolved;
      const trait: Trait =
        maybeResolved && maybeResolved.stateMachine
          ? maybeResolved
          : (rawTrait as Trait);
      if (!trait.name) continue;
      const resolvedTrait: ResolvedTrait = {
        name: trait.name,
        description: trait.description,
        source: 'schema',
        category: trait.category,
        states: (trait.stateMachine?.states || []).map((s: State) => ({
          name: s.name,
          isInitial: s.isInitial ?? false,
          isFinal: s.isFinal ?? s.isTerminal ?? false,
        })),
        events: (trait.stateMachine?.events || []).map((e: Event) => ({
          key: e.key,
          name: e.name,
          payload: e.payloadSchema,
        })) as ResolvedTraitEvent[],
        transitions: (trait.stateMachine?.transitions || []).map((t: Transition) => ({
          from: t.from,
          to: t.to,
          event: t.event,
          guard: t.guard,
          effects: t.effects || [],
        })) as ResolvedTraitTransition[],
        guards: [],
        ticks: [],
        listens: (trait.listens || []).map((l: TraitEventListener) => ({
          event: l.event,
          triggers: l.triggers,
          guard: l.guard,
        })),
        dataEntities: [],
        linkedEntity: trait.linkedEntity,
        config: trait.config,
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
        traits: (page.traits || []).map((traitRef: PageTraitRef) => {
          const resolvedTrait = resolveTraitRef(traitRef, ir.traits, orbital.traits as Trait[] || []);
          // Precedence: page-level rebind → orbital-trait-wrapper rebind →
          // atom's resolved trait linkedEntity (from `uses` import) →
          // orbital primary entity. Without walking past the wrapper to
          // the atom's _resolved, atoms imported via `uses` without an
          // explicit `-> Entity` rebind silently rebind to the orbital's
          // primary entity (gap #22 design said atoms keep their own
          // auxiliary entity).
          const orbitalTrait = (orbital.traits as Trait[] || []).find(
            (t): t is Trait => typeof t === 'object' && t !== null
              && (
                ('name' in t && (t as { name?: string }).name === traitRef.ref)
                || ('ref' in t && (t as { ref?: string }).ref === traitRef.ref)
              )
          );
          const orbitalTraitWrapped = orbitalTrait as (Trait & { _resolved?: Trait }) | undefined;
          const wrapperLinked = orbitalTraitWrapped?.linkedEntity ?? orbitalTraitWrapped?._resolved?.linkedEntity;
          const resolvedLinked = resolvedTrait?.linkedEntity;
          return {
            ref: traitRef.ref,
            trait: resolvedTrait,
            linkedEntity: traitRef.linkedEntity ?? wrapperLinked ?? resolvedLinked ??
              (orbital.entity ? (typeof orbital.entity === 'string' ? orbital.entity.replace('.entity', '') : (orbital.entity as Entity).name) : undefined),
            config: traitRef.config,
          };
        }),
        entityBindings: [],
        navigation: [],
        singletonEntities: [],
      };
      ir.pages.set(page.name, resolvedPage);
    }
  }

  // Cache result against the schema's object identity.
  if (useCache) {
    schemaCache.set(schema, ir);
  }

  return ir;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infers TypeScript type from schema type string
 * 
 * Converts schema type strings to their TypeScript equivalents.
 * Handles primitive types, arrays, and custom types.
 * 
 * @param {string} schemaType - Schema type string (e.g., 'string', 'number[]')
 * @returns {string} TypeScript type string
 * 
 * @example
 * inferTsType('string') // returns 'string'
 * inferTsType('number[]') // returns 'number[]'
 * inferTsType('custom') // returns 'custom'
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
 * Resolves a trait reference to a full trait definition
 * 
 * Looks up trait references in the resolved traits map or schema traits array.
 * Creates appropriate trait structures for different reference types.
 * 
 * @param {PageTraitRef} traitRef - Trait reference (string or object)
 * @param {Map<string, ResolvedTrait>} traitsMap - Map of resolved traits
 * @param {Trait[]} schemaTraits - Array of schema traits
 * @returns {ResolvedTrait} Resolved trait definition
 * 
 * @example
 * const trait = resolveTraitRef('MyTrait', traitsMap, schemaTraits);
 * const trait = resolveTraitRef({ ref: 'MyTrait' }, traitsMap, schemaTraits);
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
