/**
 * Orbital Builders
 *
 * Pure functions for constructing and composing Orbitals.
 * No new types. Everything uses existing core types:
 * Entity, Trait, Page, OrbitalDefinition, OrbitalSchema.
 *
 * Three categories:
 * 1. Builders: construct Entity, Page from common params
 * 2. Utilities: ensureIdField, resolveDefaults
 * 3. Composition: connect, compose, pipe
 *
 * @packageDocumentation
 */

import type { Entity, EntityPersistence } from './types/entity.js';
import type { EntityField } from './types/field.js';
import type { Page } from './types/page.js';
import type { OrbitalDefinition } from './types/orbital.js';
import type { OrbitalSchema } from './types/schema.js';
import type { TraitEventContract, TraitEventListener, Trait } from './types/trait.js';

// ============================================================================
// Utilities
// ============================================================================

/**
 * Ensure the fields array has an `id` field. Prepends one if missing.
 */
export function ensureIdField(fields: EntityField[]): EntityField[] {
  if (fields.some(f => f.name === 'id')) return fields;
  return [{ name: 'id', type: 'string', required: true }, ...fields];
}

/**
 * Simple pluralization: append 's'.
 */
export function plural(name: string): string {
  return name + 's';
}

// ============================================================================
// Entity Builder
// ============================================================================

export interface MakeEntityOpts {
  name: string;
  fields: EntityField[];
  persistence?: EntityPersistence;
  collection?: string;
}

/**
 * Build an Entity from options. Auto-adds id field, auto-derives collection.
 */
export function makeEntity(opts: MakeEntityOpts): Entity {
  const fields = ensureIdField(opts.fields);
  const persistence = opts.persistence ?? 'runtime';
  return {
    name: opts.name,
    persistence,
    ...(persistence === 'persistent'
      ? { collection: opts.collection ?? plural(opts.name).toLowerCase() }
      : {}),
    fields,
  };
}

// ============================================================================
// Page Builder
// ============================================================================

export interface MakePageOpts {
  name: string;
  path: string;
  traitName: string;
  isInitial?: boolean;
}

/**
 * Build a Page that binds to a single trait.
 */
export function makePage(opts: MakePageOpts): Page {
  return {
    name: opts.name,
    path: opts.path,
    ...(opts.isInitial ? { isInitial: true } : {}),
    traits: [{ ref: opts.traitName }],
  };
}

// ============================================================================
// Orbital Builder
// ============================================================================

/**
 * Build an OrbitalDefinition from its three components.
 */
export function makeOrbital(
  name: string,
  entity: Entity,
  traits: Trait[],
  pages: Page[],
): OrbitalDefinition {
  return { name, entity, traits, pages } as OrbitalDefinition;
}

// ============================================================================
// Composition: connect
// ============================================================================

/**
 * Wire a cross-orbital event between two orbitals.
 * Adds emits to a's first trait, listens to b's first trait.
 * Pure: returns new orbitals, no mutation.
 */
export function connect(
  a: OrbitalDefinition,
  b: OrbitalDefinition,
  event: TraitEventContract,
  triggers?: string,
): [OrbitalDefinition, OrbitalDefinition] {
  const aClone = structuredClone(a);
  const bClone = structuredClone(b);

  // Add emit to first trait of a
  const aTrait = (aClone.traits as Trait[])[0];
  if (aTrait) {
    const emitContract: TraitEventContract = {
      ...event,
      scope: event.scope ?? 'external',
    };
    aTrait.emits = [...(aTrait.emits ?? []), emitContract];
  }

  // Add listen to first trait of b
  const bTrait = (bClone.traits as Trait[])[0];
  if (bTrait) {
    const listener: TraitEventListener = {
      event: event.event,
      triggers: triggers ?? 'INIT',
      scope: 'external',
    };
    bTrait.listens = [...(bTrait.listens ?? []), listener];
  }

  return [aClone, bClone];
}

// ============================================================================
// Composition: compose
// ============================================================================

export interface ComposeConnection {
  from: string;
  to: string;
  event: TraitEventContract;
  triggers?: string;
}

export interface ComposePage {
  name: string;
  path: string;
  traits: string[];
  isInitial?: boolean;
}

/**
 * Compose multiple orbitals into a single OrbitalSchema (application).
 * Applies connections (cross-orbital event wiring) and page assignments.
 */
export function compose(
  orbitals: OrbitalDefinition[],
  pages: ComposePage[],
  connections: ComposeConnection[],
  appName?: string,
): OrbitalSchema {
  const cloned = structuredClone(orbitals);

  // Apply connections
  for (const conn of connections) {
    const emitter = cloned.find(o => {
      const traits = o.traits as Trait[];
      return traits.some(t => t.name === conn.from);
    });
    const listener = cloned.find(o => {
      const traits = o.traits as Trait[];
      return traits.some(t => t.name === conn.to);
    });

    if (emitter && listener) {
      const eTrait = (emitter.traits as Trait[]).find(t => t.name === conn.from);
      const lTrait = (listener.traits as Trait[]).find(t => t.name === conn.to);

      if (eTrait) {
        const emitContract: TraitEventContract = { ...conn.event, scope: conn.event.scope ?? 'external' };
        eTrait.emits = [...(eTrait.emits ?? []), emitContract];
      }
      if (lTrait) {
        const listenContract: TraitEventListener = {
          event: conn.event.event,
          triggers: conn.triggers ?? 'INIT',
          scope: 'external',
        };
        lTrait.listens = [...(lTrait.listens ?? []), listenContract];
      }
    }
  }

  // Assign pages to orbitals
  for (const orbital of cloned) {
    const traitNames = (orbital.traits as Trait[]).map(t => t.name);
    const matchingPages = pages.filter(p =>
      p.traits.some(t => traitNames.includes(t)),
    );
    orbital.pages = matchingPages.map(p => ({
      name: p.name,
      path: p.path,
      ...(p.isInitial ? { isInitial: true } : {}),
      traits: p.traits
        .filter(t => traitNames.includes(t))
        .map(ref => ({ ref })),
    }));
  }

  return {
    name: appName ?? 'Application',
    version: '1.0.0',
    orbitals: cloned,
  };
}

// ============================================================================
// Composition: pipe
// ============================================================================

/**
 * Chain orbitals in sequence with automatic event wiring.
 * Sugar over connect + compose: wires events[0] from orbital[0] to orbital[1], etc.
 */
export function pipe(
  orbitals: OrbitalDefinition[],
  events: TraitEventContract[],
  appName?: string,
): OrbitalSchema {
  if (events.length !== orbitals.length - 1) {
    throw new Error(`pipe requires exactly ${orbitals.length - 1} events for ${orbitals.length} orbitals`);
  }

  const cloned = structuredClone(orbitals);

  // Wire adjacent pairs
  for (let i = 0; i < events.length; i++) {
    const aTrait = (cloned[i].traits as Trait[])[0];
    const bTrait = (cloned[i + 1].traits as Trait[])[0];

    if (aTrait) {
      const emitContract: TraitEventContract = { ...events[i], scope: events[i].scope ?? 'external' };
      aTrait.emits = [...(aTrait.emits ?? []), emitContract];
    }
    if (bTrait) {
      const listener: TraitEventListener = {
        event: events[i].event,
        triggers: 'INIT',
        scope: 'external',
      };
      bTrait.listens = [...(bTrait.listens ?? []), listener];
    }
  }

  // Auto-generate pages: one per orbital, first is initial
  const pages: Page[] = cloned.map((o, i) => {
    const entityName = typeof o.entity === 'string' ? o.entity : o.entity.name;
    const traitNames = (o.traits as Trait[]).map(t => t.name);
    return {
      name: `${entityName}Page`,
      path: `/${plural(entityName).toLowerCase()}`,
      ...(i === 0 ? { isInitial: true } : {}),
      traits: traitNames.map(ref => ({ ref })),
    };
  });

  // Assign pages back to orbitals
  for (let i = 0; i < cloned.length; i++) {
    cloned[i].pages = [pages[i]];
  }

  return {
    name: appName ?? 'Application',
    version: '1.0.0',
    orbitals: cloned,
  };
}
