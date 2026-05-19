/**
 * Pure reducer for `DomainMutation` over `DomainDocument`.
 *
 * No I/O. No randomness. Returns a new typed `DomainDocument`
 * (immutable update) so callers can preserve prior state for
 * cross-turn stability. One total switch over the discriminated
 * union — the compiler enforces exhaustiveness via the `never`
 * default branch.
 *
 * Companion to `translateDomainToParams`: the UI/agent emits typed
 * `DomainMutation[]`, the reducer applies them, the translator
 * lowers the result onto factory call sites.
 */

import type {
  DomainBehavior,
  DomainDocument,
  DomainEntity,
  DomainField,
  DomainMutation,
  DomainPage,
  DomainRelationship,
  DomainTransition,
} from './types.js';

/**
 * Apply one mutation to the document. The original is not modified.
 * Mutations targeting missing entities/pages/behaviors/fields are
 * silently no-ops — callers that care should validate via
 * `findEntity`-style helpers before applying.
 */
export function applyMutation(
  doc: DomainDocument,
  mut: DomainMutation,
): DomainDocument {
  switch (mut.kind) {
    case 'add-entity':
      return { ...doc, entities: [...doc.entities, mut.entity] };

    case 'remove-entity':
      return {
        ...doc,
        entities: doc.entities.filter((e) => e.name !== mut.entityName),
      };

    case 'rename-entity':
      return {
        ...doc,
        entities: replaceEntity(doc.entities, mut.from, (e) => ({
          ...e,
          name: mut.to,
        })),
      };

    case 'update-entity':
      return {
        ...doc,
        entities: replaceEntity(doc.entities, mut.entityName, () => mut.entity),
      };

    case 'add-field':
      return {
        ...doc,
        entities: replaceEntity(doc.entities, mut.entityName, (e) => ({
          ...e,
          fields: [...e.fields, mut.field],
        })),
      };

    case 'remove-field':
      return {
        ...doc,
        entities: replaceEntity(doc.entities, mut.entityName, (e) => ({
          ...e,
          fields: e.fields.filter((f) => f.name !== mut.fieldName),
        })),
      };

    case 'update-field':
      return {
        ...doc,
        entities: replaceEntity(doc.entities, mut.entityName, (e) => ({
          ...e,
          fields: replaceField(e.fields, mut.field),
        })),
      };

    case 'add-page':
      return { ...doc, pages: [...doc.pages, mut.page] };

    case 'remove-page':
      return {
        ...doc,
        pages: doc.pages.filter((p) => p.name !== mut.pageName),
      };

    case 'update-page':
      return {
        ...doc,
        pages: replacePage(doc.pages, mut.pageName, () => mut.page),
      };

    case 'add-behavior':
      return { ...doc, behaviors: [...doc.behaviors, mut.behavior] };

    case 'remove-behavior':
      return {
        ...doc,
        behaviors: doc.behaviors.filter((b) => b.name !== mut.behaviorName),
      };

    case 'update-behavior':
      return {
        ...doc,
        behaviors: replaceBehavior(
          doc.behaviors,
          mut.behaviorName,
          () => mut.behavior,
        ),
      };

    case 'add-transition':
      return {
        ...doc,
        behaviors: replaceBehavior(doc.behaviors, mut.behaviorName, (b) => ({
          ...b,
          transitions: [...b.transitions, mut.transition],
        })),
      };

    case 'remove-transition':
      return {
        ...doc,
        behaviors: replaceBehavior(doc.behaviors, mut.behaviorName, (b) => ({
          ...b,
          transitions: b.transitions.filter(
            (t) => !matchesTransition(t, mut.from, mut.to, mut.event),
          ),
        })),
      };

    case 'add-relationship':
      return {
        ...doc,
        entities: replaceEntity(doc.entities, mut.entityName, (e) => ({
          ...e,
          relationships: [...e.relationships, mut.relationship],
        })),
      };

    case 'remove-relationship':
      return {
        ...doc,
        entities: replaceEntity(doc.entities, mut.entityName, (e) => ({
          ...e,
          relationships: e.relationships.filter(
            (r) =>
              !matchesRelationship(r, mut.targetEntity, mut.relationshipType),
          ),
        })),
      };

    default: {
      const _exhaustive: never = mut;
      return doc;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers — one per AST shape, single call site each, no duplication.
// ---------------------------------------------------------------------------

function replaceEntity(
  entities: DomainEntity[],
  name: string,
  update: (e: DomainEntity) => DomainEntity,
): DomainEntity[] {
  return entities.map((e) => (e.name === name ? update(e) : e));
}

function replaceField(
  fields: DomainField[],
  next: DomainField,
): DomainField[] {
  return fields.map((f) => (f.name === next.name ? next : f));
}

function replacePage(
  pages: DomainPage[],
  name: string,
  update: (p: DomainPage) => DomainPage,
): DomainPage[] {
  return pages.map((p) => (p.name === name ? update(p) : p));
}

function replaceBehavior(
  behaviors: DomainBehavior[],
  name: string,
  update: (b: DomainBehavior) => DomainBehavior,
): DomainBehavior[] {
  return behaviors.map((b) => (b.name === name ? update(b) : b));
}

function matchesTransition(
  t: DomainTransition,
  from: string,
  to: string,
  event: string,
): boolean {
  return t.fromState === from && t.toState === to && t.event === event;
}

function matchesRelationship(
  r: DomainRelationship,
  targetEntity: string,
  relationshipType: DomainRelationship['relationshipType'],
): boolean {
  return r.targetEntity === targetEntity && r.relationshipType === relationshipType;
}
