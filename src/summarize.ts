/**
 * Orbital Summarization
 *
 * Deterministic orbital-to-orbital transformation:
 * full schema in → business skeleton out.
 *
 * Input: OrbitalSchema. Output: OrbitalSchema.
 * Same types — just stripped of implementation details.
 *
 * @packageDocumentation
 */

import type { OrbitalSchema } from './types/schema.js';
import type { OrbitalDefinition } from './types/orbital.js';
import { isEntityReference } from './types/orbital.js';
import type { Entity } from './types/entity.js';
import type { EntityField } from './types/field.js';
import type { Trait } from './types/trait.js';
import { isInlineTrait } from './types/trait.js';
import type { Page } from './types/page.js';
import type { Transition, Event, State } from './types/state-machine.js';

// ============================================================================
// Workflow Type Detection
// ============================================================================

const CRUD_STATES = new Set(['browsing', 'creating', 'editing', 'viewing', 'deleting']);
const STEP_PATTERN = /^step\d+$/i;

/**
 * Classify a workflow from its state machine states.
 *
 * - CRUD: 3+ states match {browsing, creating, editing, viewing, deleting}
 * - Wizard: 2+ states match /^step\d+$/i, OR linear chain to terminal state
 * - Custom: everything else
 */
export function classifyWorkflow(states: State[]): 'crud' | 'wizard' | 'custom' {
  const names = states.map(s => s.name.toLowerCase());

  const crudMatch = names.filter(n => CRUD_STATES.has(n)).length;
  if (crudMatch >= 3) return 'crud';

  const stepCount = names.filter(n => STEP_PATTERN.test(n)).length;
  if (stepCount >= 2) return 'wizard';

  const hasTerminal = states.some(s => s.isTerminal || s.isFinal);
  const hasComplete = names.some(n =>
    n === 'complete' || n === 'completed' || n === 'done' || n === 'finished'
  );
  if ((hasTerminal || hasComplete) && states.length >= 4 && crudMatch <= 1) {
    return 'wizard';
  }

  return 'custom';
}

// ============================================================================
// Entity Summarization
// ============================================================================

function isPrimaryKey(field: EntityField): boolean {
  return (field as EntityField & { primaryKey?: boolean }).primaryKey === true;
}

function isBusinessField(field: EntityField): boolean {
  if (isPrimaryKey(field)) return false;
  if (field.type === 'enum' || field.type === 'relation') return true;
  if (field.required) return true;
  return false;
}

function summarizeEntity(entity: Entity): Entity {
  const fields: EntityField[] = entity.fields.filter(isBusinessField).map(f => {
    const summary: EntityField = { name: f.name, type: f.type };
    if (f.required) summary.required = true;
    if (f.type === 'enum' && f.values) summary.values = f.values;
    if (f.type === 'relation' && f.relation) summary.relation = f.relation;
    return summary;
  });

  return {
    name: entity.name,
    collection: entity.collection,
    fields,
  };
}

// ============================================================================
// Transition Summarization
// ============================================================================

/**
 * Deduplicate transitions that are identical in (from, to, event).
 * Strips effects and guards.
 */
function summarizeTransitions(transitions: Transition[]): Transition[] {
  const seen = new Set<string>();
  const result: Transition[] = [];

  for (const t of transitions) {
    const key = `${t.from}::${t.to}::${t.event}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ from: t.from, to: t.to, event: t.event });
    }
  }

  return result;
}

// ============================================================================
// Trait Summarization
// ============================================================================

function summarizeEvents(events: Event[]): Event[] {
  return events.map(e => ({ key: e.key, name: e.key }));
}

function summarizeTrait(trait: Trait): Trait {
  const states = trait.stateMachine?.states ?? [];
  const events = trait.stateMachine?.events ?? [];
  const transitions = trait.stateMachine?.transitions ?? [];

  const result: Trait = { name: trait.name };
  if (trait.category) result.category = trait.category;
  if (trait.linkedEntity) result.linkedEntity = trait.linkedEntity;

  if (trait.stateMachine) {
    result.stateMachine = {
      states: states.map(s => {
        const st: State = { name: s.name };
        if (s.isInitial) st.isInitial = true;
        if (s.isTerminal) st.isTerminal = true;
        if (s.isFinal) st.isFinal = true;
        return st;
      }),
      events: summarizeEvents(events),
      transitions: summarizeTransitions(transitions),
    };
  }

  if (trait.emits && trait.emits.length > 0) {
    result.emits = trait.emits.map(e => ({
      event: e.event,
      ...(e.scope ? { scope: e.scope } : {}),
    }));
  }

  if (trait.listens && trait.listens.length > 0) {
    result.listens = trait.listens.map(l => ({
      event: l.event,
      triggers: l.triggers,
      ...(l.scope ? { scope: l.scope } : {}),
    }));
  }

  return result;
}

// ============================================================================
// Page Summarization
// ============================================================================

function summarizePage(page: Page): Page {
  const result: Page = { name: page.name, path: page.path };
  if (page.traits && page.traits.length > 0) {
    result.traits = page.traits.map(t => ({ ref: t.ref }));
  }
  return result;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Summarize a single orbital into its business skeleton.
 *
 * OrbitalDefinition in → OrbitalDefinition out.
 * Strips effects, guards, payloads, theme, optional fields.
 * Deduplicates transitions on (from, to, event).
 */
export function summarizeOrbital(orbital: OrbitalDefinition): OrbitalDefinition {
  let entity: Entity;
  if (isEntityReference(orbital.entity)) {
    entity = { name: orbital.entity, fields: [] };
  } else {
    entity = summarizeEntity(orbital.entity);
  }

  const traits = orbital.traits.map(traitRef => {
    if (isInlineTrait(traitRef)) {
      return summarizeTrait(traitRef);
    }
    return traitRef;
  });

  const pages = orbital.pages
    .filter((p): p is Page => typeof p === 'object' && 'name' in p && !('ref' in p))
    .map(summarizePage);

  return { name: orbital.name, entity, traits, pages };
}

/**
 * Summarize an entire OrbitalSchema into a business skeleton.
 *
 * OrbitalSchema in → OrbitalSchema out.
 * Strips schema-level metadata (domainContext, design, designTokens, customPatterns).
 */
export function summarizeSchema(schema: OrbitalSchema): OrbitalSchema {
  return {
    name: schema.name,
    description: schema.description,
    version: schema.version,
    orbitals: schema.orbitals.map(summarizeOrbital),
  };
}
