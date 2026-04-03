/**
 * Adapt Behavior Builder
 *
 * Deterministically rebinds a behavior's entity, fields, traits, and pages
 * to a target entity. No LLM involved. Render-UI trees stay from the behavior.
 *
 * Uses core types (OrbitalDefinition, Entity, EntityField, Trait, Page)
 * instead of untyped Record<string, unknown>.
 *
 * @packageDocumentation
 */

import type { OrbitalDefinition } from '../types/orbital.js';
import type { EntityField } from '../types/field.js';
import type { EntityPersistence } from '../types/entity.js';
import type { Trait } from '../types/trait.js';
import { isInlineTrait } from '../types/trait.js';

// ============================================================================
// Types
// ============================================================================

export interface AdaptBehaviorInput {
  /** Source orbital definition (from a golden behavior) */
  source: OrbitalDefinition;
  /** Target entity name (PascalCase) */
  entityName: string;
  /** Target fields */
  fields: Array<{ name: string; type: string; required?: boolean }>;
  /** Target collection name (defaults to plural lowercase of entityName) */
  collection?: string;
  /** Persistence mode (defaults to "persistent") */
  persistence?: EntityPersistence;
}

export interface AdaptBehaviorResult {
  /** The adapted orbital definition */
  orbital: OrbitalDefinition;
}

// ============================================================================
// Field Type Normalization
// ============================================================================

const VALID_FIELD_TYPES = new Set([
  'string', 'number', 'boolean', 'date', 'timestamp',
  'datetime', 'array', 'object', 'enum', 'relation',
]);

/**
 * Normalize a field type to a valid FieldType.
 * Handles TypeScript array syntax (string[], number[]) and invalid types.
 */
function normalizeFieldType(type: string): string {
  if (type.endsWith('[]')) return 'array';
  const lower = type.toLowerCase();
  if (VALID_FIELD_TYPES.has(lower)) return lower;
  return 'string'; // fallback
}

// ============================================================================
// Trait Name Derivation
// ============================================================================

/**
 * Extract the trait name suffix from the original behavior.
 * If the suffix is empty or equals the entity name, defaults to "Management".
 */
function deriveTraitSuffix(originalEntityName: string, traits: Trait[]): string {
  if (!traits.length) return 'Management';
  const traitName = traits[0].name;

  // Try exact prefix match
  if (traitName.startsWith(originalEntityName)) {
    const suffix = traitName.slice(originalEntityName.length);
    if (suffix && suffix.toLowerCase() !== originalEntityName.toLowerCase()) {
      return suffix;
    }
  }

  // Try case-insensitive prefix match
  const lower = originalEntityName.toLowerCase();
  const traitLower = traitName.toLowerCase();
  if (traitLower.startsWith(lower)) {
    const suffix = traitName.slice(lower.length);
    if (suffix && suffix.toLowerCase() !== originalEntityName.toLowerCase()) {
      return suffix;
    }
  }

  return 'Management';
}

// ============================================================================
// Entity Reference Replacement
// ============================================================================

/**
 * Recursively replace entity name references in an object (effects, render-ui trees).
 */
function replaceEntityRefs(obj: unknown, oldEntity: string, newEntity: string): unknown {
  if (typeof obj === 'string') {
    return obj === oldEntity ? newEntity : obj.replace(new RegExp(oldEntity, 'g'), newEntity);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => replaceEntityRefs(item, oldEntity, newEntity));
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEntityRefs(value, oldEntity, newEntity);
    }
    return result;
  }
  return obj;
}

// ============================================================================
// Stale Binding Cleanup
// ============================================================================

/**
 * Remove effects that reference @entity.field where field doesn't exist on the new entity.
 * Walks transitions and removes entire effects (set, persist, render-ui bindings) that
 * reference stale fields. Keeps the transition structure intact.
 */
function cleanStaleBindings(stateMachine: unknown, validFields: Set<string>): void {
  const sm = stateMachine as Record<string, unknown>;
  const transitions = sm.transitions as Array<Record<string, unknown>> | undefined;
  if (!transitions) return;

  for (const transition of transitions) {
    const effects = transition.effects as unknown[][] | undefined;
    if (!effects) continue;

    // Filter out effects that reference stale entity fields
    transition.effects = effects.filter(effect => {
      if (!Array.isArray(effect)) return true;
      return !hasStaleBinding(effect, validFields);
    });
  }
}

/**
 * Check if an effect array contains @entity.field references to non-existent fields.
 */
function hasStaleBinding(value: unknown, validFields: Set<string>): boolean {
  if (typeof value === 'string') {
    if (value.startsWith('@entity.')) {
      const field = value.slice('@entity.'.length).split('.')[0];
      return !validFields.has(field);
    }
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(item => hasStaleBinding(item, validFields));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(v => hasStaleBinding(v, validFields));
  }
  return false;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Adapt a behavior orbital to a new entity.
 *
 * Rebinds: entity name, collection, fields, trait names, page names/paths,
 * entity references in render-ui trees and effects.
 *
 * Preserves: state machine structure, transitions, render-ui trees, event wiring.
 */
export function adaptBehavior(input: AdaptBehaviorInput): AdaptBehaviorResult {
  const { source, entityName, fields, collection, persistence } = input;

  // Deep clone
  const orbital = JSON.parse(JSON.stringify(source)) as OrbitalDefinition;

  // Get original entity name
  const originalEntity = typeof orbital.entity === 'string'
    ? orbital.entity
    : orbital.entity.name;

  // Adapt entity
  const targetCollection = collection ?? entityName.toLowerCase() + 's';
  orbital.entity = {
    name: entityName,
    collection: targetCollection,
    persistence: persistence ?? 'persistent',
    fields: [
      { name: 'id', type: 'string' as const, required: true },
      ...fields.map(f => ({
        name: f.name,
        type: normalizeFieldType(f.type) as EntityField['type'],
        ...(f.required ? { required: true as const } : {}),
      })),
    ].filter((f, i, arr) => arr.findIndex(x => x.name === f.name) === i), // dedupe id
  } as OrbitalDefinition['entity'];

  // Adapt traits — each trait gets a unique name derived from its original suffix
  const inlineTraits = (orbital.traits as Trait[]).filter(t => isInlineTrait(t));
  const firstTraitSuffix = deriveTraitSuffix(originalEntity, inlineTraits);
  const traitNameMap = new Map<string, string>(); // old name → new name

  for (const trait of inlineTraits) {
    const oldTraitName = trait.name;
    // Derive per-trait suffix: replace original entity name with target entity name
    let newTraitName: string;
    if (trait.name.toLowerCase().startsWith(originalEntity.toLowerCase())) {
      const suffix = trait.name.slice(originalEntity.length) || firstTraitSuffix;
      newTraitName = entityName + suffix;
    } else {
      newTraitName = entityName + trait.name;
    }
    traitNameMap.set(oldTraitName, newTraitName);
    trait.name = newTraitName;
    trait.linkedEntity = entityName;

    // Replace entity references in state machine effects
    if (trait.stateMachine) {
      trait.stateMachine = replaceEntityRefs(
        trait.stateMachine, originalEntity, entityName,
      ) as Trait['stateMachine'];

      // Also replace old trait name references
      trait.stateMachine = replaceEntityRefs(
        trait.stateMachine, oldTraitName, newTraitName,
      ) as Trait['stateMachine'];

      // Clean up stale @entity.field bindings that reference fields not on the new entity
      const newFieldNames = new Set(fields.map(f => f.name));
      newFieldNames.add('id');
      cleanStaleBindings(trait.stateMachine, newFieldNames);
    }
  }

  // Adapt orbital name
  orbital.name = entityName + firstTraitSuffix;

  // Adapt pages
  if (orbital.pages) {
    for (const page of orbital.pages) {
      if (typeof page === 'string') continue;
      const p = page as { name?: string; path?: string; traits?: Array<{ ref: string } | string> };
      if (p.name) p.name = entityName + 'Page';
      if (p.path) p.path = '/' + targetCollection;
      if (p.traits) {
        for (const ref of p.traits) {
          if (typeof ref === 'object' && 'ref' in ref) {
            ref.ref = traitNameMap.get(ref.ref) ?? (entityName + firstTraitSuffix);
          }
        }
      }
    }
  }

  // Adapt domainContext
  if ('domainContext' in (orbital as unknown as Record<string, unknown>)) {
    const ctx = (orbital as unknown as Record<string, unknown>).domainContext as Record<string, unknown> | undefined;
    if (ctx?.vocabulary && typeof ctx.vocabulary === 'object') {
      (ctx.vocabulary as Record<string, unknown>).item = entityName.toLowerCase();
    }
  }

  return { orbital };
}
